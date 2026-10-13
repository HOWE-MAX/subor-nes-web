/**
 * 音频输出引擎
 *
 * jsnes 每模拟一帧会回调 44100/60 ≈ 734 个采样点（左右声道）。
 * 这里把它们写进一个环形缓冲区，由 ScriptProcessorNode 按音频时钟取走播放，
 * 环形缓冲区同时充当「防抖水库」——主循环落后时补帧、超前时丢帧。
 */

const BUFFER_SECONDS = 1.5
const PROCESSOR_FRAME = 2048
/**
 * resume() 的最长等待时间。
 * 浏览器自动播放策略会把没有用户手势的 AudioContext 一直压在 suspended 状态，
 * 此时 resume() 返回的 Promise **永远不会 settle**，必须自己加超时兜底。
 */
const RESUME_TIMEOUT = 350

export class AudioEngine {
  readonly sampleRate: number
  private ctx: AudioContext | null = null
  private source: ScriptProcessorNode | null = null
  private gainNode: GainNode | null = null

  /** 立体声交错环形缓冲：L,R,L,R... */
  private ring: Float32Array
  private capacity: number
  private writePtr = 0
  private readPtr = 0
  private filled = 0

  private _volume = 0.7
  private _muted = false
  private lastL = 0
  private lastR = 0

  /** 音频彻底不可用（无 AudioContext / 构造失败），此后不再重试 */
  private failed = false

  /** 统计：累计欠载次数 */
  underruns = 0

  constructor(sampleRate = 44100) {
    this.sampleRate = sampleRate
    this.capacity = Math.floor(sampleRate * BUFFER_SECONDS) * 2
    this.ring = new Float32Array(this.capacity)
  }

  get running(): boolean {
    return this.ctx !== null && this.ctx.state === 'running'
  }

  /** 音频是否被浏览器策略拦着（此时游戏静音运行，但画面一切正常） */
  get blocked(): boolean {
    if (this.failed) return true
    return this.ctx !== null && this.ctx.state !== 'running'
  }

  get volume(): number {
    return this._volume
  }

  get muted(): boolean {
    return this._muted
  }

  /** 已缓存但尚未播放的音频时长（秒），用于主循环做速度校正 */
  get bufferedSeconds(): number {
    return this.filled / 2 / this.sampleRate
  }

  /**
   * 启动音频输出。
   *
   * 这个方法保证「绝不抛错、绝不长时间挂起」——它只是外设，
   * 不能成为游戏开机的必经关卡。所有失败都安静降级：
   * 没有声音也要能玩。
   *
   * 必须在用户手势回调里调用（浏览器自动播放策略）。
   */
  async start(): Promise<void> {
    if (this.failed) return

    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) {
        this.failed = true
        return
      }

