/**
 * iNES / NES 2.0 卡带头解析、ROM 指纹、字节格式化
 */

export interface RomInfo {
  /** 是否合法 iNES 文件 */
  valid: boolean
  /** 卡带映射器编号 */
  mapper: number
  /** PRG-ROM 字节数 */
  prgSize: number
  /** CHR-ROM 字节数（0 表示使用 CHR-RAM） */
  chrSize: number
  /** 是否带电池记忆（存档芯片） */
  battery: boolean
  /** 是否含 trainer */
  trainer: boolean
  /** 1 = 垂直镜像，0 = 水平镜像 */
  mirroring: number
  /** 是否四屏 VRAM */
  fourScreen: boolean
  /** 是否 NES 2.0 格式 */
  nes2: boolean
  /** 制式：ntsc / pal / multi */
  region: 'ntsc' | 'pal' | 'multi'
}

export const ROM_MAGIC = [0x4e, 0x45, 0x53, 0x1a]

export function isNesRom(bytes: Uint8Array): boolean {
  if (bytes.length < 16) return false
  return ROM_MAGIC.every((b, i) => bytes[i] === b)
}

export function parseInesHeader(bytes: Uint8Array): RomInfo {
  const info: RomInfo = {
    valid: isNesRom(bytes),
    mapper: 0,
    prgSize: 0,
    chrSize: 0,
    battery: false,
    trainer: false,
    mirroring: 0,
    fourScreen: false,
    nes2: false,
    region: 'ntsc',
  }
  if (!info.valid) return info

  const b6 = bytes[6]
  const b7 = bytes[7]
  const b4 = bytes[4] ?? 0
  const b5 = bytes[5] ?? 0
  const b9 = bytes[9] ?? 0

  info.mirroring = b6 & 1 ? 1 : 0
  info.battery = (b6 & 0x02) !== 0
  info.trainer = (b6 & 0x04) !== 0
  info.fourScreen = (b6 & 0x08) !== 0
  info.nes2 = (b7 & 0x0c) === 0x08

  const prgBanks = b9 & 0x0f
  const chrBanks = (b9 >> 4) & 0x0f

  if (info.nes2) {
    info.mapper = (b6 >> 4) | (b7 & 0xf0) | (((bytes[8] ?? 0) & 0x0f) << 8)
    info.prgSize = (prgBanks === 0x0f ? 1 : prgBanks) * 16384
    info.chrSize = (chrBanks === 0x0f ? 1 : chrBanks) * 8192
    const timing = (bytes[12] ?? 0) & 3
    info.region = timing === 0 ? 'ntsc' : timing === 1 ? 'pal' : 'multi'
  } else {
    // iNES 1.0：byte9 的高/低半字节是 MSB，byte4 / byte5 是实际银行数
    info.mapper = (b6 >> 4) | (b7 & 0xf0)
    info.prgSize = ((prgBanks << 8) | b4) * 16384
    info.chrSize = ((chrBanks << 8) | b5) * 8192
    info.region = (b9 & 1) === 0 ? 'ntsc' : 'pal'
  }

  // 兜底：容量字段不可信时按实际文件长度估算
  if (info.prgSize === 0 && bytes.length > 16) {
    info.prgSize = bytes.length - 16
  }

  return info
}

/** FNV-1a 32 位哈希，用作 ROM 指纹（存在牌库里识别同一款游戏） */
export function hashRom(bytes: Uint8Array): string {
  let h = 0x811c9dc5
  // 大 ROM 全量哈希会慢，采样：头部 + 尾部 + 中段
  const step = bytes.length > 0x40000 ? 7 : 1
  for (let i = 0; i < bytes.length; i += step) {
    h ^= bytes[i]
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0') + '-' + bytes.length.toString(16)
}

export function formatBytes(n: number): string {
  if (n <= 0) return '—'
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(n % (1024 * 1024) ? 2 : 0) + ' MB'
  return Math.round(n / 1024) + ' KB'
}

/** 从文件名里去掉扩展名 */
export function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}
