<script setup lang="ts">
import { useConsole } from '@/composables/useConsole'

const { settings } = useConsole()

const toggles: { key: 'scanlines' | 'curvature' | 'bloom' | 'pixelPerfect' | 'autoBattery'; label: string; desc: string }[] = [
  { key: 'scanlines', label: '扫描线', desc: '模拟显像管行扫描暗纹' },
  { key: 'curvature', label: '球面暗角', desc: '屏幕四周压暗、中央提亮' },
  { key: 'bloom', label: '荧光增艳', desc: '提升饱和度与亮度' },
  { key: 'pixelPerfect', label: '整数倍缩放', desc: '像素完全对齐，杜绝宽窄不一' },
  { key: 'autoBattery', label: '记忆电池', desc: '自动为带电池的卡带续玩' },
]
</script>

<template>
  <div class="panel">
    <h3 class="panel-title">画面与存档偏好 <span class="en">DISPLAY</span></h3>

    <div class="switch-list">
      <button
        v-for="t in toggles"
        :key="t.key"
        class="switch-row"
        @click="settings[t.key] = !settings[t.key]"
      >
        <span class="switch" :class="{ on: settings[t.key] }" />
        <span class="texts">
          <span class="label">{{ t.label }}</span>
          <span class="desc">{{ t.desc }}</span>
        </span>
      </button>
    </div>

    <div class="row">
      <span class="row-label">画面比例</span>
      <div class="seg">
        <button
          :class="{ active: settings.aspect === '4:3' }"
          @click="settings.aspect = '4:3'"
        >
          4:3 电视
        </button>
        <button
          :class="{ active: settings.aspect === '1:1' }"
          @click="settings.aspect = '1:1'"
        >
          1:1 方像素
        </button>
      </div>
    </div>

    <div class="row">
      <span class="row-label">快进倍速</span>
      <div class="seg">
        <button
          v-for="s in [2, 3, 5, 10]"
          :key="s"
          :class="{ active: settings.turboSpeed === s }"
          @click="settings.turboSpeed = s"
        >
          {{ s }}X
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.switch-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.switch-row {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 7px 6px;
  border-radius: 7px;
  text-align: left;
  transition: background 0.14s ease;
}
.switch-row:hover {
  background: rgba(255, 255, 255, 0.6);
}
.switch-row .texts {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.switch-row .label {
  font-size: 12.5px;
  font-weight: 600;
  color: #46422f;
}
.switch-row .desc {
  font-size: 10.5px;
  color: #8f8776;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 12px;
}
.row-label {
  font-size: 12px;
  color: #6b6455;
  flex: none;
}
.seg {
  display: flex;
  padding: 2px;
  border-radius: 7px;
  background: rgba(0, 0, 0, 0.08);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.14);
}
.seg button {
  padding: 4px 10px;
  border-radius: 5px;
  font-size: 11.5px;
  color: #6b6455;
  transition: all 0.14s ease;
}
.seg button.active {
  color: #fff6e6;
  background: linear-gradient(180deg, #b8202a, #7d1218);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
</style>
