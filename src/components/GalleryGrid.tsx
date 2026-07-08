'use client'

import { useState } from 'react'
import Lightbox from '@/components/Lightbox'

export type GalleryPhoto = {
  id: string
  name: string
  createdAt: string
  width: number | null
  height: number | null
  thumbUrl: string | null
  fullUrl: string | null
}

// картинка появляется плавно; для уже закэшированных браузером — сразу
function revealWhenLoaded(el: HTMLImageElement | null) {
  if (el?.complete) el.classList.add('loaded')
}

export default function GalleryGrid({ photos }: { photos: GalleryPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (photos.length === 0) {
    return <p className="py-16 text-center font-mono text-sm opacity-60">Пока ни одного кадра — будь первым!</p>
  }

  return (
    <>
      <div className="columns-2 gap-3 sm:columns-3">
        {photos.map((p, i) => (
          <figure
            key={p.id}
            className="card-in mb-3 break-inside-avoid bg-white p-2 pb-1 shadow-sm transition-transform active:scale-[0.98]"
            style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
            onClick={() => setOpenIndex(i)}
          >
            <div
              className="w-full overflow-hidden bg-line/40"
              style={{ aspectRatio: p.width && p.height ? `${p.width} / ${p.height}` : '3 / 4' }}
            >
              {p.thumbUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  ref={revealWhenLoaded}
                  src={p.thumbUrl}
                  alt={`Фото от ${p.name}`}
                  loading="lazy"
                  onLoad={(e) => e.currentTarget.classList.add('loaded')}
                  className="img-fade h-full w-full object-cover"
                />
              )}
            </div>
            <figcaption className="flex justify-between py-1 font-mono text-[10px] opacity-60">
              <span>{p.name}</span>
              <span>{new Date(p.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      {openIndex !== null && (
        <Lightbox photos={photos} index={openIndex} onIndex={setOpenIndex} onClose={() => setOpenIndex(null)} />
      )}
    </>
  )
}
