/**
 * 主机状态中枢
 * 把 jsnes 内核、音频、输入、本地存储与 Vue 界面连接起来。
 * 全局单例，任意组件 import { console } 都能拿到同一台「主机」。
 */
import { computed, reactive, ref, watch } from 'vue'
import { AudioEngine } from '@/core/AudioEngine'
import { InputManager, type PadSnapshot } from '@/core/InputManager'
import { NesEmulator } from '@/core/NesEmulator'
import {
  DEFAULT_KEYMAP,
  SAVE_SLOT_COUNT,
  SCREEN_H,
  SCREEN_W,
  type ButtonName,
  type Keymap,
  type PlayerId,
} from '@/core/constants'
import { stripExt } from '@/core/rom'
import {
  batteryRepo,
  KEYS,
  loadJSON,
  romRepo,
  saveJSON,
  stateRepo,
  storageAvailable,
  type StoredRom,
  type StoredState,
} from '@/core/storage'
import { useToast } from './useToast'

export interface Settings {
  volume: number
  soundEnabled: boolean
  scanlines: boolean
  curvature: boolean
  bloom: boolean
  pixelPerfect: boolean
  aspect: '4:3' | '1:1'
  autoBattery: boolean
  turboSpeed: number
}

/** 内置试玩卡带：均为自由软件，随 jsnes 项目一同分发 */
export interface BuiltinRom {
  key: string
  title: string
  file: string
  desc: string
  author: string
}

export const BUILTIN_ROMS: BuiltinRom[] = [
  {
    key: 'lj65',
    title: 'LJ65 · 方块消除',
    file: '/roms/lj65.nes',
    desc: 'Damian Yerrick 开发的动作益智游戏，手感顺滑、可双人对战。',
    author: '© 2009 Damian Yerrick · GPLv2+',
  },
  {
    key: 'croom',
    title: 'Concentration Room · 记忆翻牌',
    file: '/roms/croom.nes',
    desc: '同作者出品的翻牌配对游戏，含剧情、对战与 CPU 模式。',
    author: '© 2010 Damian Yerrick · GPLv3+',
  },
]

const DEFAULT_SETTINGS: Settings = {
  volume: 0.65,
  soundEnabled: true,
  scanlines: true,
  curvature: true,
  bloom: true,
  pixelPerfect: false,
  aspect: '4:3',
  autoBattery: true,
  turboSpeed: 3,
}

// ------------------------------------------------------------------ 单例

const audio = new AudioEngine(44100)
const emulator = new NesEmulator(audio)
const toast = useToast()

const settings = reactive<Settings>({
  ...DEFAULT_SETTINGS,
  ...(loadJSON<Partial<Settings>>(KEYS.settings) ?? {}),
})

const keymap = reactive<Keymap>(
  loadJSON<Keymap>(KEYS.keymap) ?? structuredClone(DEFAULT_KEYMAP),
)

// ------------------------------------------------------------------ 状态

const powered = ref(false)
const paused = ref(false)
const turbo = ref(false)
const muted = ref(settings.soundEnabled ? false : true)
const rom = ref<{ name: string; id: string; size: number; mapper: number; battery: boolean } | null>(
  null,
)
const pendingRom = ref<{ name: string; bytes: Uint8Array } | null>(null)
const padState = ref<PadSnapshot>({ 1: [], 2: [] })
const gamepads = ref<{ index: number; id: string }[]>([])
const stats = reactive({ fps: 0, frameMs: 0, skipped: 0 })
const slots = ref<StoredState[]>([])
const library = ref<StoredRom[]>([])
const libraryReady = ref(false)
const storeOk = ref(true)
const lastError = ref<string | null>(null)

let frameTarget: ((img: ImageData) => void) | null = null
let batteryTimer = 0

// ------------------------------------------------------------------ 事件接线

