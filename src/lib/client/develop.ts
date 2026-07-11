// Отличает фото, приплывшие в галерею после её первого показа в этой
// вкладке: только они получают анимацию «проявки». Состояние живёт на
// вкладку — как photosCache на странице галереи.
let primed = false
const seen = new Set<string>()
const developing = new Set<string>()

export function developSet(ids: string[]): Set<string> {
  if (!primed) {
    primed = true
    ids.forEach((id) => seen.add(id))
    return developing
  }
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id)
      developing.add(id)
    }
  }
  return developing
}

export function _resetDevelopTracker() {
  primed = false
  seen.clear()
  developing.clear()
}
