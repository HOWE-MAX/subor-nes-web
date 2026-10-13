<script setup lang="ts">
/**
 * 电视屏幕面板
 * 256×240 的 jsnes 帧缓冲直接 putImageData 到画布，
 * 由 CSS image-rendering: pixelated 做整数倍放大，保证像素锐利。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { SCREEN_H, SCREEN_W } from '@/core/constants'
import { stripExt } from '@/core/rom'
import { useConsole } from '@/composables/useConsole'

const { settings, powered, paused, turbo, rom, stats, setFrameTarget, insertRom } =
  useConsole()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const stageRef = ref<HTMLDivElement | null>(null)
const scale = ref(2)
const dragging = ref(false)

/** 4:3 电视比例下的逻辑宽度（240 × 4/3 = 320） */
const logicalW = computed(() => (settings.aspect === '4:3' ? 320 : SCREEN_W))

const crtStyle = computed(() => ({
  width: logicalW.value * scale.value + 'px',
  height: SCREEN_H * scale.value + 'px',
}))

const canvasStyle = computed(() => ({
  width: logicalW.value * scale.value + 'px',
  height: SCREEN_H * scale.value + 'px',
}))

function measure() {
  const el = stageRef.value
  if (!el) return
  const availW = Math.max(0, el.clientWidth - 28)
  const availH = Math.max(0, el.clientHeight - 28)
  const s = Math.min(availW / logicalW.value, availH / SCREEN_H)
  scale.value = settings.pixelPerfect
    ? Math.max(1, Math.floor(s))
    : Math.max(0.5, Math.min(6, s))
}

let ro: ResizeObserver | null = null

onMounted(() => {
  const canvas = canvasRef.value
  if (canvas) {
    const ctx = canvas.getContext('2d', { alpha: false })
    if (ctx) {
      ctx.imageSmoothingEnabled = false
      setFrameTarget((img) => ctx.putImageData(img, 0, 0))
    }
  }
  measure()
  if (typeof ResizeObserver !== 'undefined' && stageRef.value) {
    ro = new ResizeObserver(measure)
    ro.observe(stageRef.value)
  } else {
    window.addEventListener('resize', measure)
  }
})

onBeforeUnmount(() => {
  setFrameTarget(null)
  ro?.disconnect()
  window.removeEventListener('resize', measure)
})

watch(() => [settings.aspect, settings.pixelPerfect], measure)

// ---------------------------------------------------------------- 拖拽插卡

function onDragOver(e: DragEvent) {
  e.preventDefault()
  dragging.value = true
}

function onDragLeave() {
  dragging.value = false
}

async function onDrop(e: DragEvent) {
  e.preventDefault()
  dragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) await insertRom(file)
}
</script>