const input = new InputManager({
  onButton(player, button, pressed) {
    if (pressed) emulator.buttonDown(player, button)
    else emulator.buttonUp(player, button)
  },
  onChange(snapshot) {
    padState.value = snapshot
  },
  onGamepads(pads) {
    gamepads.value = pads
  },
  onHotkey(name) {
    switch (name) {
      case 'pause':
        togglePause()
        break
      case 'mute':
        toggleMute()
        break
      case 'turbo-on':
        setTurbo(true)
        break
      case 'turbo-off':
        setTurbo(false)
        break
      case 'fullscreen':
        void toggleFullscreen()
        break
      case 'quick-save':
        void saveSlot(SAVE_SLOT_COUNT)
        break
      case 'quick-load':
        void loadSlot(SAVE_SLOT_COUNT)
        break
      case 'escape':
        break
    }
  },
})

emulator.setEvents({
  onFrame(img) {
    frameTarget?.(img)
  },
  onStats(s) {
    stats.fps = s.fps
    stats.frameMs = s.frameMs
    stats.skipped = s.skipped
  },
  onError(err) {
    lastError.value = err.message
    toast.error('模拟器运行出错：' + err.message)
    setPowered(false)
  },
  onStateChange() {
    paused.value = emulator.paused
    turbo.value = emulator.isTurbo
  },
})

// 布局设置变化 → 立即生效
watch(
  () => settings,
  () => {
    audio.setVolume(settings.volume)
    audio.setMuted(muted.value)
    emulator.turboSpeed = settings.turboSpeed
    emulator.setSoundEnabled(settings.soundEnabled)
    saveJSON(KEYS.settings, settings)
  },
  { deep: true, immediate: true },
)

watch(
  keymap,
  (v) => {
    input.setKeymap(v)
    saveJSON(KEYS.keymap, v)
  },
  { deep: true, immediate: true },
)

// ------------------------------------------------------------------ 电源

async function setPowered(on: boolean): Promise<void> {
  if (on === powered.value) return
  powered.value = on
  if (on) {
    // 关键顺序：先把模拟器跑起来，音频放最后且不阻塞。
    // 音频只是外设，任何失败/挂起都不允许推迟 ROM 装载，
    // 否则一旦自动播放策略拦下 AudioContext，就会变成
    // 「开机了、卡带也插了，但永远没有画面」。
    if (pendingRom.value) {
      startRom(pendingRom.value.name, pendingRom.value.bytes)
    } else {
      emulator.start()
    }
    input.start()
    audio.setVolume(settings.volume)
    audio.setMuted(muted.value)
    void startAudio()
  } else {
    input.stop()
    emulator.releaseAll()
    emulator.stop()
    await audio.suspend()
  }
}

/**
 * 启动音频，并在被浏览器策略拦下时给一次温和提示。
 * 绝不 await——音频永远不能拖住画面。
 */
let audioBlockedWarned = false

function startAudio(): void {
  void audio
    .start()
    .catch(() => {
      /* start() 内部已兜底，这里只是双保险 */
    })
    .then(() => {
      if (!settings.soundEnabled) return
      window.setTimeout(() => {
        if (audio.running || audioBlockedWarned) return
        audioBlockedWarned = true
        toast.info('浏览器暂未允许播放声音 · 点一下页面任意处即可恢复')
      }, 600)
    })
}

function togglePower(): void {
  void setPowered(!powered.value)
}

// ------------------------------------------------------------------ ROM

function startRom(name: string, bytes: Uint8Array): void {
  const meta = emulator.loadRom(name, bytes)
  rom.value = {
    name,
    id: meta.id,
    size: meta.size,
    mapper: meta.info.mapper,
    battery: meta.info.battery,
  }
  pendingRom.value = null
  paused.value = false
  turbo.value = false
  audio.flush()
  stats.skipped = 0
  lastError.value = null
  emulator.start()
  input.start()
  void refreshSlots(meta.id)
  void applyBattery(meta.id)
  startBatteryTimer()
}

