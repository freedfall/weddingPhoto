export type Guest = { id: string; name: string }

const KEY = 'wp_guest'

export function loadGuest(): Guest | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const g = JSON.parse(raw)
    return typeof g?.id === 'string' && typeof g?.name === 'string' ? g : null
  } catch {
    return null
  }
}

export function saveGuest(g: Guest): void {
  localStorage.setItem(KEY, JSON.stringify(g))
}

const USED_KEY = 'wp_used'

// Кэш счётчика кадров: галерея открывается мгновенно, без запроса к серверу.
// Источник правды — сервер; кэш обновляется камерой при каждой загрузке фото.
export function loadUsedCache(): number | null {
  try {
    const n = Number(localStorage.getItem(USED_KEY))
    return Number.isInteger(n) && n >= 1 ? n : null
  } catch {
    return null
  }
}

export function saveUsedCache(used: number): void {
  try {
    localStorage.setItem(USED_KEY, String(used))
  } catch {
    // приватный режим Safari — просто живём без кэша
  }
}