<template>
  <div
    class="tv"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- 电视外框 -->
    <div class="tv-body">
      <div class="tv-speaker">
        <span v-for="i in 14" :key="i" class="hole" />
      </div>

      <div ref="stageRef" class="stage">
        <div class="crt-wrap" :style="crtStyle">
          <div
            class="crt"
            :class="{
              'is-off': !powered,
              curved: settings.curvature && powered,
              bloom: settings.bloom && powered,
            }"
          >
            <canvas
              id="nes-screen"
              ref="canvasRef"
              class="screen"
              :width="SCREEN_W"
              :height="SCREEN_H"
              :style="canvasStyle"
            />

            <!-- 待机 / 关机画面 -->
            <div v-if="!rom" class="standby" :class="{ off: !powered }">
              <div class="logo pixel">SUBOR</div>
              <div class="cn">小霸王 8 位游戏机</div>
              <div class="line" />
              <template v-if="powered">
                <div class="tip">请插入卡带</div>
                <div class="tip en pixel">INSERT CARTRIDGE</div>
                <div class="caret pixel">&#9632;</div>
              </template>
              <template v-else>
                <div class="tip">电源已关闭</div>
                <div class="tip en pixel">POWER OFF</div>
                <div class="tip dim">请拨动机身电源开关开机</div>
              </template>
            </div>

            <!-- 暂停 -->
            <div v-if="rom && paused" class="overlay">
              <span class="pause-text pixel">PAUSE</span>
            </div>

            <!-- 快进 -->
            <div v-if="turbo" class="overlay turbo-overlay">
              <span class="turbo-text pixel">&gt;&gt; {{ settings.turboSpeed }}X</span>
            </div>

            <div class="vignette" />
            <div v-if="settings.scanlines" class="scanlines" :style="{ opacity: settings.scanlines ? 0.5 : 0 }" />
            <div class="glass" />

            <!-- 关机瞬间的收束亮线 -->
            <div class="collapse-line" />
          </div>
        </div>
      </div>

      <div class="tv-brand">
        <span class="pixel">SUBOR</span>
        <span class="sub">彩色电视机 · 自动彩电</span>
      </div>
    </div>

    <!-- 状态条 -->
    <div class="tv-status">
      <div class="chip">
        <span class="dot" :class="{ live: powered && !!rom }" />
        <span class="label">{{ powered ? (rom ? '播放中' : '待机') : '已关机' }}</span>
      </div>
      <div class="chip">
        <span class="k">卡带</span>
        <span class="v">{{ rom ? stripExt(rom.name) : '未插入' }}</span>
      </div>
      <div class="chip">
        <span class="k">MAPPER</span>
        <span class="v">{{ rom ? rom.mapper : '—' }}</span>
      </div>
      <div class="chip">
        <span class="k">FPS</span>
        <span class="v">{{ stats.fps ? stats.fps.toFixed(1) : '—' }}</span>
      </div>
      <div class="chip">
        <span class="k">信号</span>
        <span class="v">{{ settings.aspect === '4:3' ? '4:3' : '1:1' }} · {{ scale.toFixed(2) }}X</span>
      </div>
    </div>

    <!-- 拖拽提示 -->
    <div v-if="dragging" class="drop-hint">
      <div class="inner pixel">
        <div class="big">DROP .NES</div>
        <div class="small">松手即插卡</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tv {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  position: relative;
}

.tv-body {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  padding: 14px 18px 10px;
  background: linear-gradient(178deg, #5c5a55 0%, #45433f 40%, #33312e 100%);
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.18),
    inset 0 -8px 22px rgba(0, 0, 0, 0.5),
    0 14px 30px rgba(20, 16, 8, 0.35);
}

/* 扬声器栅格 */
.tv-speaker {
  display: flex;
  gap: 4px;
  justify-content: center;
  padding-bottom: 8px;
}
.tv-speaker .hole {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #201f1d, #0b0b0a);
  box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.8);
}

.stage {
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
}

.crt-wrap {
  position: relative;
  padding: 10px;
  border-radius: 14px;
  background: linear-gradient(160deg, #1d1c1a, #0a0a09);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.06),
    0 8px 24px rgba(0, 0, 0, 0.55);
}

.crt {
  position: relative;
  overflow: hidden;
  border-radius: 10px;
  background: #05060a;
  transform-style: preserve-3d;
  transition: filter 0.25s ease;
}
.crt.curved {
  /* 轻微球面感：外侧压暗 + 缩放 */
  box-shadow:
    inset 0 0 60px rgba(0, 0, 0, 0.9),
    inset 0 0 140px rgba(0, 0, 0, 0.6);
}
.crt.bloom .screen {
  filter: saturate(1.18) contrast(1.06) brightness(1.06);
}

.screen {
  display: block;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  background: #000;
  transition: opacity 0.18s linear;
}

/* 关机 */
.crt.is-off .screen {
  opacity: 0;
}
.collapse-line {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 0;
  background: #d8e6ff;
  opacity: 0;
  pointer-events: none;
}
.crt.is-off .collapse-line {
  animation: collapse 0.45s ease-out 1 forwards;
}
@keyframes collapse {
  0% {
    height: 60%;
    top: 20%;
    opacity: 0.85;
  }
  70% {
    height: 6px;
    top: calc(50% - 3px);
    opacity: 0.5;
  }
  100% {
    height: 2px;
    top: calc(50% - 1px);
    opacity: 0.15;
  }
}

/* CRT 叠加层 */
.vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    ellipse at center,
    rgba(0, 0, 0, 0) 46%,
    rgba(0, 0, 0, 0.32) 82%,
    rgba(0, 0, 0, 0.62) 100%
  );
}
.scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0) 0px,
    rgba(0, 0, 0, 0) 1px,
    rgba(0, 0, 0, 0.34) 2px,
    rgba(0, 0, 0, 0.34) 3px
  );
  mix-blend-mode: multiply;
}
.glass {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    118deg,
    rgba(255, 255, 255, 0.13) 0%,
    rgba(255, 255, 255, 0.04) 26%,
    rgba(255, 255, 255, 0) 42%
  );
}

