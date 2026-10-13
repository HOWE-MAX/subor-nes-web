/**
 * 本地持久化
 * - IndexedDB：ROM 卡带库、即时存档、记忆电池存档
 * - localStorage：设置、按键映射
 */

const DB_NAME = 'subor-nes'
const DB_VERSION = 1
const STORE_ROMS = 'roms'
const STORE_STATES = 'states'
const STORE_BATTERY = 'battery'

export interface StoredRom {
  id: string
  name: string
  data: Uint8Array
  size: number
  addedAt: number
  lastPlayed: number
}

export interface StoredState {
  id: string
  romId: string
  slot: number
  label: string
  data: string
  thumb: string
  savedAt: number
}

export interface StoredBattery {
  romId: string
  data: string
  savedAt: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前浏览器不支持 IndexedDB'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_ROMS)) {
        db.createObjectStore(STORE_ROMS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_STATES)) {
        const s = db.createObjectStore(STORE_STATES, { keyPath: 'id' })
        s.createIndex('romId', 'romId', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_BATTERY)) {
        db.createObjectStore(STORE_BATTERY, { keyPath: 'romId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 打开失败'))
  })
  return dbPromise
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = fn(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('IndexedDB 操作失败'))
      }),
  )
}

/** 数据库是否可用（隐私模式等场景可能不可用） */
export async function storageAvailable(): Promise<boolean> {
  try {
    await openDB()
    return true
  } catch {
    return false
  }
}

// ------------------------------------------------------------------ ROM 库

export const romRepo = {
  async all(): Promise<StoredRom[]> {
    const list = await tx<StoredRom[]>(STORE_ROMS, 'readonly', (s) => s.getAll())
    return list.sort((a, b) => b.lastPlayed - a.lastPlayed)
  },
  get(id: string): Promise<StoredRom | undefined> {
    return tx<StoredRom | undefined>(STORE_ROMS, 'readonly', (s) => s.get(id))
  },
  put(rom: StoredRom): Promise<IDBValidKey> {
    return tx(STORE_ROMS, 'readwrite', (s) => s.put(rom))
  },
  delete(id: string): Promise<undefined> {
    return tx(STORE_ROMS, 'readwrite', (s) => s.delete(id))
  },
  async clear(): Promise<void> {
    await tx(STORE_ROMS, 'readwrite', (s) => s.clear())
  },
}

// ------------------------------------------------------------------ 存档

export const stateRepo = {
  async byRom(romId: string): Promise<StoredState[]> {
    const list = await tx<StoredState[]>(STORE_STATES, 'readonly', (s) =>
      s.index('romId').getAll(romId),
    )
    return list.sort((a, b) => a.slot - b.slot)
  },
  get(romId: string, slot: number): Promise<StoredState | undefined> {
    return tx<StoredState | undefined>(STORE_STATES, 'readonly', (s) =>
      s.get(`${romId}#${slot}`),
    )
  },
  put(state: StoredState): Promise<IDBValidKey> {
    return tx(STORE_STATES, 'readwrite', (s) => s.put(state))
  },
  delete(romId: string, slot: number): Promise<undefined> {
    return tx(STORE_STATES, 'readwrite', (s) => s.delete(`${romId}#${slot}`))
  },
  async deleteByRom(romId: string): Promise<void> {
    const list = await stateRepo.byRom(romId)
    await Promise.all(list.map((s) => stateRepo.delete(romId, s.slot)))
  },
  async all(): Promise<StoredState[]> {
    return tx<StoredState[]>(STORE_STATES, 'readonly', (s) => s.getAll())
  },
}

// ------------------------------------------------------------------ 记忆电池

export const batteryRepo = {
  get(romId: string): Promise<StoredBattery | undefined> {
    return tx<StoredBattery | undefined>(STORE_BATTERY, 'readonly', (s) =>
      s.get(romId),
    )
  },
  put(b: StoredBattery): Promise<IDBValidKey> {
    return tx(STORE_BATTERY, 'readwrite', (s) => s.put(b))
  },
  delete(romId: string): Promise<undefined> {
    return tx(STORE_BATTERY, 'readwrite', (s) => s.delete(romId))
  },
}

// ------------------------------------------------------------------ 设置

const SETTINGS_KEY = 'subor-nes:settings'
const KEYMAP_KEY = 'subor-nes:keymap'

export function loadJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 配额满等场景忽略 */
  }
}

export const KEYS = {
  settings: SETTINGS_KEY,
  keymap: KEYMAP_KEY,
}