      try {
        let ctx: AudioContext
        try {
          ctx = new Ctor({ sampleRate: this.sampleRate, latencyHint: 'interactive' })
        } catch {
          // 部分声卡不接受强制采样率，退回设备默认值
          ctx = new Ctor({ latencyHint: 'interactive' })
        }
        this.ctx = ctx
        this.gainNode = ctx.createGain()
        this.gainNode.gain.value = this.effectiveGain
        this.gainNode.connect(ctx.destination)

        const source = ctx.createScriptProcessor(PROCESSOR_FRAME, 0, 2)
        this.source = source
        source.onaudioprocess = this.handleAudioProcess
        source.connect(this.gainNode)
      } catch {
        // 完全没有音频输出能力：降级为静音，画面不受任何影响
        this.failed = true
        this.ctx = null
        this.gainNode = null
        this.source = null
        return
      }
    }

    await this.resumeWithTimeout()
  }

  /**
   * resume() 最多等 RESUME_TIMEOUT 毫秒。
   * 被自动播放策略拦住时 resume() 永不 settle，这里靠超时放行，
   * 等用户后续真的产生手势，上下文会自然恢复。
   */
  private async resumeWithTimeout(): Promise<void> {
    const ctx = this.ctx
    if (!ctx || ctx.state === 'running') return
    try {
      await Promise.race([
        ctx.resume(),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, RESUME_TIMEOUT)
        }),
      ])
    } catch {
      /* 被策略拒绝：留待用户下一次手势时自然恢复 */
    }
  }

  async suspend(): Promise<void> {
    if (this.ctx && this.ctx.state === 'running') {
      try {
        await Promise.race([
          this.ctx.suspend(),
          new Promise<void>((resolve) => {
            window.setTimeout(resolve, RESUME_TIMEOUT)
          }),
        ])
      } catch {
        /* 挂起失败无所谓，关机流程不依赖音频 */
      }
    }
  }

  setVolume(v: number): void {
    this._volume = Math.min(1, Math.max(0, v))
    this.applyGain()
  }

  setMuted(m: boolean): void {
    this._muted = m
    this.applyGain()
  }

  toggleMute(): boolean {
    this.setMuted(!this._muted)
    return this._muted
  }

  private get effectiveGain(): number {
    return this._muted ? 0 : this._volume
  }

  private applyGain(): void {
    if (!this.gainNode || !this.ctx) return
    // 轻微淡入淡出，避免爆音
    const now = this.ctx.currentTime
    this.gainNode.gain.cancelScheduledValues(now)
    this.gainNode.gain.setTargetAtTime(this.effectiveGain, now, 0.015)
  }

  /** jsnes onAudioSample 回调 */
  push = (left: number, right: number): void => {
    if (this.filled >= this.capacity) {
      // 水库满了：丢掉最旧的一段，避免延迟越滚越大
      this.readPtr = (this.readPtr + 2) % this.capacity
      this.filled -= 2
    }
    this.ring[this.writePtr] = left
    this.writePtr = (this.writePtr + 1) % this.capacity
    this.ring[this.writePtr] = right
    this.writePtr = (this.writePtr + 1) % this.capacity
    this.filled += 2
  }

  private handleAudioProcess = (e: AudioProcessingEvent): void => {
    const out = e.outputBuffer
    const l = out.getChannelData(0)
    const r = out.getChannelData(out.numberOfChannels > 1 ? 1 : 0)
    const need = l.length * 2

    if (this.filled >= need) {
      for (let i = 0; i < l.length; i++) {
        l[i] = this.ring[this.readPtr]
        r[i] = this.ring[(this.readPtr + 1) % this.capacity]
        this.readPtr = (this.readPtr + 2) % this.capacity
      }
      this.filled -= need
      this.lastL = l[l.length - 1]
      this.lastR = r[r.length - 1]
    } else {
      // 欠载：先播完存量，再保持最后一个采样值（直流保持，比补零更不容易爆音）
      const pairs = Math.floor(this.filled / 2)
      for (let i = 0; i < pairs; i++) {
        l[i] = this.ring[this.readPtr]
        r[i] = this.ring[(this.readPtr + 1) % this.capacity]
        this.readPtr = (this.readPtr + 2) % this.capacity
      }
      this.filled -= pairs * 2
      const holdL = pairs > 0 ? l[pairs - 1] : this.lastL
      const holdR = pairs > 0 ? r[pairs - 1] : this.lastR
      for (let i = pairs; i < l.length; i++) {
        l[i] = holdL
        r[i] = holdR
      }
      if (this.running) this.underruns++
    }
  }

  /** 清空缓冲（换 ROM / 读档时用） */
  flush(): void {
    this.writePtr = 0
    this.readPtr = 0
    this.filled = 0
    this.lastL = 0
    this.lastR = 0
  }

  dispose(): void {
    if (this.source) {
      this.source.onaudioprocess = null
      try {
        this.source.disconnect()
      } catch {
        /* ignore */
      }
      this.source = null
    }
    if (this.ctx) {
      void this.ctx.close()
      this.ctx = null
    }
    this.gainNode = null
  }
}
