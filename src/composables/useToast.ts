import { ref } from 'vue'

export interface Toast {
  id: number
  text: string
  kind: 'info' | 'ok' | 'warn' | 'error'
  ttl: number
}

const list = ref<Toast[]>([])
let seq = 1

function push(text: string, kind: Toast['kind'] = 'info', ttl = 2400): void {
  const id = seq++
  list.value.push({ id, text, kind, ttl })
  window.setTimeout(() => {
    list.value = list.value.filter((t) => t.id !== id)
  }, ttl)
}

export function useToast() {
  return {
    toasts: list,
    info: (t: string) => push(t, 'info'),
    ok: (t: string) => push(t, 'ok'),
    warn: (t: string) => push(t, 'warn', 3200),
    error: (t: string) => push(t, 'error', 4200),
    dismiss: (id: number) => {
      list.value = list.value.filter((t) => t.id !== id)
    },
  }
}
