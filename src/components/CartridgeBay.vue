<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatBytes, stripExt } from '@/core/rom'
import { useConsole, BUILTIN_ROMS } from '@/composables/useConsole'
import { useToast } from '@/composables/useToast'
import type { StoredRom } from '@/core/storage'

const {
  rom,
  library,
  libraryReady,
  storeOk,
  insertRom,
  eject,
  playFromLibrary,
  playBuiltin,
  removeFromLibrary,
} = useConsole()
const toast = useToast()

const fileRef = ref<HTMLInputElement | null>(null)
const showShelf = ref(false)
const draggingOver = ref(false)

const currentLabel = computed(() => (rom.value ? stripExt(rom.value.name) : ''))

function openPicker() {
  fileRef.value?.click()
}

async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await insertRom(file)
}

async function onDrop(e: DragEvent) {
  e.preventDefault()
  draggingOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) await insertRom(file)
}

async function play(item: StoredRom) {
  if (rom.value?.id === item.id) {
    toast.info('这张卡带已经插着了')
    return
  }
  await playFromLibrary(item)
}
</script>

<template>
  <div class="panel">
    <h3 class="panel-title">
      卡带插槽 <span class="en">CARTRIDGE</span>
    </h3>

    <!-- 当前的卡带 -->
    <div
      class="cart"
      :class="{ empty: !rom, over: draggingOver }"
      @dragover.prevent="draggingOver = true"
      @dragleave="draggingOver = false"
      @drop="onDrop"
    >
      <div v-if="rom" class="cart-inner">
        <div class="cart-grip">
          <span v-for="i in 9" :key="i" class="ridge" />
        </div>
        <div class="cart-body">
          <span class="cart-label pixel">8 BIT</span>
          <span class="cart-name">{{ currentLabel }}</span>
          <span class="cart-meta">
            {{ formatBytes(rom.size) }}
            <span class="sep">·</span>
            MAPPER {{ rom.mapper }}
            <span v-if="rom.battery" class="tag gold">电池记忆</span>
          </span>
        </div>
        <button class="eject" title="弹出卡带" @click="eject">⏏</button>
      </div>

      <div v-else class="cart-empty">
        <span class="slot" />
        <p>
          把 <b>.nes</b> 文件拖到这里<br />
          或点击下方按钮选择卡带
        </p>
      </div>
    </div>

    <div class="cart-actions">
      <button class="btn gold wide" @click="openPicker">插入卡带（选择 .nes 文件）</button>
      <button
        class="btn ghost sm"
        :disabled="!library.length"
        @click="showShelf = !showShelf"
      >
        卡带架 {{ library.length ? '(' + library.length + ')' : '' }}
      </button>
    </div>
    <input
      ref="fileRef"
      type="file"
      accept=".nes,.NES,.unf,.unif,application/octet-stream"
      class="sr-only"
      @change="onPick"
    />

    <!-- 内置试玩卡带 -->
    <div class="builtin">
      <div class="builtin-head">
        <span class="panel-sub">内置试玩卡带</span>
        <span class="free-tag">自由软件</span>
      </div>
      <div class="builtin-list">
        <button
          v-for="b in BUILTIN_ROMS"
          :key="b.key"
          class="builtin-item"
          :title="b.desc + '\n' + b.author"
          @click="playBuiltin(b)"
        >
          <span class="bi-title">{{ b.title }}</span>
          <span class="bi-desc">{{ b.desc }}</span>
          <span class="bi-author">{{ b.author }}</span>
        </button>
      </div>
    </div>

    <!-- 卡带架 -->
    <div v-if="showShelf" class="shelf">
      <div v-if="!storeOk" class="shelf-empty">本地存储不可用，卡带架已停用</div>
      <div v-else-if="!libraryReady" class="shelf-empty">读取中…</div>
      <div v-else-if="!library.length" class="shelf-empty">还没有收藏的卡带</div>
      <ul v-else>
        <li v-for="item in library" :key="item.id" :class="{ active: rom?.id === item.id }">
          <button class="name" :title="item.name" @click="play(item)">
            <span class="title">{{ stripExt(item.name) }}</span>
            <span class="size">{{ formatBytes(item.size) }}</span>
          </button>
          <button class="del" title="移除" @click="removeFromLibrary(item.id)">✕</button>
        </li>
      </ul>
    </div>

    <p class="legal">
      仅支持载入你自有的 ROM 文件。本模拟器不附带任何游戏 ROM。
    </p>
  </div>
</template>

