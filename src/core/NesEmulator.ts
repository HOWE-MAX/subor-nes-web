/**
 * NES 模拟器封装
 *
 * 内核直接使用开源库 jsnes（MIT License, https://github.com/bfirsh/jsnes），
 * 本文件只负责：帧循环调度、音频/画面回调转发、ROM 装载、快照存取。
 */
import { NES, type EmulatorData } from 'jsnes'
import { AudioEngine } from './AudioEngine'
import {
  BUTTON_CODE,
  FRAME_MS,
  SCREEN_H,
  SCREEN_W,
  type ButtonName,
  type PlayerId,
} from './constants'
import { hashRom, parseInesHeader, type RomInfo } from './rom'

export interface EmulatorEvents {
  /** 每渲染一帧（256×240 ARGB → ImageData） */
  onFrame?: (frame: ImageData) => void
  /** 每秒一次的性能统计 */
  onStats?: (stats: EmulatorStats) => void
  /** 运行期错误 */
  onError?: (err: Error) => void
  /** 状态位变化 */
  onStateChange?: () => void
}

export interface EmulatorStats {
  fps: number
  frameMs: number
  speed: number
  skipped: number
}

export interface RomMeta {
  name: string
  id: string
  size: number
  info: RomInfo
}

/** 音频缓冲水位：低于 LOW 补帧，高于 HIGH 丢帧 */
const WATER_LOW = 0.025
const WATER_HIGH = 0.32
/** 单帧最多补多少个模拟帧，防止卡顿后暴走 */
const MAX_STEPS = 6

export class NesEmulator {
  readonly audio: AudioEngine
  private events: EmulatorEvents

  private nes: NES | null = null
  private rafId = 0
  private lastTs = 0
  private acc = 0
  private looping = false

  private imgData: ImageData | null = null

  /** 暂停（画面冻结但保持通电） */
  paused = false
  /** 快进倍速，1 表示正常 */
  turboSpeed = 3
  private turbo = false
  private preTurboMute = false

  /** 音效总开关 */
  soundEnabled = true

  rom: RomMeta | null = null

  // 性能统计
  private fpsCounter = 0
  private fpsWindow = 0
  private fps = 0
  private frameCost = 0
  private skipped = 0

  constructor(audio: AudioEngine, events: EmulatorEvents = {}) {
    this.audio = audio
    this.events = events
  }

  get ready(): boolean {
    return this.nes !== null
  }

  get isTurbo(): boolean {
    return this.turbo
  }

  get nesInstance(): NES | null {
    return this.nes
  }

  setEvents(events: EmulatorEvents): void {
    this.events = { ...this.events, ...events }
  }

  // ------------------------------------------------------------ ROM

  /** 装载 ROM；失败会抛错，由调用方捕获展示 */
  loadRom(name: string, bytes: Uint8Array): RomMeta {
    const info = parseInesHeader(bytes)
    const nes = new NES({
      onFrame: this.handleFrame,
      onAudioSample: this.handleAudioSample,
      sampleRate: this.audio.sampleRate,
      emulateSound: true,
      onStatusUpdate: () => {},
    })
    nes.loadROM(bytes)

    this.stop()
    this.audio.flush()
    this.nes = nes
    this.paused = false
    this.turbo = false
    this.imgData = null
    this.acc = 0
    this.lastTs = 0
    this.skipped = 0
    this.rom = { name, id: hashRom(bytes), size: bytes.length, info }
    // 注意：不要在这里调用 nes.reset()。
    // jsnes 2.x 的 loadROM() 内部已完成 reset + mapper 装载，
    // 而单独调用 reset() 不会执行 mmap.loadROM()，会让 CPU 内存映射失效。
    this.events.onStateChange?.()
    return this.rom
  }

  /** 拔卡：停掉循环、清空实例 */
  eject(): void {
    this.stop()
    this.audio.flush()
    this.nes = null
    this.rom = null
    this.imgData = null
    this.events.onStateChange?.()
  }

  /**
   * 软复位。
   * jsnes 2.x 的 NES#reset() 只重建 CPU/PPU/PAPU 与 mapper 实例，
   * 不会调用 mmap.loadROM()，单独使用会导致 CPU 读到错误 opcode 而崩溃。
   * 因此这里走 reloadROM()，它内部是完整的「重新装载」流程。
   */
  reset(): void {
    const nes = this.nes
    if (!nes) return
    nes.reloadROM()
    this.audio.flush()
    this.acc = 0
    this.lastTs = 0
  }

  // ------------------------------------------------------------ 循环

  start(): void {
    if (this.looping) return
    this.looping = true
    this.lastTs = 0
    this.rafId = requestAnimationFrame(this.loop)
    this.events.onStateChange?.()
  }

