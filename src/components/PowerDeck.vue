<script setup lang="ts">
import { useConsole } from '@/composables/useConsole'

const { powered, rom, togglePower, reset } = useConsole()
</script>

<template>
  <div class="panel">
    <h3 class="panel-title">主机电源 <span class="en">POWER</span></h3>

    <div class="power-row">
      <button
        class="power-lever"
        :class="{ on: powered }"
        :aria-pressed="powered"
        @click="togglePower"
      >
        <span class="knob" />
        <span class="txt">{{ powered ? 'ON' : 'OFF' }}</span>
      </button>

      <div class="lamp-box">
        <span class="lamp" :class="{ on: powered }" />
        <span class="lamp-label">{{ powered ? '通电' : '断电' }}</span>
      </div>

      <button class="btn red sm" :disabled="!rom" @click="reset">
        RESET
      </button>
    </div>

    <p class="hint">
      {{
        powered
          ? rom
            ? '主机运行中 · 关机将停止模拟（卡带不会弹出）'
            : '已开机 · 等待插入卡带'
          : '按下电源开关通电开机（音频需在开机后启用）'
      }}
    </p>
  </div>
</template>

<style scoped>
.power-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

/* 拨动开关 */
.power-lever {
  position: relative;
  display: flex;
  align-items: center;
  width: 96px;
  height: 40px;
  padding: 0 10px 0 6px;
  border-radius: 8px;
  background: linear-gradient(180deg, #3a3831, #232219);
  box-shadow:
    inset 0 2px 5px rgba(0, 0, 0, 0.7),
    0 1px 0 rgba(255, 255, 255, 0.35);
}
.power-lever .knob {
  width: 26px;
  height: 30px;
  border-radius: 5px;
  background: linear-gradient(180deg, #fdfbf4 0%, #ddd7c6 60%, #b7ae99 100%);
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition: transform 0.16s cubic-bezier(0.34, 1.4, 0.64, 1);
}
.power-lever .txt {
  margin-left: auto;
  font-family: var(--font-pixel);
  font-size: 9px;
  color: #8d8676;
  letter-spacing: 0.1em;
  transition: color 0.16s ease;
}
.power-lever.on {
  background: linear-gradient(180deg, #6d1d17, #3d0e0a);
}
.power-lever.on .knob {
  transform: translateX(54px);
}
.power-lever.on .txt {
  color: #ffcf9a;
  margin-left: 0;
  margin-right: auto;
  order: -1;
}

.lamp-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}
.lamp {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #62594c, #2f2b24);
  box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.7);
  transition: all 0.2s ease;
}
.lamp.on {
  background: radial-gradient(circle at 35% 30%, #ffd0a8, #ff3b1a 60%, #9c1500);
  box-shadow:
    0 0 12px rgba(255, 70, 30, 0.9),
    0 0 26px rgba(255, 70, 30, 0.45),
    inset 0 0 4px rgba(255, 220, 200, 0.9);
}
.lamp-label {
  font-size: 10px;
  color: #867e6d;
  letter-spacing: 0.08em;
}

.hint {
  margin: 11px 0 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: #7c7464;
}
</style>
