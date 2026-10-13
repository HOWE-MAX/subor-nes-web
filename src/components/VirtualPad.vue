<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ButtonName, PlayerId } from '@/core/constants'
import { useConsole } from '@/composables/useConsole'

const props = defineProps<{ player: PlayerId }>()

const { padState, keymap, pressVirtual } = useConsole()

function pressVirtualOn(p: PlayerId, b: ButtonName) {
  pressVirtual(p, b, true)
}
function pressVirtualOff(p: PlayerId, b: ButtonName) {
  pressVirtual(p, b, false)
}

const held = computed(() => new Set(padState.value[props.player] ?? []))

function isOn(b: ButtonName): boolean {
  return held.value.has(b)
}

/** 该按键绑定的主键位文案（用于手柄上丝印提示） */
function keyHint(b: ButtonName): string {
  const codes = keymap[props.player][b]
  if (!codes?.length) return ''
  const c = codes[0]
  if (c.startsWith('Key')) return c.slice(3)
  if (c.startsWith('Digit')) return c.slice(5)
  if (c.startsWith('Arrow')) return { Up: '↑', Down: '↓', Left: '←', Right: '→' }[c.slice(5)] ?? ''
  if (c === 'Enter') return 'ENT'
  if (c === 'ShiftRight') return 'R⇧'
  if (c === 'Comma') return ','
  if (c === 'Period') return '.'
  return c
}

const active = ref<ButtonName | null>(null)

function down(b: ButtonName, e: PointerEvent) {
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  active.value = b
  pressVirtualOn(props.player, b)
}

function up(b: ButtonName) {
  if (active.value === b) active.value = null
  pressVirtualOff(props.player, b)
}

const dirs: { b: ButtonName; cls: string; glyph: string }[] = [
  { b: 'UP', cls: 'up', glyph: '▲' },
  { b: 'LEFT', cls: 'left', glyph: '◀' },
  { b: 'RIGHT', cls: 'right', glyph: '▶' },
  { b: 'DOWN', cls: 'down', glyph: '▼' },
]
</script>

