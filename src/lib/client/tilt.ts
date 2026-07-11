// Детерминированный «разброс» фотокарточек на столе: угол и сдвиг тени
// вычисляются из hash(id), поэтому стабильны между рендерами и заходами.
export function photoTilt(id: string): { rotate: number; shadowX: number } {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  const unitA = (((h % 1000) + 1000) % 1000) / 999
  const unitB = ((((h >> 10) % 1000) + 1000) % 1000) / 999
  return {
    rotate: (unitA - 0.5) * 3,
    shadowX: (unitB - 0.5) * 4,
  }
}