/** 插入卡带：写入卡带库并立刻开机运行 */
async function insertRom(file: File | { name: string; bytes: Uint8Array }): Promise<void> {
  const name = file.name
  let bytes: Uint8Array
  if (file instanceof File) {
    bytes = new Uint8Array(await file.arrayBuffer())
  } else {
    bytes = file.bytes
  }

  if (bytes.length < 16 || bytes[0] !== 0x4e || bytes[1] !== 0x45 || bytes[2] !== 0x53) {
    toast.error('这不是合法的 NES 卡带文件（.nes）')
    return
  }

  try {
    if (!powered.value) await setPowered(true)
    startRom(name, bytes)
    toast.ok('已插入：' + stripExt(name))
    void rememberRom(name, bytes)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    lastError.value = msg
    emulator.eject()
    rom.value = null
    toast.error('卡带读取失败：' + msg)
  }
}

async function rememberRom(name: string, bytes: Uint8Array): Promise<void> {
  if (!storeOk.value) return
  const id = emulator.rom?.id
  if (!id) return
  try {
    await romRepo.put({
      id,
      name,
      data: bytes,
      size: bytes.length,
      addedAt: Date.now(),
      lastPlayed: Date.now(),
    })
    await refreshLibrary()
  } catch {
    storeOk.value = false
  }
}

async function playFromLibrary(item: StoredRom): Promise<void> {
  if (!powered.value) await setPowered(true)
  startRom(item.name, item.data)
  await romRepo.put({ ...item, lastPlayed: Date.now() })
  await refreshLibrary()
}

/** 加载内置试玩卡带 */
async function playBuiltin(item: BuiltinRom): Promise<void> {
  try {
    const res = await fetch(item.file)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const bytes = new Uint8Array(await res.arrayBuffer())
    await insertRom({ name: `${item.key}.nes`, bytes })
  } catch (err) {
    toast.error('内置卡带加载失败：' + (err instanceof Error ? err.message : String(err)))
  }
}

async function removeFromLibrary(id: string): Promise<void> {
  await romRepo.delete(id)
  await stateRepo.deleteByRom(id)
  await batteryRepo.delete(id)
  if (rom.value?.id === id) refreshSlots()
  await refreshLibrary()
  toast.info('已从卡带架移除')
}

function eject(): void {
  void persistBattery()
  emulator.releaseAll()
  emulator.eject()
  input.clearVirtual()
  rom.value = null
  pendingRom.value = null
  stats.fps = 0
  slots.value = []
  window.clearInterval(batteryTimer)
  batteryTimer = 0
  if (!powered.value) emulator.stop()
  toast.info('已弹出卡带')
}

function reset(): void {
  if (!rom.value) return
  emulator.reset()
  toast.info('主机已复位')
}

// ------------------------------------------------------------------ 播放控制

function togglePause(): void {
  if (!rom.value) return
  const p = emulator.togglePause()
  paused.value = p
  toast.info(p ? '已暂停' : '继续游戏')
}

function setTurbo(on: boolean, speed = settings.turboSpeed): void {
  if (turbo.value === on) return
  if (!rom.value) {
    turbo.value = false
    return
  }
  emulator.setTurbo(on, speed)
  turbo.value = emulator.isTurbo
}

function setVolume(v: number): void {
  settings.volume = Math.min(1, Math.max(0, v))
  audio.setVolume(settings.volume)
  if (settings.volume > 0 && muted.value) {
    muted.value = false
    audio.setMuted(false)
  }
}

function toggleMute(): void {
  muted.value = !muted.value
  audio.setMuted(muted.value)
  toast.info(muted.value ? '已静音' : '声音已开启')
}

// ------------------------------------------------------------------ 存档

async function refreshSlots(romId = rom.value?.id): Promise<void> {
  if (!romId || !storeOk.value) {
    slots.value = []
    return
  }
  try {
    const list = await stateRepo.byRom(romId)
    slots.value = list
  } catch {
    storeOk.value = false
  }
}

function captureThumb(): string {
  const img = emulator.captureFrame()
  if (!img) return ''
  const src = document.createElement('canvas')
  src.width = SCREEN_W
  src.height = SCREEN_H
  const sctx = src.getContext('2d')
  if (!sctx) return ''
  sctx.putImageData(img, 0, 0)
  const dst = document.createElement('canvas')
  dst.width = 96
  dst.height = 90
  const dctx = dst.getContext('2d')
  if (!dctx) return ''
  dctx.imageSmoothingEnabled = false
  dctx.drawImage(src, 0, 0, 96, 90)
  return dst.toDataURL('image/png')
}

