<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import CartridgeBay from '@/components/CartridgeBay.vue'
import DisplaySettings from '@/components/DisplaySettings.vue'
import KeymapDialog from '@/components/KeymapDialog.vue'
import PlayControls from '@/components/PlayControls.vue'
import PowerDeck from '@/components/PowerDeck.vue'
import SaveBay from '@/components/SaveBay.vue'
import ScreenPanel from '@/components/ScreenPanel.vue'
import ToastStack from '@/components/ToastStack.vue'
import VirtualPad from '@/components/VirtualPad.vue'
import { useConsole, installLifecycleHooks } from '@/composables/useConsole'

const { powered, rom, gamepads, lastError, initStorage, toggleFullscreen, primeAudio } =
  useConsole()

const keymapOpen = ref(false)
const isFullscreen = ref(false)

function onFsChange() {
  isFullscreen.value = !!document.fullscreenElement
}

function onFirstGesture() {
  primeAudio()
  window.removeEventListener('pointerdown', onFirstGesture)
  window.removeEventListener('keydown', onFirstGesture)
}

onMounted(() => {
  void initStorage()
  installLifecycleHooks()
  document.addEventListener('fullscreenchange', onFsChange)
  window.addEventListener('pointerdown', onFirstGesture)
  window.addEventListener('keydown', onFirstGesture)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFsChange)
  window.removeEventListener('pointerdown', onFirstGesture)
  window.removeEventListener('keydown', onFirstGesture)
})
</script>

<template>
  <div class="room">
    <div id="console-shell" class="console" :class="{ 'is-fs': isFullscreen }">
      <!-- 顶部铭牌栏 -->
      <header class="top-deck">
        <div class="brand">
          <div class="logo">
            <span class="cn">小霸王</span>
            <span class="en pixel">SUBOR</span>
          </div>
          <div class="slogan">
            <span class="cn">八位游戏机</span>
            <span class="sep">·</span>
            <span class="en pixel">8-BIT ENTERTAINMENT SYSTEM</span>
          </div>
        </div>

        <div class="top-meta">
          <span class="model pixel">MODEL SB-926</span>
          <span class="badge" :class="{ live: powered && rom }">
            {{ powered ? (rom ? '运行中' : '待机') : '关机' }}
          </span>
          <button class="btn ghost sm" @click="keymapOpen = true">⌨ 按键设置</button>
          <button class="btn ghost sm" @click="toggleFullscreen">⛶ 全屏</button>
        </div>
      </header>

      <div v-if="lastError" class="err">运行错误：{{ lastError }}</div>

      <!-- 主体 -->
      <main class="deck-main">
        <section class="left-col">
          <ScreenPanel />
        </section>

        <aside class="right-col">
          <PowerDeck />
          <CartridgeBay />
          <PlayControls />
          <DisplaySettings />
          <SaveBay />
          <div class="version">
            内核 jsnes · Web 端复刻 · 仅支持桌面浏览器
          </div>
        </aside>
      </main>

      <!-- 底部手柄区 -->
      <footer class="deck-foot">
        <VirtualPad :player="1" />

        <div class="mid-card">
          <div class="mid-title pixel">GAMEPADS</div>
          <div class="pad-list">
            <div v-for="n in 2" :key="n" class="pad-item">
              <span class="dot" :class="{ on: !!gamepads[n - 1] }" />
              <span class="txt">
                P{{ n }} {{ gamepads[n - 1] ? '已连接' : '键盘操作' }}
              </span>
            </div>
          </div>
          <div class="divider" />
          <ul class="quick">
            <li><b>Tab</b> 快进</li>
            <li><b>P</b> 暂停</li>
            <li><b>F5/F8</b> 快速存读档</li>
            <li><b>F</b> 全屏</li>
          </ul>
          <p class="hint">也可以直接用鼠标点手柄上的按键</p>
        </div>

        <VirtualPad :player="2" />
      </footer>
    </div>

    <ToastStack />
    <KeymapDialog :open="keymapOpen" @close="keymapOpen = false" />
  </div>
</template>

