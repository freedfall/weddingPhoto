'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useEmblaCarousel from 'embla-carousel-react'
import { GalleryPhoto } from '@/components/GalleryGrid'

type Props = {
  photos: GalleryPhoto[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}

function neighbors(i: number): number[] {
  return [i - 1, i, i + 1]
}

export default function Lightbox({ photos, index, onIndex, onClose }: Props) {
  // startIndex фиксируем на момент открытия: если подставлять текущий index,
  // каждый свайп меняет опции → embla делает reInit и доводка обрывается рывком
  const initialIndex = useRef(index)
  const [emblaRef, embla] = useEmblaCarousel({ startIndex: initialIndex.current, duration: 22 })
  // полные фото грузим только вокруг текущего кадра, а не все 700 разом
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set(neighbors(index)))
  const [canPrev, setCanPrev] = useState(index > 0)
  const [canNext, setCanNext] = useState(index < photos.length - 1)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const swiped = useRef(false)

  async function downloadPhoto(photo: GalleryPhoto) {
    if (!photo.fullUrl || downloadingId) return
    setDownloadingId(photo.id)
    try {
      const response = await fetch(photo.fullUrl)
      if (!response.ok) throw new Error('download failed')

      const objectUrl = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `wedding-photo-${photo.createdAt.slice(0, 10)}.jpg`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
    } finally {
      setDownloadingId(null)
    }
  }

  // блокируем прокрутку страницы под лайтбоксом
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    if (!embla) return
    const onSelect = () => {
      const i = embla.selectedScrollSnap()
      onIndex(i)
      setLoaded((prev) => {
        const next = new Set(prev)
        neighbors(i).forEach((n) => next.add(n))
        return next
      })
      setCanPrev(embla.canScrollPrev())
      setCanNext(embla.canScrollNext())
    }
    const onScroll = () => {
      swiped.current = true
    }
    embla.on('select', onSelect)
    embla.on('scroll', onScroll)
    return () => {
      embla.off('select', onSelect)
      embla.off('scroll', onScroll)
    }
  }, [embla, onIndex])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') embla?.scrollPrev()
      if (e.key === 'ArrowRight') embla?.scrollNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [embla, onClose])

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

      <div className="relative flex-1">
        <div className="h-full overflow-hidden" ref={emblaRef}>
          <div className="flex h-full touch-pan-y">
            {photos.map((p, i) => (
              <figure
                key={p.id}
                className="flex h-full min-w-0 flex-[0_0_100%] flex-col items-center justify-center gap-3 px-3 pb-6"
              >
                {p.fullUrl && loaded.has(i) && (
                  <div className="relative max-w-full bg-white p-2 pb-1 shadow-xl" onClick={(e) => e.stopPropagation()}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.fullUrl}
                      alt={`Фото от ${p.name}`}
                      draggable={false}
                      className="block max-h-[72dvh] max-w-full object-contain"
                    />
                    <figcaption className="flex justify-between pt-1 font-mono text-[10px] uppercase">
                      <span className="opacity-60">{p.name}</span>
                      <span className="text-sepia">
                        {new Date(p.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </figcaption>
                    <button
                      type="button"
                      aria-label="Скачать фото"
                      title="Скачать фото"
                      disabled={downloadingId === p.id}
                      onClick={() => downloadPhoto(p)}
                      className="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-white/85 text-ink shadow-sm transition-opacity hover:bg-white disabled:opacity-50"
                    >
                      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                        <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                )}
              </figure>
            ))}
          </div>
        </div>

        {canPrev && (
          <button
            aria-label="Предыдущее"
            onClick={(e) => {
              e.stopPropagation()
              embla?.scrollPrev()
            }}
            className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-ink/40 px-3 py-1 font-mono text-3xl text-paper/80"
          >
            ‹
          </button>
        )}
        {canNext && (
          <button
            aria-label="Следующее"
            onClick={(e) => {
              e.stopPropagation()
              embla?.scrollNext()
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