async function saveSlot(slot: number): Promise<void> {
  const state = emulator.saveState()
  if (!state || !rom.value) {
    toast.warn('还没有插入卡带')
    return
  }
  try {
    const record: StoredState = {
      id: `${rom.value.id}#${slot}`,
      romId: rom.value.id,
      slot,
      label: stripExt(rom.value.name),
      data: JSON.stringify(state),
      thumb: captureThumb(),
      savedAt: Date.now(),
    }
    await stateRepo.put(record)
    await refreshSlots()
    toast.ok(`存档成功 · 槽位 ${slot}`)
  } catch (err) {
    toast.error('存档失败：' + (err instanceof Error ? err.message : String(err)))
  }
}

async function loadSlot(slot: number): Promise<void> {
  if (!rom.value) {
    toast.warn('还没有插入卡带')
    return
  }
  const record = await stateRepo.get(rom.value.id, slot)
  if (!record) {
    toast.warn(`槽位 ${slot} 是空的`)
    return
  }
  try {
    emulator.loadState(JSON.parse(record.data))
    if (!powered.value) await setPowered(true)
    emulator.setPaused(false)
    paused.value = false
    toast.ok(`已读取槽位 ${slot}`)
  } catch (err) {
    toast.error('读档失败：' + (err instanceof Error ? err.message : String(err)))
  }
}

async function deleteSlot(slot: number): Promise<void> {
  if (!rom.value) return
  await stateRepo.delete(rom.value.id, slot)
  await refreshSlots()
  toast.info(`已删除槽位 ${slot}`)
}

// ------------------------------------------------------------ 记忆电池

async function applyBattery(romId: string): Promise<void> {
  if (!settings.autoBattery || !storeOk.value) return
  if (!emulator.rom?.info.battery) return
  try {
    const saved = await batteryRepo.get(romId)
    if (!saved) return
    emulator.loadState(JSON.parse(saved.data))
    toast.info('记忆电池：已恢复上次进度')
  } catch {
    /* 存档损坏时忽略 */
  }
}

async function persistBattery(): Promise<void> {
  if (!settings.autoBattery || !storeOk.value) return
  if (!rom.value || !emulator.rom?.info.battery) return
  const state = emulator.saveState()
  if (!state) return
  try {
    await batteryRepo.put({
      romId: rom.value.id,
      data: JSON.stringify(state),
      savedAt: Date.now(),
    })
  } catch {
    /* 忽略 */
  }
}

function startBatteryTimer(): void {
  window.clearInterval(batteryTimer)
  batteryTimer = window.setInterval(() => void persistBattery(), 15000)
}

async function clearBattery(): Promise<void> {
  if (!rom.value) return
  await batteryRepo.delete(rom.value.id)
  toast.info('已清除本卡带的记忆电池')
}

// ------------------------------------------------------------------ 杂项

function setFrameTarget(fn: ((img: ImageData) => void) | null): void {
  frameTarget = fn
}

async function screenshot(): Promise<void> {
  const canvas = document.getElementById('nes-screen') as HTMLCanvasElement | null
  if (!canvas || !rom.value) {
    toast.warn('还没有插入卡带')
    return
  }
  const out = document.createElement('canvas')
  out.width = SCREEN_W * 3
  out.height = SCREEN_H * 3
  const ctx = out.getContext('2d')
  if (!ctx) return
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(canvas, 0, 0, out.width, out.height)
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'))
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${stripExt(rom.value.name)}-${Date.now()}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  toast.ok('画面已保存为 PNG')
}

async function toggleFullscreen(): Promise<void> {
  const el = document.getElementById('console-shell')
  if (!el) return
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await el.requestFullscreen()
    }
  } catch (err) {
    toast.warn('全屏被浏览器拒绝：' + (err instanceof Error ? err.message : String(err)))
  }
}