<style scoped>
.cart {
  position: relative;
  border-radius: 9px;
  padding: 10px;
  min-height: 96px;
  background: linear-gradient(180deg, #2a2b30, #17181b);
  box-shadow:
    inset 0 3px 8px rgba(0, 0, 0, 0.8),
    inset 0 0 0 1px rgba(255, 255, 255, 0.06),
    0 1px 0 rgba(255, 255, 255, 0.4);
  transition: box-shadow 0.15s ease;
}
.cart.over {
  box-shadow:
    inset 0 3px 8px rgba(0, 0, 0, 0.8),
    inset 0 0 0 2px var(--gold),
    0 0 16px rgba(216, 168, 60, 0.6);
}

.cart-inner {
  display: flex;
  align-items: stretch;
  gap: 8px;
  height: 76px;
}

.cart-grip {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  width: 28px;
  padding: 6px;
  border-radius: 5px;
  background: linear-gradient(180deg, #c9c3b2, #9d9686);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  flex: none;
}
.cart-grip .ridge {
  height: 3px;
  border-radius: 2px;
  background: rgba(60, 55, 45, 0.45);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
}

.cart-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  padding: 0 10px;
  border-radius: 5px;
  background: linear-gradient(180deg, #8f1a22, #5d0d13);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
.cart-label {
  font-size: 7px;
  color: #f3c789;
  letter-spacing: 0.2em;
}
.cart-name {
  font-size: 14px;
  font-weight: 700;
  color: #fff6e6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.5);
}
.cart-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  color: #e7b7b0;
}
.cart-meta .sep {
  opacity: 0.5;
}
.cart-meta .tag {
  background: rgba(255, 214, 110, 0.22);
  color: #ffd97a;
}

.eject {
  flex: none;
  width: 32px;
  border-radius: 5px;
  font-size: 15px;
  color: #cfc9ba;
  background: linear-gradient(180deg, #4a4841, #2e2c27);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15);
  transition: color 0.15s ease, background 0.15s ease;
}
.eject:hover {
  color: #fff;
  background: linear-gradient(180deg, #b02a2a, #7a1418);
}

.cart-empty {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 76px;
  color: #7d7a70;
}
.cart-empty .slot {
  width: 92px;
  height: 16px;
  border-radius: 4px;
  background: #0d0e10;
  box-shadow:
    inset 0 3px 6px rgba(0, 0, 0, 0.9),
    0 1px 0 rgba(255, 255, 255, 0.08);
  flex: none;
}
.cart-empty p {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.65;
}
.cart-empty b {
  color: var(--gold);
}

.cart-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.cart-actions .btn.gold {
  flex: 1;
}

/* 内置试玩卡带 */
.builtin {
  margin-top: 12px;
}
.builtin-head {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 7px;
}
.panel-sub {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #6b6455;
}
.free-tag {
  padding: 0 6px;
  border-radius: 999px;
  font-size: 9.5px;
  color: #175c33;
  background: rgba(75, 192, 122, 0.2);
}
.builtin-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.builtin-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 7px;
  text-align: left;
  background: linear-gradient(180deg, #fffdf6, #ece6d6);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    inset 0 0 0 1px rgba(120, 110, 90, 0.2);
  transition: all 0.14s ease;
}
.builtin-item:hover {
  background: linear-gradient(180deg, #fffefb, #f4efe2);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    inset 0 0 0 1px rgba(168, 32, 42, 0.35);
}
.builtin-item:active {
  transform: translateY(1px);
}
.bi-title {
  font-size: 12.5px;
  font-weight: 700;
  color: #4a4534;
}
.bi-desc {
  font-size: 10.5px;
  color: #8f8776;
  line-height: 1.5;
}
.bi-author {
  font-size: 9.5px;
  color: #a9a192;
}

/* 卡带架 */
.shelf {
  margin-top: 10px;
  max-height: 168px;
  overflow-y: auto;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.5);
  box-shadow: inset 0 0 0 1px rgba(120, 110, 90, 0.18);
}
.shelf-empty {
  padding: 14px;
  text-align: center;
  font-size: 11.5px;
  color: #8b8373;
}
.shelf ul {
  margin: 0;
  padding: 4px;
  list-style: none;
}
.shelf li {
  display: flex;
  align-items: center;
  border-radius: 5px;
}
.shelf li:hover {
  background: rgba(255, 255, 255, 0.85);
}
.shelf li.active {
  background: rgba(168, 32, 42, 0.1);
}
.shelf .name {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 7px 9px;
  text-align: left;
}
.shelf .title {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  color: #43402f;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shelf li.active .title {
  color: var(--red-dark);
  font-weight: 700;
}
.shelf .size {
  font-size: 10px;
  color: #9a9282;
  flex: none;
}
.shelf .del {
  flex: none;
  padding: 6px 10px;
  font-size: 11px;
  color: #a89f8d;
}
.shelf .del:hover {
  color: #c0242c;
}

.legal {
  margin: 10px 0 0;
  font-size: 10.5px;
  line-height: 1.6;
  color: #9a9282;
}
</style>
