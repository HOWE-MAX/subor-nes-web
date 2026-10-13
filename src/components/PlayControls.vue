<script setup lang="ts">
import { computed } from 'vue'
import { useConsole } from '@/composables/useConsole'

const {
  settings,
  rom,
  paused,
  turbo,
  muted,
  powered,
  togglePause,
  setTurbo,
  toggleMute,
  setVolume,
  toggleFullscreen,
  screenshot,
} = useConsole()

const disabled = computed(() => !rom.value)

function turboDown(e: PointerEvent) {
  ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
  setTurbo(true)
}
function turboUp() {
  setTurbo(false)
}
</script>

<template>
  <div class="panel">
    <h3 class="panel-title">播放控制 <span class="en">CONTROL</span></h3>

    <div class="grid">
      <button class="btn red" :disabled="disabled" @click="togglePause">
        {{ paused ? '▶ 继续' : '❚❚ 暂停' }}
      </button>
      <button
        class="btn gold"
        :class="{ held: turbo }"
        :disabled="disabled"
        @pointerdown="turboDown"
        @pointerup="turboUp"
        @pointerleave="turboUp"
        @pointercancel="turboUp"
      >
        ▶▶ 快进 {{ settings.turboSpeed }}X
      </button>
      <button class="btn ghost" :disabled="!powered" @click="toggleFullscreen">⛶ 全屏</button>
      <button class="btn ghost" :disabled="disabled" @click="screenshot">◉ 截图</button>
    </div>

    <div class="volume">
      <button class="mute" :class="{ off: muted }" @click="toggleMute">
        {{ muted ? '🔇' : '🔊' }}
      </button>
      <input
        class="slider"
        type="range"
        min="0"
        max="100"
        :value="Math.round(settings.volume * 100)"
        @input="setVolume(Number(($event.target as HTMLInputElement).value) / 100)"
      />
      <span class="pct">{{ muted ? '静音' : Math.round(settings.volume * 100) + '%' }}</span>
    </div>

    <p class="hint">按住 <kbd>Tab</kbd> 或手柄 LB 也能快进；快进时自动静音。</p>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.btn.held {
  filter: brightness(1.2);
  box-shadow: inset 0 3px 6px rgba(0, 0, 0, 0.4);
  transform: translateY(2px);
}

.volume {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}
.mute {
  width: 34px;
  height: 30px;
  border-radius: 6px;
  font-size: 15px;
  background: linear-gradient(180deg, #fbf8f0, #e2dccd);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    inset 0 0 0 1px rgba(120, 110, 90, 0.2);
}
.mute.off {
  background: linear-gradient(180deg, #c9c1ae, #a89f8b);
}
.pct {
  width: 44px;
  text-align: right;
  font-family: var(--font-term);
  font-size: 14px;
  color: #6b6455;
  flex: none;
}

.hint {
  margin: 10px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: #857d6c;
}
kbd {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 3px;
  font-family: var(--font-term);
  font-size: 12px;
  color: #4b463c;
  background: #fdfbf4;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.25), inset 0 0 0 1px rgba(120, 110, 90, 0.3);
}
</style>
