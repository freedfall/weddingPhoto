'use client'

import { GalleryPhoto } from '@/components/GalleryGrid'

type Props = {
  photos: GalleryPhoto[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}

export default function Lightbox({ photos, index, onIndex, onClose }: Props) {
  const photo = photos[index]
  if (!photo) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/95" onClick={onClose}>
      <div className="flex justify-end p-4">
        <button aria-label="Закрыть" className="font-mono text-2xl text-paper">✕</button>
      </div>
      <div className="flex flex-1 items-center justify-between gap-2 px-2 pb-8" onClick={(e) => e.stopPropagation()}>
        <button
          aria-label="Предыдущее"
          disabled={index === 0}
          onClick={() => onIndex(index - 1)}
          className="p-3 font-mono text-2xl text-paper disabled:opacity-20"
        >
          ‹
        </button>
        <figure className="max-h-full">
          {photo.fullUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={photo.fullUrl} alt={`Фото от ${photo.name}`} className="max-h-[75dvh] w-auto border-8 border-white" />
          )}
          <figcaption className="pt-2 text-center font-mono text-xs text-paper/70">{photo.name}</figcaption>
        </figure>
        <button
          aria-label="Следующее"
          disabled={index === photos.length - 1}
          onClick={() => onIndex(index + 1)}
          className="p-3 font-mono text-2xl text-paper disabled:opacity-20"
        >
          ›
        </button>
      </div>
    </div>
  )
}
