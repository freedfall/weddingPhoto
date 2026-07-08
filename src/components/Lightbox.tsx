'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GalleryPhoto } from '@/components/GalleryGrid'

type Props = {
  photos: GalleryPhoto[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}

type Anim = 'prev' | 'next' | 'cancel' | null

const SWIPE_THRESHOLD = 60

export default function Lightbox({ photos, index, onIndex, onClose }: Props) {
  const [drag, setDrag] = useState(0)
  const [anim, setAnim] = useState<Anim>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)

  // блокируем прокрутку страницы под лайтбоксом
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go('prev')
      if (e.key === 'ArrowRight') go('next')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const photo = photos[index]
  if (!photo) return null
  const hasPrev = index > 0
  const hasNext = index < photos.length - 1

  function go(dir: 'prev' | 'next') {
    if (anim) return
    if (dir === 'prev' && hasPrev) setAnim('prev')
    if (dir === 'next' && hasNext) setAnim('next')
  }

  function onTouchStart(e: React.TouchEvent) {
    if (anim) return
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!touchStart.current || anim) return
    const dx = e.touches[0].clientX - touchStart.current.x
    const dy = e.touches[0].clientY - touchStart.current.y
    if (Math.abs(dy) > Math.abs(dx) * 1.5 && Math.abs(dx) < 12) return // вертикальный жест — не наш
    swiped.current = true
    // на краях ленты — «резинка»
    const limited = (dx > 0 && !hasPrev) || (dx < 0 && !hasNext) ? dx * 0.25 : dx
    setDrag(limited)
  }

  function onTouchEnd() {
    if (!touchStart.current || anim) return
    touchStart.current = null
    if (drag < -SWIPE_THRESHOLD && hasNext) setAnim('next')
    else if (drag > SWIPE_THRESHOLD && hasPrev) setAnim('prev')
    else if (drag !== 0) setAnim('cancel')
  }

  function onStripTransitionEnd(e: React.TransitionEvent) {
    if (e.propertyName !== 'transform') return
    if (anim === 'next') onIndex(index + 1)
    if (anim === 'prev') onIndex(index - 1)
    setDrag(0)
    setAnim(null)
  }

  const transform =
    anim === 'next' ? 'translateX(-100%)'
    : anim === 'prev' ? 'translateX(100%)'
    : `translateX(${drag}px)`

  // соседние кадры уже в ленте — свайп показывает их сразу, без дозагрузки
  const slides: Array<{ p: GalleryPhoto; slot: number } | null> = [
    hasPrev ? { p: photos[index - 1], slot: -1 } : null,
    { p: photo, slot: 0 },
    hasNext ? { p: photos[index + 1], slot: 1 } : null,
  ]

  // тап по тёмному фону закрывает; «клик», прилетевший после свайпа, — нет
  function onBackdropClick() {
    if (swiped.current) {
      swiped.current = false
      return
    }
    onClose()
  }

  return createPortal(
    <div className="fade-in fixed inset-0 z-50 flex flex-col bg-ink/95" onClick={onBackdropClick}>
      <div className="flex justify-end p-4">
        <button aria-label="Закрыть" className="px-2 font-mono text-2xl text-paper" onClick={onClose}>
          ✕
        </button>
      </div>

      <div
        className="relative flex-1 overflow-hidden"
        style={{ touchAction: 'pan-y' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="h-full w-full"
          style={{
            transform,
            transition: anim ? 'transform 0.3s cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none',
          }}
          onTransitionEnd={onStripTransitionEnd}
        >
          {slides.map(
            (s) =>
              s && (
                <figure
                  key={s.p.id}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-3 pb-6"
                  style={{ left: `${s.slot * 100}%` }}
                >
                  {s.p.fullUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={s.p.fullUrl}
                      alt={`Фото от ${s.p.name}`}
                      draggable={false}
                      onClick={(e) => e.stopPropagation()}
                      className="max-h-[80dvh] max-w-full border-4 border-white object-contain shadow-lg"
                    />
                  )}
                  <figcaption className="font-mono text-xs tracking-wider text-paper/80">
                    {s.p.name} ·{' '}
                    {new Date(s.p.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </figcaption>
                </figure>
              )
          )}
        </div>

        {hasPrev && (
          <button
            aria-label="Предыдущее"
            onClick={(e) => {
              e.stopPropagation()
              go('prev')
            }}
            className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-ink/40 px-3 py-1 font-mono text-3xl text-paper/80"
          >
            ‹
          </button>
        )}
        {hasNext && (
          <button
            aria-label="Следующее"
            onClick={(e) => {
              e.stopPropagation()
              go('next')
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-ink/40 px-3 py-1 font-mono text-3xl text-paper/80"
          >
            ›
          </button>
        )}
      </div>
    </div>,
    document.body
  )
}
