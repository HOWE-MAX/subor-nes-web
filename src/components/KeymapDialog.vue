<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import {
  BUTTON_LABEL,
  HOTKEYS,
  PAD_BUTTONS,
  keyLabel,
  type ButtonName,
  type PlayerId,
} from '@/core/constants'
import { useConsole } from '@/composables/useConsole'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const { keymap, gamepads, setInputEnabled, captureKey, cancelCapture, clearBinding, setBinding, resetKeymap } =
  useConsole()

const capturing = ref<{ player: PlayerId; button: ButtonName; index: number } | null>(null)

watch(
  () => props.open,
  (open) => {
    setInputEnabled(!open)
    if (!open) {
      cancelCapture()
      capturing.value = null
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  setInputEnabled(true)
  cancelCapture()
})

async function startCapture(player: PlayerId, button: ButtonName, index: number) {
  if (capturing.value) return
  capturing.value = { player, button, index }
  const code = await captureKey()
  setBinding(player, button, index, code)
  capturing.value = null
}

function isCapturing(player: PlayerId, button: ButtonName, index: number): boolean {
  const c = capturing.value
  return !!c && c.player === player && c.button === button && c.index === index
}

function slotsFor(player: PlayerId, button: ButtonName): (string | null)[] {
  const codes = keymap[player]?.[button] ?? []
  return [codes[0] ?? null, codes[1] ?? null]
}

function onBackdrop(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <Transition name="modal">
    <div v-if="open" class="backdrop" @click="onBackdrop">
      <div class="dialog">
        <header class="dlg-head">
          <h2>按键设置 <span class="en pixel">KEY MAPPING</span></h2>
          <button class="close" @click="emit('close')">✕</button>
        </header>

        <div class="dlg-body">
          <section class="pads">
            <div v-for="p in ([1, 2] as PlayerId[])" :key="p" class="pad-col">
              <h3 class="col-title">
                PLAYER {{ p }}
                <span v-if="gamepads[p - 1]" class="pad-tag" :title="gamepads[p - 1].id">
                  手柄已连接
                </span>
                <span v-else class="pad-tag off">无手柄</span>
              </h3>

              <div class="rows">
                <div v-for="b in PAD_BUTTONS" :key="b" class="row">
                  <span class="btn-name">{{ BUTTON_LABEL[b] }}</span>
                  <div class="keys">
                    <button
                      v-for="(code, i) in slotsFor(p, b)"
                      :key="i"
                      class="key"
                      :class="{
                        empty: !code,
                        capturing: isCapturing(p, b, i),
                        ghost: i === 1 && !code,
                      }"
                      :title="code ? '点击重新设定 · 右键清除' : '点击新增键位'"
                      @click="startCapture(p, b, i)"
                      @contextmenu.prevent="code && clearBinding(p, b, i)"
                    >
                      <template v-if="isCapturing(p, b, i)">按下按键…</template>
                      <template v-else-if="code">{{ keyLabel(code) }}</template>
                      <template v-else>{{ i === 0 ? '未设置' : '＋' }}</template>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside class="side">
            <div class="side-block">
              <h4>全局快捷键</h4>
              <ul class="hotkeys">
                <li v-for="h in HOTKEYS" :key="h.keys">
                  <kbd>{{ h.keys }}</kbd>
                  <span>{{ h.desc }}</span>
                </li>
              </ul>
            </div>

            <div class="side-block">
              <h4>游戏手柄</h4>
              <p class="tiny">
                标准 XInput 手柄即插即用：A→A、B→B、X/Y→连发、LB→快进、十字键与左摇杆→方向。
              </p>
              <ul v-if="gamepads.length" class="pads-list">
                <li v-for="g in gamepads" :key="g.index">
                  <span class="idx">P{{ g.index + 1 }}</span>
                  <span class="gname" :title="g.id">{{ g.id }}</span>
                </li>
              </ul>
              <p v-else class="tiny dim">当前未检测到手柄，插上后动一下按钮即可识别。</p>
            </div>

            <div class="side-block">
              <h4>操作提示</h4>
              <p class="tiny">
                每个按键支持两个键位，鼠标右键可清除。设置在本地保存，下次打开自动生效。
              </p>
            </div>
          </aside>
        </div>

        <footer class="dlg-foot">
          <button class="btn ghost sm" @click="resetKeymap">恢复默认按键</button>
          <button class="btn red" @click="emit('close')">完成</button>
        </footer>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 150;
  display: grid;
  place-items: center;
  padding: 28px;
  background: rgba(28, 22, 12, 0.55);
  backdrop-filter: blur(3px);
}
.dialog {
  width: min(900px, 100%);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  overflow: hidden;
  background: linear-gradient(180deg, #f6f2e7, #e6e0d0);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 24px 60px rgba(20, 14, 4, 0.45);
}

.dlg-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: linear-gradient(180deg, #a8202a, #7c141a);
  color: #fff3e2;
}
.dlg-head h2 {
  margin: 0;
  font-size: 15px;
  letter-spacing: 0.1em;
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.dlg-head .en {
  font-size: 8px;
  opacity: 0.7;
  letter-spacing: 0.2em;
}
.close {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: #ffd9c9;
  font-size: 14px;
  background: rgba(0, 0, 0, 0.2);
}
.close:hover {
  background: rgba(0, 0, 0, 0.35);
}

.dlg-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: 1fr 268px;
  gap: 16px;
  padding: 16px 18px;
}

.pads {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.pad-col {
  min-width: 0;
}
.col-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 9px;
  padding-bottom: 6px;
  font-family: var(--font-pixel);
  font-size: 9px;
  letter-spacing: 0.16em;
  color: #57503f;
  border-bottom: 1px dashed rgba(120, 110, 90, 0.35);
}
.pad-tag {
  font-family: var(--font-cn);
  font-size: 10px;
  letter-spacing: 0;
  padding: 1px 6px;
  border-radius: 999px;
  color: #175c33;
  background: rgba(75, 192, 122, 0.22);
}
.pad-tag.off {
  color: #8a8371;
  background: rgba(0, 0, 0, 0.07);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.btn-name {
  width: 56px;
  flex: none;
  font-size: 11.5px;
  color: #6b6455;
  text-align: right;
}
.keys {
  display: flex;
  gap: 5px;
  flex: 1;
  min-width: 0;
}
.key {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  border-radius: 6px;
  font-family: var(--font-term);
  font-size: 13px;
  color: #3f3b2e;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: linear-gradient(180deg, #fffdf6, #e8e2d2);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    inset 0 0 0 1px rgba(120, 110, 90, 0.2),
    0 1px 0 rgba(0, 0, 0, 0.12);
  transition: all 0.12s ease;
}
.key:hover {
  background: linear-gradient(180deg, #fffefa, #f0ebdd);
}
.key.empty {
  color: #a9a192;
}
.key.ghost {
  flex: 0 0 42px;
  color: #a9a192;
}
.key.capturing {
  color: #fff5e4;
  background: linear-gradient(180deg, #d8452e, #a01b12);
  box-shadow: 0 0 0 2px rgba(216, 69, 46, 0.35);
  animation: pulse 1s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.22);
  }
}

.side {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.side-block {
  padding: 11px 12px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.55);
  box-shadow: inset 0 0 0 1px rgba(120, 110, 90, 0.16);
}
.side-block h4 {
  margin: 0 0 8px;
  font-size: 11.5px;
  letter-spacing: 0.1em;
  color: #57503f;
}
.hotkeys {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.hotkeys li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  color: #6b6455;
}
.hotkeys kbd {
  min-width: 42px;
  padding: 1px 6px;
  border-radius: 4px;
  text-align: center;
  font-family: var(--font-term);
  font-size: 12.5px;
  color: #4b463c;
  background: #fdfbf4;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.25), inset 0 0 0 1px rgba(120, 110, 90, 0.3);
}
.tiny {
  margin: 0;
  font-size: 11px;
  line-height: 1.7;
  color: #7c7464;
}
.tiny.dim {
  color: #9a9282;
}
.pads-list {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pads-list li {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  color: #5c5544;
}
.pads-list .idx {
  flex: none;
  padding: 0 5px;
  border-radius: 4px;
  font-family: var(--font-pixel);
  font-size: 7px;
  color: #fff3e2;
  background: #a8202a;
}
.pads-list .gname {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dlg-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-top: 1px solid rgba(120, 110, 90, 0.22);
  background: rgba(255, 255, 255, 0.4);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-active .dialog,
.modal-leave-active .dialog {
  transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .dialog,
.modal-leave-to .dialog {
  transform: translateY(14px) scale(0.97);
}
</style>