  stop(): void {
    if (!this.looping) return
    this.looping = false
    cancelAnimationFrame(this.rafId)
    this.events.onStateChange?.()
  }

  get running(): boolean {
    return this.looping
  }

  setPaused(v: boolean): void {
    if (this.paused === v) return
    this.paused = v
    if (!v) {
      this.lastTs = 0
      this.acc = 0
    }
    this.events.onStateChange?.()
  }

  togglePause(): boolean {
    this.setPaused(!this.paused)
    return this.paused
  }

  setTurbo(on: boolean, speed = this.turboSpeed): void {
    if (this.turbo === on) return
    this.turbo = on
    this.turboSpeed = speed
    if (on) {
      // 快进时音频会失真，直接静音；松开后恢复
      this.preTurboMute = this.audio.muted
      this.audio.setMuted(true)
      this.audio.flush()
    } else {
      this.audio.setMuted(this.preTurboMute)
    }
    this.events.onStateChange?.()
  }

  setSoundEnabled(on: boolean): void {
    this.soundEnabled = on
    if (!on) this.audio.setMuted(true)
    else if (!this.turbo) this.audio.setMuted(false)
  }

  private loop = (ts: number): void => {
    if (!this.looping) return
    this.rafId = requestAnimationFrame(this.loop)

    const nes = this.nes
    if (!nes) return

    if (this.lastTs === 0) {
      this.lastTs = ts
      return
    }

    let delta = ts - this.lastTs
    this.lastTs = ts
    if (delta > 250) delta = 250 // 切走标签页再回来，别一次性补上百帧
    if (delta < 0) delta = 0

    if (this.paused) {
      this.acc = 0
      return
    }

    const speed = this.turbo ? this.turboSpeed : 1
    this.acc += delta * speed

    let steps = Math.floor(this.acc / FRAME_MS)
    this.acc -= steps * FRAME_MS

    // 音频时钟校正：缓冲见底就抢先跑一帧，积压太多就歇一帧
    const audioClock = this.soundEnabled && !this.turbo && this.audio.running
    if (audioClock) {
      const buffered = this.audio.bufferedSeconds
      if (buffered > WATER_HIGH) steps = 0
      else if (buffered < WATER_LOW && steps < 1) steps = 1
    }

    if (steps > MAX_STEPS) {
      this.skipped += steps - MAX_STEPS
      steps = MAX_STEPS
    }

    if (steps > 0) {
      const t0 = performance.now()
      try {
        for (let i = 0; i < steps; i++) nes.frame()
      } catch (err) {
        this.stop()
        this.events.onError?.(err instanceof Error ? err : new Error(String(err)))
        return
      }
      this.frameCost = performance.now() - t0

      this.fpsCounter++
      this.fpsWindow += delta
      if (this.fpsWindow >= 500) {
        this.fps = (this.fpsCounter * 1000) / this.fpsWindow
        this.fpsCounter = 0
        this.fpsWindow = 0
        this.events.onStats?.({
          fps: this.fps,
          frameMs: this.frameCost,
          speed,
          skipped: this.skipped,
        })
      }
    }
  }

  // ------------------------------------------------------------ 回调

  private handleFrame = (buffer: Uint32Array): void => {
    if (!this.imgData) {
      this.imgData = new ImageData(SCREEN_W, SCREEN_H)
    }
    const view = new Uint8Array(buffer.buffer, buffer.byteOffset, SCREEN_W * SCREEN_H * 4)
    this.imgData.data.set(view)
    this.events.onFrame?.(this.imgData)
  }

  private handleAudioSample = (left: number, right: number): void => {
    if (!this.soundEnabled) return
    this.audio.push(left, right)
  }

  // ------------------------------------------------------------ 输入

  buttonDown(player: PlayerId, button: ButtonName): void {
    this.nes?.buttonDown(player, BUTTON_CODE[button])
  }

  buttonUp(player: PlayerId, button: ButtonName): void {
    this.nes?.buttonUp(player, BUTTON_CODE[button])
  }

  releaseAll(): void {
    const nes = this.nes
    if (!nes) return
    for (const p of [1, 2] as PlayerId[]) {
      for (const btn of Object.keys(BUTTON_CODE) as ButtonName[]) {
        nes.buttonUp(p, BUTTON_CODE[btn])
      }
    }
  }

  // ------------------------------------------------------------ 快照

  saveState(): EmulatorData | null {
    return this.nes ? this.nes.toJSON() : null
  }

  loadState(data: EmulatorData): void {
    if (!this.nes) return
    this.nes.fromJSON(data)
    this.audio.flush()
    this.acc = 0
  }

  /** 直接取当前帧的 RGBA 像素（用于生成缩略图） */
  captureFrame(): ImageData | null {
    return this.imgData
  }

  dispose(): void {
    this.stop()
    this.audio.dispose()
    this.nes = null
  }
}