/* 待机画面 */
.standby {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #7ef29a;
  background: radial-gradient(ellipse at center, #06210f 0%, #010703 78%);
  text-shadow: 0 0 10px rgba(90, 255, 150, 0.55);
  transition: opacity 0.2s linear;
}
.standby.dim,
.standby .tip.dim {
  font-size: 11px;
  opacity: 0.6;
}
/* 关机状态：保留一丝余辉，明确告知「已断电」而不是「坏了」 */
.standby.off {
  background: radial-gradient(ellipse at center, #04140a 0%, #010402 78%);
  color: #3f7a54;
  text-shadow: none;
}
.standby.off .logo {
  color: #5c5030;
  text-shadow: none;
}
.standby.off .line {
  background: linear-gradient(90deg, transparent, #1d5c37, transparent);
}
.standby .logo {
  font-size: 20px;
  color: #ffd75e;
  text-shadow: 0 0 14px rgba(255, 200, 60, 0.6);
  letter-spacing: 0.22em;
}
.standby .cn {
  font-size: 15px;
  letter-spacing: 0.14em;
}
.standby .line {
  width: 56%;
  height: 1px;
  margin: 6px 0;
  background: linear-gradient(90deg, transparent, #2fbf6a, transparent);
}
.standby .tip {
  font-size: 13px;
  letter-spacing: 0.1em;
}
.standby .tip.en {
  font-size: 8px;
  opacity: 0.75;
}
.standby .caret {
  margin-top: 8px;
  font-size: 10px;
  animation: blink 1s steps(1) infinite;
}
@keyframes blink {
  0%,
  50% {
    opacity: 1;
  }
  50.01%,
  100% {
    opacity: 0;
  }
}

/* 覆盖提示 */
.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.45);
  pointer-events: none;
}
.pause-text {
  color: #ffd75e;
  font-size: 18px;
  letter-spacing: 0.3em;
  text-shadow: 0 0 16px rgba(255, 200, 60, 0.7);
  animation: blink 1.1s steps(1) infinite;
}
.turbo-overlay {
  background: none;
  place-items: start end;
  padding: 8px 12px;
}
.turbo-text {
  color: #ff6b4a;
  font-size: 12px;
  text-shadow: 0 0 10px rgba(255, 90, 60, 0.8);
}

/* 电视铭牌 */
.tv-brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
  justify-content: center;
  padding-top: 8px;
  color: #b9b3a6;
}
.tv-brand .pixel {
  font-size: 9px;
  letter-spacing: 0.3em;
  color: #d8d2c4;
}
.tv-brand .sub {
  font-size: 11px;
  opacity: 0.7;
}

/* 状态条 */
.tv-status {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 4px 0;
}
.chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: #4b4740;
  background: linear-gradient(180deg, #fdfaf2, #e6e0d1);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 1px 2px rgba(0, 0, 0, 0.14);
}
.chip .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--led-off);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
}
.chip .dot.live {
  background: radial-gradient(circle at 35% 30%, #ff9c6b, #ff3b1f);
  box-shadow: 0 0 8px rgba(255, 80, 40, 0.85);
  animation: pulse 1.6s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.62;
  }
}
.chip .k {
  color: #8a8375;
  font-size: 11px;
  letter-spacing: 0.06em;
}
.chip .v {
  font-weight: 600;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 拖拽插卡 */
.drop-hint {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: 20px;
  background: rgba(20, 14, 8, 0.62);
  border: 3px dashed rgba(255, 214, 110, 0.8);
  z-index: 5;
  pointer-events: none;
}
.drop-hint .inner {
  text-align: center;
  color: #ffd75e;
}
.drop-hint .big {
  font-size: 18px;
  letter-spacing: 0.24em;
  text-shadow: 0 0 18px rgba(255, 200, 60, 0.7);
}
.drop-hint .small {
  margin-top: 10px;
  font-size: 12px;
  color: #f3ead2;
  letter-spacing: 0.16em;
}
</style>
