'use client'

import { useState } from 'react'
import Lightbox from '@/components/Lightbox'
import { GalleryPhoto } from '@/components/GalleryGrid'

export default function GalleryTimeline({ photos }: { photos: GalleryPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const chronological = [...photos].reverse()

  return (
    <>
      <ol className="relative ml-3 border-l border-line pl-5">
        {chronological.map((photo, index) => (
          <li key={photo.id} className="relative pb-7 last:pb-0">
            <span className="absolute -left-[1.66rem] top-2 size-3 rounded-full border-2 border-paper bg-wine" aria-hidden />
            <button type="button" className="block w-full text-left" onClick={() => setOpenIndex(index)}>
              <time className="font-mono text-[11px] uppercase tracking-widest text-sepia">
                {new Date(photo.createdAt).toLocaleString('ru-RU', {
                  day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
                })}
              </time>
              <figure className="mt-2 bg-white p-2 pb-1 shadow-sm transition-transform active:scale-[0.98]">
                <div
                  className="overflow-hidden bg-cream"
                  style={{ aspectRatio: photo.width && photo.height ? `${photo.width} / ${photo.height}` : '3 / 4' }}
                >
                  {photo.thumbUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={photo.thumbUrl} alt={`Фото от ${photo.name}`} loading="lazy" className="h-full w-full object-cover" />
                  )}
                </div>
                <figcaption className="pt-1 font-mono text-xs uppercase opacity-60">{photo.name}</figcaption>
              </figure>
            </button>
          </li>
        ))}
      </ol>
      {openIndex !== null && (
        <Lightbox photos={chronological} index={openIndex} onIndex={setOpenIndex} onClose={() => setOpenIndex(null)} />
      )}
    </>
  )
}
