'use client'

import { useEffect, useState } from 'react'
import Lightbox from '@/components/Lightbox'
import { photoTilt } from '@/lib/client/tilt'
import { developSet } from '@/lib/client/develop'

export type GalleryPhoto = {
  id: string
  name: string
  createdAt: string
  width: number | null
  height: number | null
  thumbUrl: string | null
  fullUrl: string | null
  hiddenAt?: string | null
}

export default function GalleryGrid({ photos }: { photos: GalleryPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [loadedIds, setLoadedIds] = useState<Set<string>>(() => new Set())
  const [columnCount, setColumnCount] = useState(2)
  // фото, появившиеся после первого показа галереи, «проявляются»
  const developing = developSet(photos.map((p) => p.id))

  useEffect(() => {
    const query = window.matchMedia('(min-width: 640px)')
    const updateColumnCount = () => setColumnCount(query.matches ? 3 : 2)
    updateColumnCount()
    query.addEventListener('change', updateColumnCount)
    return () => query.removeEventListener('change', updateColumnCount)
  }, [])

  function markLoaded(id: string) {
    setLoadedIds((current) => {
      if (current.has(id)) return current
      return new Set(current).add(id)
    })
  }

  if (photos.length === 0) {
    return <p className="py-16 text-center font-mono text-sm opacity-60">Пока ни одного кадра — будь первым!</p>
  }

  // Раскладываем кадры в самую короткую колонку. В отличие от CSS columns,
  // это не меняет поток элементов и не может скрыть карточку при перебалансировке.
  const columns = Array.from({ length: columnCount }, () => [] as Array<{ photo: GalleryPhoto; index: number }>)
  const columnHeights = Array.from({ length: columnCount }, () => 0)
  photos.forEach((photo, index) => {
    const target = columnHeights.indexOf(Math.min(...columnHeights))
    columns[target].push({ photo, index })
    columnHeights[target] += photo.width && photo.height ? photo.height / photo.width : 4 / 3
  })

  return (
    <>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
        {columns.map((column, columnIndex) => (
          <div key={columnIndex} className="flex min-w-0 flex-col gap-3">
            {column.map(({ photo: p, index: i }) => {
              const tilt = photoTilt(p.id)
              const isLoaded = loadedIds.has(p.id)
              return (
                <figure
                  key={p.id}
                  className="card-in min-w-0 bg-white p-2 pb-1 transition-transform active:scale-[0.98]"
                  style={
                    {
                      animationDelay: `${Math.min(i * 40, 400)}ms`,
                      '--tilt': `${tilt.rotate}deg`,
                      transform: 'rotate(var(--tilt))',
                      boxShadow: `${tilt.shadowX}px 2px 8px rgba(28, 26, 23, 0.14)`,
                    } as React.CSSProperties
                  }
                  onClick={() => setOpenIndex(i)}
                >
                  <div
                    className="w-full overflow-hidden bg-cream"
                    style={{ aspectRatio: p.width && p.height ? `${p.width} / ${p.height}` : '3 / 4' }}
                  >
                    {p.thumbUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        ref={(element) => {
                          if (element?.complete) markLoaded(p.id)
                        }}
                        src={p.thumbUrl}
                        alt={`Фото от ${p.name}`}
                        loading="lazy"
                        onLoad={() => markLoaded(p.id)}
                        className={`h-full w-full object-cover${
                          isLoaded && developing.has(p.id) ? ' develop' : ''
                        }`}
                      />
                    )}
                  </div>
                  <figcaption className="flex justify-between py-1 font-mono text-[10px] uppercase">
                    <span className="opacity-60">{p.name}</span>
                    <span className="text-sepia">
                      {new Date(p.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </figcaption>
                </figure>
              )
            })}
          </div>
        ))}
      </div>
      {openIndex !== null && (
        <Lightbox photos={photos} index={openIndex} onIndex={setOpenIndex} onClose={() => setOpenIndex(null)} />
      )}
    </>
  )
}
