/**
 * 输入管理：物理键盘 + 浏览器手柄 → NES 手柄按键
 *
 * 设计：多个来源（键盘 / 手柄 / 鼠标点虚拟手柄）各自产生「按下的逻辑键集合」，
 * 合并后与上一帧对比，把差量转成 jsnes 的 buttonDown / buttonUp 调用。
 */
import {
  DEFAULT_KEYMAP,
  PREVENT_DEFAULT_CODES,
  type ButtonName,
  type Keymap,
  type PlayerId,
} from './constants'

export interface PadSnapshot {
  1: ButtonName[]
  2: ButtonName[]
}

export interface GamepadInfo {
  index: number
  id: string
}

export type HotkeyName =
  | 'pause'
  | 'mute'
  | 'turbo-on'
  | 'turbo-off'
  | 'fullscreen'
  | 'quick-save'
  | 'quick-load'
  | 'escape'

export interface InputHandlers {
  /** 某个逻辑键状态变化 */
  onButton: (player: PlayerId, button: ButtonName, pressed: boolean) => void
  /** 全局快捷键 */
  onHotkey?: (name: HotkeyName) => void
  /** 合并后的按键状态变化，用于驱动 UI 手柄高亮 */
  onChange?: (snapshot: PadSnapshot) => void
  /** 手柄接入 / 拔出 */
  onGamepads?: (pads: GamepadInfo[]) => void
}

/** 标准 Gamepad 映射表（XInput 布局） */
const PAD_BUTTON_MAP: Record<number, ButtonName> = {
  0: 'A',
  1: 'B',
  2: 'TURBO_A',
  3: 'TURBO_B',
  8: 'SELECT',
  9: 'START',
  12: 'UP',
  13: 'DOWN',
  14: 'LEFT',
  15: 'RIGHT',
}

const STICK_DEADZONE = 0.45
const EMPTY: string[] = []
const PLAYERS: PlayerId[] = [1, 2]

export class InputManager {
  keymap: Keymap
  /** 是否把键盘事件交给模拟器（弹窗打开时可临时关闭） */
  enabled = true

  private handlers: InputHandlers

  /** 键盘按下的物理键 code */
  private keyDown = new Set<string>()
  /** 手柄按下的逻辑键 */
  private padDown: Record<PlayerId, Set<ButtonName>> = {
    1: new Set(),
    2: new Set(),
  }
  /** 鼠标点虚拟手柄时按下的逻辑键 */
  private virtualDown: Record<PlayerId, Set<ButtonName>> = {
    1: new Set(),
    2: new Set(),
  }
  /** 已经同步给模拟器的按键 */
  private applied: Record<PlayerId, Set<ButtonName>> = {
    1: new Set(),
    2: new Set(),
  }

  private rafId = 0
  private running = false
  private capturing: ((code: string) => void) | null = null
  private turboHeld = false
  private lastPadKey = ''

  gamepads: GamepadInfo[] = []

  constructor(handlers: InputHandlers) {
    this.handlers = handlers
    this.keymap = structuredClone(DEFAULT_KEYMAP)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    document.addEventListener('visibilitychange', this.onVisibility)
    window.addEventListener('gamepadconnected', this.onGamepadChange)
    window.addEventListener('gamepaddisconnected', this.onGamepadChange)
  }

  // ---------------------------------------------------------------- 生命周期

  start(): void {
    if (this.running) return
    this.running = true
    this.rafId = requestAnimationFrame(this.poll)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
    this.clearAll()
  }

  dispose(): void {
    this.stop()
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    document.removeEventListener('visibilitychange', this.onVisibility)
    window.removeEventListener('gamepadconnected', this.onGamepadChange)
    window.removeEventListener('gamepaddisconnected', this.onGamepadChange)
  }

  setKeymap(map: Keymap): void {
    this.keymap = map
    this.recompute()
  }

  /** 进入「按键捕获」模式，返回按下的物理键 code */
  captureKey(): Promise<string> {
    return new Promise((resolve) => {
      this.capturing = resolve
    })
  }

  cancelCapture(): void {
    this.capturing = null
  }

  // ---------------------------------------------------------------- 虚拟手柄

  setVirtual(player: PlayerId, button: ButtonName, pressed: boolean): void {
    const set = this.virtualDown[player]
    if (pressed) set.add(button)
    else set.delete(button)
    if (this.applyState(player)) this.emitChange()
  }

  clearVirtual(): void {
    for (const p of PLAYERS) this.virtualDown[p].clear()
    this.recompute()
  }

  // ---------------------------------------------------------------- 键盘

  private isTypingTarget(): boolean {
    const el = document.activeElement as HTMLElement | null
    if (!el) return false
    const tag = el.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.capturing) {
      e.preventDefault()
      const resolve = this.capturing
      this.capturing = null
      resolve(e.code)
      return
    }
    if (e.key === 'Escape') {
      this.handlers.onHotkey?.('escape')
      return
    }
    if (this.isTypingTarget()) return
    if (e.metaKey || e.ctrlKey || e.altKey) return

    if (e.code === 'Tab') e.preventDefault()

    if (!e.repeat) {
      switch (e.code) {
        case 'KeyP':
          e.preventDefault()
          this.handlers.onHotkey?.('pause')
          return
        case 'KeyM':
          e.preventDefault()
          this.handlers.onHotkey?.('mute')
          return
        case 'KeyF':
          e.preventDefault()
          this.handlers.onHotkey?.('fullscreen')
          return
        case 'F5':
          e.preventDefault()
          this.handlers.onHotkey?.('quick-save')
          return
        case 'F8':
          e.preventDefault()
          this.handlers.onHotkey?.('quick-load')
          return
        case 'Tab':
          this.setTurbo(true)
          break
      }
    }

