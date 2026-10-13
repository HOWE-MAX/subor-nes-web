<script setup lang="ts">
import { computed } from 'vue'
import { SAVE_SLOT_COUNT } from '@/core/constants'
import { useConsole } from '@/composables/useConsole'

const { rom, slots, saveSlot, loadSlot, deleteSlot, clearBattery, storeOk } = useConsole()

const slotList = computed(() =>
  Array.from({ length: SAVE_SLOT_COUNT }, (_, i) => {
    const n = i + 1
    return { n, record: slots.value.find((s) => s.slot === n) ?? null }
  }),
)

function fmt(ts: number): string {
  const d = new Date(ts)
  const p = (v: number) => String(v).padStart(2, '0')
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<template>
  <div class="panel">
    <h3 class="panel-title">即时存档 <span class="en">SAVE STATE</span></h3>

    <div v-if="!storeOk" class="warn">本地存储不可用，存档功能已停用。</div>

    <div class="slots">
      <div
        v-for="s in slotList"
        :key="s.n"
        class="slot"
        :class="{ filled: !!s.record, quick: s.n === SAVE_SLOT_COUNT }"
      >
        <div class="slot-head">
          <span class="no">
            槽位 {{ s.n }}
            <span v-if="s.n === SAVE_SLOT_COUNT" class="kbd-hint">F5/F8</span>
          </span>
          <span v-if="s.record" class="time">{{ fmt(s.record.savedAt) }}</span>
        </div>

        <div class="thumb">
          <img v-if="s.record?.thumb" :src="s.record.thumb" alt="" />
          <span v-else class="blank">空</span>
        </div>

        <div class="ops">
          <button class="btn sm" :disabled="!rom || !storeOk" @click="saveSlot(s.n)">存</button>
          <button
            class="btn sm gold"
            :disabled="!s.record"
            @click="loadSlot(s.n)"
          >
            读
          </button>
          <button class="btn sm ghost" :disabled="!s.record" @click="deleteSlot(s.n)">删</button>
        </div>
      </div>
    </div>

    <div class="foot">
      <button class="btn ghost sm" :disabled="!rom" @click="clearBattery">
        清除本卡带记忆电池
      </button>
      <span class="note">存档保存在本机浏览器中</span>
    </div>
  </div>
</template>

<style scoped>
.warn {
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 11.5px;
  color: #8a2b1e;
  background: rgba(200, 60, 40, 0.12);
}

.slots {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}
.slot {
  border-radius: 8px;
  padding: 8px;
  background: linear-gradient(180deg, #fdfaf2, #e9e3d3);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    inset 0 0 0 1px rgba(120, 110, 90, 0.18);
}
.slot.filled {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    inset 0 0 0 1px rgba(168, 32, 42, 0.35);
}
.slot.quick {
  grid-column: span 2;
}
.slot.quick .thumb {
  height: 68px;
}
.slot.quick .thumb img {
  object-fit: contain;
}

.slot-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.no {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  color: #5c5544;
  letter-spacing: 0.06em;
}
.kbd-hint {
  font-family: var(--font-term);
  font-size: 10px;
  font-weight: 400;
  color: #9a9282;
}
.time {
  font-family: var(--font-term);
  font-size: 11.5px;
  color: #9a9282;
}

.thumb {
  height: 54px;
  border-radius: 4px;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: #17181c;
  box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.7);
}
.thumb img {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
  object-fit: cover;
}
.blank {
  font-size: 11px;
  color: #4d4a44;
  letter-spacing: 0.2em;
}

.ops {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 5px;
  margin-top: 7px;
}
.ops .btn.sm {
  padding: 4px 0;
}

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 11px;
}
.note {
  font-size: 10.5px;
  color: #9a9282;
}
</style>