<style scoped>
.room {
  min-height: 100vh;
  padding: 20px;
  display: flex;
  justify-content: center;
}

/* 机身 */
.console {
  width: 100%;
  max-width: 1680px;
  height: calc(100vh - 40px);
  min-height: 860px;
  display: flex;
  flex-direction: column;
  gap: 13px;
  padding: 15px 18px 17px;
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0) 22%),
    linear-gradient(168deg, #f4efe2 0%, #e8e1d0 42%, #d9d1bd 100%);
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.95),
    inset 0 0 0 1px rgba(120, 110, 90, 0.22),
    0 6px 0 rgba(150, 140, 118, 0.5),
    0 26px 60px rgba(52, 42, 22, 0.34);
}
/* 机身顶部的一道红边，还原红白机的配色记忆 */
.console::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 6px;
  border-radius: 24px 24px 0 0;
  background: linear-gradient(90deg, #8e1c22, #c0333d 22%, #a8202a 50%, #7c141a 100%);
  opacity: 0.92;
}
.console {
  position: relative;
}

.top-deck {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 6px 4px 2px;
}
.brand {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.logo {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.logo .cn {
  font-size: 23px;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: #a8202a;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.85);
}
.logo .en {
  font-size: 11px;
  letter-spacing: 0.3em;
  color: #8a8371;
}
.slogan {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  color: #7c7464;
}
.slogan .sep {
  opacity: 0.5;
}
.slogan .en {
  font-size: 8px;
  letter-spacing: 0.2em;
  color: #a49b84;
}

.top-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}
.model {
  font-size: 8px;
  letter-spacing: 0.18em;
  color: #a49b84;
}
.badge {
  padding: 3px 11px;
  border-radius: 999px;
  font-size: 11.5px;
  color: #6b6455;
  background: rgba(0, 0, 0, 0.07);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.14);
}
.badge.live {
  color: #8c1b1b;
  background: rgba(200, 50, 40, 0.15);
}

.err {
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  color: #8a2018;
  background: rgba(200, 60, 40, 0.14);
  box-shadow: inset 0 0 0 1px rgba(200, 60, 40, 0.3);
}

/* 主体布局 */
.deck-main {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 432px;
  gap: 15px;
}
.left-col {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px 14px 14px;
  border-radius: 18px;
  background: linear-gradient(180deg, #cfc8b6, #b8b1a0);
  box-shadow:
    inset 0 2px 6px rgba(0, 0, 0, 0.22),
    inset 0 0 0 1px rgba(255, 255, 255, 0.35);
}

.right-col {
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;
}
.version {
  text-align: center;
  font-size: 10.5px;
  color: #9a9282;
  padding: 2px 0 6px;
}

/* 底部手柄区 */
.deck-foot {
  display: flex;
  align-items: stretch;
  gap: 13px;
}
.mid-card {
  width: 218px;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 12px 10px;
  border-radius: 12px;
  background: linear-gradient(180deg, #3a3831, #232219);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    0 6px 14px rgba(0, 0, 0, 0.24);
}
.mid-title {
  font-size: 8px;
  letter-spacing: 0.24em;
  color: #8f8873;
}
.pad-list {
  display: flex;
  gap: 12px;
}
.pad-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #b8b0a0;
}
.pad-item .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #4a443a;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
}
.pad-item .dot.on {
  background: radial-gradient(circle at 35% 30%, #b6ffcd, #21b45f);
  box-shadow: 0 0 8px rgba(33, 180, 95, 0.9);
}
.divider {
  width: 78%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.18), transparent);
}
.quick {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px 10px;
  font-size: 10.5px;
  color: #a8a191;
}
.quick b {
  color: var(--gold);
  font-family: var(--font-term);
  font-size: 12px;
  font-weight: 400;
}
.hint {
  margin: 2px 0 0;
  font-size: 10px;
  color: #7c7566;
  text-align: center;
}

/* 全屏模式 */
.console:fullscreen,
.is-fs {
  height: 100vh;
  min-height: 0;
  max-width: none;
  border-radius: 0;
  padding: 14px 16px 16px;
}
.console:fullscreen::before {
  border-radius: 0;
}
</style>