    if (PREVENT_DEFAULT_CODES.has(e.code)) e.preventDefault()
    if (e.repeat) return
    this.keyDown.add(e.code)
    if (this.enabled) this.recompute()
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    if (this.capturing) return
    if (e.code === 'Tab') this.setTurbo(false)
    if (!this.keyDown.delete(e.code)) return
    if (this.enabled) this.recompute()
  }

  private setTurbo(on: boolean): void {
    if (this.turboHeld === on) return
    this.turboHeld = on
    this.handlers.onHotkey?.(on ? 'turbo-on' : 'turbo-off')
  }

  private onBlur = (): void => {
    this.setTurbo(false)
    this.clearAll()
  }

  private onVisibility = (): void => {
    if (document.hidden) this.onBlur()
  }

  /**
   * 清空所有输入状态。
   * 注意必须把已经同步给模拟器的按键逐个「松开」，
   * 否则切走标签页再回来会出现方向键卡住的问题。
   */
  private clearAll(): void {
    this.keyDown.clear()
    for (const p of PLAYERS) {
      this.padDown[p].clear()
      this.virtualDown[p].clear()
      for (const b of Array.from(this.applied[p])) {
        this.applied[p].delete(b)
        this.handlers.onButton(p, b, false)
      }
    }
    this.emitChange()
  }

  // ---------------------------------------------------------------- 手柄

  private onGamepadChange = (): void => {
    this.gamepads = this.readPads()
    this.handlers.onGamepads?.(this.gamepads)
  }

  private readPads(): GamepadInfo[] {
    if (typeof navigator.getGamepads !== 'function') return []
    const out: GamepadInfo[] = []
    for (const g of Array.from(navigator.getGamepads())) {
      if (g && g.connected) out.push({ index: g.index, id: g.id })
    }
    return out
  }

  private poll = (): void => {
    if (!this.running) return
    this.rafId = requestAnimationFrame(this.poll)

    const pads = Array.from(navigator.getGamepads?.() ?? []).filter(
      (g): g is Gamepad => !!g && g.connected,
    )
    const key = pads.map((p) => p.index + ':' + p.id).join('|')
    if (key !== this.lastPadKey) {
      this.lastPadKey = key
      this.gamepads = pads.map((p) => ({ index: p.index, id: p.id }))
      this.handlers.onGamepads?.(this.gamepads)
    }

    const next: Record<PlayerId, Set<ButtonName>> = { 1: new Set(), 2: new Set() }
    let turboFromPad = false

    pads.slice(0, 2).forEach((pad, idx) => {
      const player = (idx + 1) as PlayerId
      for (const [indexStr, name] of Object.entries(PAD_BUTTON_MAP)) {
        const btn = pad.buttons[Number(indexStr)]
        if (btn && (btn.pressed || btn.value > 0.5)) next[player].add(name)
      }
      const ax = pad.axes[0] ?? 0
      const ay = pad.axes[1] ?? 0
      if (ax < -STICK_DEADZONE) next[player].add('LEFT')
      if (ax > STICK_DEADZONE) next[player].add('RIGHT')
      if (ay < -STICK_DEADZONE) next[player].add('UP')
      if (ay > STICK_DEADZONE) next[player].add('DOWN')

      const lb = pad.buttons[4]
      if (player === 1 && lb && (lb.pressed || lb.value > 0.5)) turboFromPad = true
    })

    this.setTurbo(turboFromPad)

    let changed = false
    for (const p of PLAYERS) {
      changed = this.diffSet(this.padDown[p], next[p]) || changed
      this.padDown[p] = next[p]
    }
    if (changed) {
      for (const p of PLAYERS) this.applyState(p)
      this.emitChange()
    }
  }

  private diffSet(a: Set<ButtonName>, b: Set<ButtonName>): boolean {
    if (a.size !== b.size) return true
    for (const v of b) if (!a.has(v)) return true
    return false
  }

  // ---------------------------------------------------------------- 合并

  private recompute(): void {
    let changed = false
    for (const p of PLAYERS) changed = this.applyState(p) || changed
    if (changed) this.emitChange()
  }

  private applyState(player: PlayerId): boolean {
    const source = new Set<ButtonName>()
    const map = this.keymap[player]
    for (const name of Object.keys(map) as ButtonName[]) {
      const codes = map[name] ?? EMPTY
      if (codes.some((c) => this.keyDown.has(c))) source.add(name)
    }
    for (const b of this.padDown[player]) source.add(b)
    for (const b of this.virtualDown[player]) source.add(b)

    const applied = this.applied[player]
    let changed = false
    for (const b of source) {
      if (!applied.has(b)) {
        applied.add(b)
        this.handlers.onButton(player, b, true)
        changed = true
      }
    }
    for (const b of Array.from(applied)) {
      if (!source.has(b)) {
        applied.delete(b)
        this.handlers.onButton(player, b, false)
        changed = true
      }
    }
    return changed
  }

  private emitChange(): void {
    this.handlers.onChange?.(this.snapshot())
  }

  snapshot(): PadSnapshot {
    return {
      1: Array.from(this.applied[1]),
      2: Array.from(this.applied[2]),
    }
  }
}