<template>
  <div class="pad" :class="'p' + player">
    <div class="pad-shell">
      <div class="head">
        <span class="who pixel">PLAYER {{ player }}</span>
        <span class="plug" :class="{ live: held.size > 0 }" />
      </div>

      <div class="body">
        <!-- 十字键 -->
        <div class="dpad">
          <button
            v-for="d in dirs"
            :key="d.b"
            class="dir"
            :class="[d.cls, { on: isOn(d.b) }]"
            @pointerdown="down(d.b, $event)"
            @pointerup="up(d.b)"
            @pointerleave="up(d.b)"
            @pointercancel="up(d.b)"
          >
            <span class="glyph">{{ d.glyph }}</span>
          </button>
          <span class="dpad-core" />
        </div>

        <!-- 右侧按键区 -->
        <div class="actions">
          <div class="turbo-row">
            <button
              class="round small"
              :class="{ on: isOn('TURBO_B') }"
              @pointerdown="down('TURBO_B', $event)"
              @pointerup="up('TURBO_B')"
              @pointerleave="up('TURBO_B')"
            >
              <span class="lbl">连发 B</span>
              <span class="k">{{ keyHint('TURBO_B') }}</span>
            </button>
            <button
              class="round small"
              :class="{ on: isOn('TURBO_A') }"
              @pointerdown="down('TURBO_A', $event)"
              @pointerup="up('TURBO_A')"
              @pointerleave="up('TURBO_A')"
            >
              <span class="lbl">连发 A</span>
              <span class="k">{{ keyHint('TURBO_A') }}</span>
            </button>
          </div>

          <div class="main-row">
            <button
              class="round big b"
              :class="{ on: isOn('B') }"
              @pointerdown="down('B', $event)"
              @pointerup="up('B')"
              @pointerleave="up('B')"
            >
              <span class="lbl">B</span>
              <span class="k">{{ keyHint('B') }}</span>
            </button>
            <button
              class="round big a"
              :class="{ on: isOn('A') }"
              @pointerdown="down('A', $event)"
              @pointerup="up('A')"
              @pointerleave="up('A')"
            >
              <span class="lbl">A</span>
              <span class="k">{{ keyHint('A') }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="foot">
        <button
          class="pill"
          :class="{ on: isOn('SELECT') }"
          @pointerdown="down('SELECT', $event)"
          @pointerup="up('SELECT')"
          @pointerleave="up('SELECT')"
        >
          SELECT
        </button>
        <button
          class="pill"
          :class="{ on: isOn('START') }"
          @pointerdown="down('START', $event)"
          @pointerup="up('START')"
          @pointerleave="up('START')"
        >
          START
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pad {
  flex: 1;
  min-width: 0;
}

.pad-shell {
  border-radius: 12px;
  padding: 9px 12px 11px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0) 40%),
    linear-gradient(180deg, #efe9da, #d5cebb);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    inset 0 0 0 1px rgba(120, 110, 90, 0.18),
    0 8px 18px rgba(60, 50, 30, 0.16);
}
.pad.p2 .pad-shell {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0) 40%),
    linear-gradient(180deg, #e9e2d2, #cfc7b2);
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.head .who {
  font-size: 8px;
  letter-spacing: 0.18em;
  color: #8b8371;
}
.head .plug {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #b3ab98;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.5);
  transition: all 0.12s ease;
}
.head .plug.live {
  background: radial-gradient(circle at 35% 30%, #ffe9a8, #f2b41d);
  box-shadow: 0 0 8px rgba(242, 180, 29, 0.9);
}

.body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

/* 十字键 */
.dpad {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 30px);
  grid-template-rows: repeat(3, 30px);
  flex: none;
}
.dpad .dir {
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, #4a473e, #2a2822);
  color: #b9b2a1;
  font-size: 9px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    inset 0 -2px 0 rgba(0, 0, 0, 0.5);
  transition: all 0.06s linear;
}
.dpad .dir.up {
  grid-area: 1 / 2;
  border-radius: 6px 6px 2px 2px;
}
.dpad .dir.left {
  grid-area: 2 / 1;
  border-radius: 6px 2px 2px 6px;
}
.dpad .dir.right {
  grid-area: 2 / 3;
  border-radius: 2px 6px 6px 2px;
}
.dpad .dir.down {
  grid-area: 3 / 2;
  border-radius: 2px 2px 6px 6px;
}
.dpad .dpad-core {
  grid-area: 2 / 2;
  background: linear-gradient(180deg, #46433b, #2c2a24);
  box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.7);
}
.dpad .dir.on {
  background: linear-gradient(180deg, #c9403a, #8d1a15);
  color: #ffe6c9;
  box-shadow:
    inset 0 2px 5px rgba(0, 0, 0, 0.6),
    0 0 12px rgba(220, 70, 50, 0.6);
}
.dpad .glyph {
  transform: scale(0.9);
  opacity: 0.85;
}

/* 圆键 */
.actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.turbo-row,
.main-row {
  display: flex;
  gap: 9px;
}
.round {
  display: grid;
  place-items: center;
  gap: 1px;
  border-radius: 50%;
  color: #2b2718;
  background: linear-gradient(180deg, #fbe08f 0%, #d9a93b 55%, #a87c19 100%);
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.55),
    inset 0 -3px 5px rgba(0, 0, 0, 0.3),
    0 3px 0 rgba(120, 88, 16, 0.45),
    0 5px 10px rgba(0, 0, 0, 0.2);
  transition: all 0.06s linear;
}
.round .lbl {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1;
}
.round .k {
  font-family: var(--font-term);
  font-size: 11px;
  line-height: 1;
  opacity: 0.72;
}
.round.small {
  width: 40px;
  height: 30px;
  border-radius: 15px;
  background: linear-gradient(180deg, #6d6a5f 0%, #4a473e 60%, #33312a 100%);
  color: #e6dfd0;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    inset 0 -2px 0 rgba(0, 0, 0, 0.4),
    0 2px 0 rgba(0, 0, 0, 0.3);
}
.round.small .lbl {
  font-size: 9px;
  font-weight: 600;
}
.round.big {
  width: 46px;
  height: 46px;
}
.round.on {
  transform: translateY(3px);
  box-shadow:
    inset 0 3px 6px rgba(0, 0, 0, 0.45),
    0 0 14px rgba(255, 200, 70, 0.6);
  filter: brightness(1.08);
}
.round.small.on {
  background: linear-gradient(180deg, #b8383a, #7c1618);
  color: #ffe1c9;
}

/* START / SELECT */
.foot {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px dashed rgba(120, 110, 90, 0.28);
}
.pill {
  padding: 5px 16px;
  border-radius: 999px;
  font-family: var(--font-pixel);
  font-size: 7px;
  letter-spacing: 0.12em;
  color: #e8e2d3;
  background: linear-gradient(180deg, #55524a, #2f2d27);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    0 2px 0 rgba(0, 0, 0, 0.35);
  transition: all 0.06s linear;
}
.pill.on {
  transform: translateY(2px);
  background: linear-gradient(180deg, #c33b34, #83161a);
  box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.5);
}
</style>
