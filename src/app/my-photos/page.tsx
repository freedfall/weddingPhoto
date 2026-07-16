'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import GalleryGrid, { GalleryPhoto } from '@/components/GalleryGrid'
import { loadGuest } from '@/lib/client/guest'

export default function MyPhotosPage() {
  const [name, setName] = useState<string | null>(null)
  const [photos, setPhotos] = useState<GalleryPhoto[] | null>(null)

  useEffect(() => {
    const guest = loadGuest()
    if (!guest) {
      setName(null)
      setPhotos([])
      return
    }
    setName(guest.name)
    fetch(`/api/photos?guestId=${encodeURIComponent(guest.id)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setPhotos(data.photos))
      .catch(() => setPhotos([]))
  }, [])

  if (photos === null) return <p className="py-20 text-center font-mono text-sm">проявляем твою плёнку…</p>
  if (!name) {
    return (
      <div className="py-20 text-center">
        <p className="font-serif text-2xl">Сначала назовись у камеры</p>
        <Link href="/" className="mt-4 inline-block font-mono text-sm uppercase tracking-widest text-wine underline underline-offset-4">
          К камере →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest opacity-50">твоя плёнка</p>
            <h1 className="font-serif text-3xl font-semibold text-wine">{name}</h1>
          </div>
          <Link href="/gallery" className="font-mono text-xs uppercase tracking-widest underline underline-offset-4">
            общий альбом
          </Link>
        </div>
        <div className="perf-strip opacity-30" aria-hidden />
      </header>
      {photos.length ? <GalleryGrid photos={photos} /> : <p className="py-16 text-center font-serif text-xl">Твоя плёнка пока ждёт первого кадра</p>}
    </div>
  )
}
