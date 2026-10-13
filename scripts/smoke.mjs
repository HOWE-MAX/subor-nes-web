/**
 * 内核联调冒烟测试（Node 环境，不依赖浏览器）
 * 验证：jsnes 2.x 的 NES API、ROM 装载、帧生成、音频回调、快照往返。
 * 运行：node .tmp/smoke.mjs
 */
import { NES, Controller } from 'jsnes'
import fs from 'node:fs'

function parseInes(bytes) {
  const valid =
    bytes[0] === 0x4e && bytes[1] === 0x45 && bytes[2] === 0x53 && bytes[3] === 0x1a
  const b6 = bytes[6]
  const b7 = bytes[7]
  const b9 = bytes[9] ?? 0
  const b4 = bytes[4] ?? 0
  return {
    valid,
    mapper: (b6 >> 4) | (b7 & 0xf0),
    prgSize: ((b9 & 0x0f) || (b4 & 0x0f)) * 16384,
    chrSize: (((b9 >> 4) & 0x0f) || ((b4 >> 4) & 0x0f)) * 8192,
    battery: (b6 & 2) !== 0,
    region: (b9 & 1) === 0 ? 'ntsc' : 'pal',
  }
}

const roms = ['public/roms/lj65.nes', 'public/roms/croom.nes']

for (const file of roms) {
  const raw = new Uint8Array(fs.readFileSync(file))
  const info = parseInes(raw)
  console.log('\n=== ' + file + ' ===')
  console.log('size      :', raw.length, 'bytes')
  console.log('header    :', {
    valid: info.valid,
    mapper: info.mapper,
    prg: info.prgSize,
    chr: info.chrSize,
    battery: info.battery,
    region: info.region,
  })

  let frames = 0
  let audio = 0
  let lastBuffer = null

  const nes = new NES({
    onFrame(buf) {
      frames++
      lastBuffer = buf
    },
    onAudioSample() {
      audio++
    },
    sampleRate: 44100,
    emulateSound: true,
  })

  nes.loadROM(raw)

  // 按住 START 一小会儿，模拟真实输入通路
  nes.buttonDown(1, Controller.BUTTON_START)
  for (let i = 0; i < 180; i++) {
    nes.frame()
    if (i === 30) nes.buttonUp(1, Controller.BUTTON_START)
  }

  if (!lastBuffer) throw new Error('onFrame 没有被回调')
  if (lastBuffer.length !== 256 * 240) {
    throw new Error(`帧缓冲长度异常：${lastBuffer.length}`)
  }

  // 统计不同颜色数量，确认画面不是一片纯色
  const colors = new Set()
  for (let i = 0; i < lastBuffer.length; i += 17) colors.add(lastBuffer[i])

  console.log('frames    :', frames)
  console.log('audio smp :', audio, `(${(audio / frames).toFixed(1)} / 帧)`)
  console.log('colors    :', colors.size, '种不同颜色')
  console.log('fps(内核) :', nes.getFPS())

  if (colors.size < 3) throw new Error('画面疑似全黑/纯色，渲染链路可能断了')
  if (frames !== 180) throw new Error(`期望 180 帧，实际 ${frames}`)
  if (audio < 180 * 700) throw new Error('音频采样数量偏少')

  // 快照往返
  const snap = nes.toJSON()
  const json = JSON.stringify(snap)
  const restored = JSON.parse(json)
  nes.fromJSON(restored)
  for (let i = 0; i < 30; i++) nes.frame()
  console.log('snapshot  : ok,', (json.length / 1024).toFixed(0), 'KB JSON')

  // 复位（走 reloadROM）
  nes.reloadROM()
  for (let i = 0; i < 60; i++) nes.frame()
  console.log('reset     : ok')

  // 装机后立刻读档（记忆电池路径）
  const nes2 = new NES({ onFrame() {}, onAudioSample() {}, sampleRate: 44100 })
  nes2.loadROM(raw)
  for (let i = 0; i < 40; i++) nes2.frame()
  const snap2 = JSON.parse(JSON.stringify(nes2.toJSON()))
  const nes3 = new NES({ onFrame() {}, onAudioSample() {}, sampleRate: 44100 })
  nes3.loadROM(raw)
  nes3.fromJSON(snap2)
  for (let i = 0; i < 90; i++) nes3.frame()
  console.log('battery   : ok（装机即读档）')
}

console.log('\n全部通过 ✔')
