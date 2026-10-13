/**
 * 常量与类型定义
 * 内核：jsnes（开源 NES 模拟器，MIT）
 */
import { Controller, type ButtonKey } from 'jsnes'

export type PlayerId = 1 | 2

/** 逻辑按键名（用于按键映射与 UI） */
export type ButtonName =
  | 'UP'
  | 'DOWN'
  | 'LEFT'
  | 'RIGHT'
  | 'A'
  | 'B'
  | 'TURBO_A'
  | 'TURBO_B'
  | 'START'
  | 'SELECT'

/** 逻辑按键 → jsnes Controller 常量 */
export const BUTTON_CODE: Record<ButtonName, ButtonKey> = {
  A: Controller.BUTTON_A,
  B: Controller.BUTTON_B,
  SELECT: Controller.BUTTON_SELECT,
  START: Controller.BUTTON_START,
  UP: Controller.BUTTON_UP,
  DOWN: Controller.BUTTON_DOWN,
  LEFT: Controller.BUTTON_LEFT,
  RIGHT: Controller.BUTTON_RIGHT,
  TURBO_A: Controller.BUTTON_TURBO_A,
  TURBO_B: Controller.BUTTON_TURBO_B,
}

/** 手柄面板上按键的展示顺序 */
export const PAD_BUTTONS: ButtonName[] = [
  'UP',
  'DOWN',
  'LEFT',
  'RIGHT',
  'A',
  'B',
  'TURBO_A',
  'TURBO_B',
  'START',
  'SELECT',
]

export const BUTTON_LABEL: Record<ButtonName, string> = {
  UP: '上',
  DOWN: '下',
  LEFT: '左',
  RIGHT: '右',
  A: 'A 键',
  B: 'B 键',
  TURBO_A: '连发 A',
  TURBO_B: '连发 B',
  START: 'START',
  SELECT: 'SELECT',
}

/** 每个按键默认支持两个键位（主 / 副） */
export type Keymap = Record<PlayerId, Record<ButtonName, string[]>>

export const DEFAULT_KEYMAP: Keymap = {
  1: {
    UP: ['ArrowUp', 'KeyW'],
    DOWN: ['ArrowDown', 'KeyS'],
    LEFT: ['ArrowLeft', 'KeyA'],
    RIGHT: ['ArrowRight', 'KeyD'],
    A: ['KeyZ', 'KeyJ'],
    B: ['KeyX', 'KeyK'],
    TURBO_A: ['KeyC'],
    TURBO_B: ['KeyV'],
    START: ['Enter'],
    SELECT: ['ShiftRight'],
  },
  2: {
    UP: ['KeyI'],
    DOWN: ['KeyK'],
    LEFT: ['KeyJ'],
    RIGHT: ['KeyL'],
    A: ['KeyN'],
    B: ['KeyM'],
    TURBO_A: ['Comma'],
    TURBO_B: ['Period'],
    START: ['Digit1'],
    SELECT: ['Digit2'],
  },
}

/** 键盘 code → 展示文案 */
const CODE_LABEL: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Enter: 'Enter',
  Space: '空格',
  ShiftLeft: '左 Shift',
  ShiftRight: '右 Shift',
  ControlLeft: '左 Ctrl',
  ControlRight: '右 Ctrl',
  AltLeft: '左 Alt',
  AltRight: '右 Alt',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Numpad0: '小键盘 0',
  Numpad1: '小键盘 1',
  Numpad2: '小键盘 2',
  Numpad3: '小键盘 3',
  Numpad4: '小键盘 4',
  Numpad5: '小键盘 5',
  Numpad6: '小键盘 6',
  Numpad7: '小键盘 7',
  Numpad8: '小键盘 8',
  Numpad9: '小键盘 9',
  NumpadEnter: '小键盘 Enter',
  Tab: 'Tab',
  CapsLock: 'Caps',
}

export function keyLabel(code: string): string {
  if (!code) return '未设置'
  if (CODE_LABEL[code]) return CODE_LABEL[code]
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return '小键盘 ' + code.slice(6)
  return code
}

/** 全局快捷键说明 */
export const HOTKEYS: { keys: string; desc: string }[] = [
  { keys: 'P', desc: '暂停 / 继续' },
  { keys: 'M', desc: '静音开关' },
  { keys: 'Tab', desc: '按住快进' },
  { keys: 'F', desc: '全屏切换' },
  { keys: 'F5', desc: '快速存档（槽位 5）' },
  { keys: 'F8', desc: '快速读档（槽位 5）' },
  { keys: 'Esc', desc: '退出全屏 / 关闭弹窗' },
]

/** 需要阻止浏览器默认行为的按键（避免空格滚动、Tab 切焦点等） */
export const PREVENT_DEFAULT_CODES = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'Tab',
  'Enter',
  'F5',
  'F8',
])

export const SCREEN_W = 256
export const SCREEN_H = 240

/** NTSC 帧率 */
export const FPS_NTSC = 60.0988
export const FRAME_MS = 1000 / FPS_NTSC

export const SAVE_SLOT_COUNT = 5
