<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toasts, dismiss } = useToast()
</script>

<template>
  <div class="toast-stack">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast"
        :class="'kind-' + t.kind"
        @click="dismiss(t.id)"
      >
        <span class="icon">
          {{ t.kind === 'ok' ? '✔' : t.kind === 'error' ? '✖' : t.kind === 'warn' ? '!' : 'i' }}
        </span>
        <span class="text">{{ t.text }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 9px;
  align-items: flex-end;
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 190px;
  max-width: 360px;
  padding: 9px 14px 9px 10px;
  border-radius: 8px;
  font-size: 13px;
  color: #fdfbf5;
  background: linear-gradient(180deg, #3b3833, #26241f);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.3);
  cursor: pointer;
}
.toast .icon {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  color: #26241f;
  background: var(--gold);
  flex: none;
}
.toast.kind-ok .icon {
  background: #4bc07a;
  color: #08210f;
}
.toast.kind-warn .icon {
  background: #f0b429;
}
.toast.kind-error .icon {
  background: #e5432c;
  color: #fff;
}
.toast.kind-error {
  border-color: rgba(229, 67, 44, 0.5);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(24px) scale(0.96);
}
</style>