function resetKeymap(): void {
  const def = structuredClone(DEFAULT_KEYMAP)
  for (const p of [1, 2] as PlayerId[]) {
    for (const b of Object.keys(def[p]) as ButtonName[]) {
      keymap[p][b] = def[p][b]
    }
  }
  toast.info('按键映射已恢复默认')
}

async function refreshLibrary(): Promise<void> {
  if (!storeOk.value) return
  try {
    library.value = await romRepo.all()
  } catch {
    storeOk.value = false
  }
  libraryReady.value = true
}

async function initStorage(): Promise<void> {
  storeOk.value = await storageAvailable()
  if (!storeOk.value) {
    toast.warn('本地存储不可用，存档与卡带架功能已停用')
    return
  }
  await refreshLibrary()
}

function pressVirtual(player: PlayerId, button: ButtonName, pressed: boolean): void {
  input.setVirtual(player, button, pressed)
}

/** 暂时屏蔽键盘操作模拟器（打开设置弹窗时用） */
function setInputEnabled(v: boolean): void {
  input.enabled = v
  if (!v) input.clearVirtual()
}

function captureKey(): Promise<string> {
  return input.captureKey()
}

/**
 * 在第一次用户交互时就把 AudioContext 建好。
 * 浏览器自动播放策略只允许在用户手势里创建/恢复音频上下文，
 * 提前做好可以避免「异步加载 ROM 之后再开机」时音频被拒绝。
 */
let audioPrimed = false
function primeAudio(): void {
  if (audioPrimed) return
  audioPrimed = true
  void audio.start().catch(() => {
    audioPrimed = false
  })
}

function cancelCapture(): void {
  input.cancelCapture()
}

function clearBinding(player: PlayerId, button: ButtonName, index: number): void {
  const codes = keymap[player][button]
  if (!codes) return
  if (codes.length <= 1) {
    keymap[player][button] = ['']
    return
  }
  keymap[player][button] = codes.filter((_, i) => i !== index)
}

function setBinding(player: PlayerId, button: ButtonName, index: number, code: string): void {
  const codes = [...(keymap[player][button] ?? [''])]
  while (codes.length <= index) codes.push('')
  codes[index] = code
  keymap[player][button] = codes
}

export function useConsole() {
  return {
    // 状态
    settings,
    keymap,
    powered,
    paused,
    turbo,
    muted,
    rom,
    padState,
    gamepads,
    stats,
    slots,
    library,
    libraryReady,
    storeOk,
    lastError,
    isRunning: computed(() => powered.value && !!rom.value && !paused.value),

    // 操作
    togglePower,
    insertRom,
    playFromLibrary,
    playBuiltin,
    removeFromLibrary,
    eject,
    reset,
    togglePause,
    setTurbo,
    setVolume,
    toggleMute,
    saveSlot,
    loadSlot,
    deleteSlot,
    clearBattery,
    setFrameTarget,
    toggleFullscreen,
    screenshot,
    resetKeymap,
    pressVirtual,
    setInputEnabled,
    captureKey,
    primeAudio,
    cancelCapture,
    clearBinding,
    setBinding,
    initStorage,
    refreshLibrary,
    refreshSlots,
    persistBattery,
  }
}

/**
 * 页面生命周期钩子：
 * - 切走标签页时暂停模拟并挂起音频，回来再自动恢复（避免「回来发现跑了很远」）
 * - 页面隐藏 / 关闭时把记忆电池落盘
 */
let autoPaused = false

export function installLifecycleHooks(): void {
  const onHidden = () => {
    void persistBattery()
    if (rom.value && !emulator.paused) {
      autoPaused = true
      emulator.setPaused(true)
      paused.value = true
    }
    void audio.suspend()
  }

  const onVisible = () => {
    if (autoPaused) {
      autoPaused = false
      emulator.setPaused(false)
      paused.value = false
    }
    if (powered.value) void audio.start()
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) onHidden()
    else onVisible()
  })
  window.addEventListener('pagehide', () => void persistBattery())
}
