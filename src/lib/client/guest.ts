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
