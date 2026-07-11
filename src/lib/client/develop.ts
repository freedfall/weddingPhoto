// Отличает фото, приплывшие в галерею после её первого показа в этой
// вкладке: только они получают анимацию «проявки». Состояние живёт на
// вкладку — как photosCache на странице галереи. Кадр «проявляется» одно
// окно времени после появления, поэтому при повторном заходе в галерею
// анимация не проигрывается заново.
const DEVELOP_WINDOW_MS = 5000

let primed = false
const seen = new Set<string>()
const firstSeen = new Map<string, number>()

export function developSet(ids: string[]): Set<string> {
  const now = Date.now()
  if (!primed) {
    primed = true
    ids.forEach((id) => seen.add(id))
    return new Set()
  }
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id)
      firstSeen.set(id, now)
    }
  }
  const developing = new Set<string>()
  for (const [id, t] of firstSeen) {
    if (now - t < DEVELOP_WINDOW_MS) developing.add(id)
    else firstSeen.delete(id)
  }
  return developing
}

export function _resetDevelopTracker() {
  primed = false
  seen.clear()
  firstSeen.clear()
}
