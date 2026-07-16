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
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-sepia">твоя плёнка</p>
            <h1 className="font-serif text-4xl font-semibold leading-none text-wine">{name}</h1>
          </div>
          <Link
            href="/"
            className="mt-1 rounded-full border border-ink/15 bg-white/60 px-4 py-2 font-mono text-xs uppercase tracking-wide transition-transform active:scale-95"
          >
            ← камера
          </Link>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white/55 p-1.5">
          <span className="px-3 font-mono text-xs uppercase tracking-wide text-ink/55">Твои кадры</span>
          <Link
            href="/gallery"
            className="rounded-xl bg-ink px-4 py-2 font-mono text-xs uppercase tracking-wide text-paper transition-transform active:scale-95"
          >
            Общий альбом →
          </Link>
        </div>
      </header>
      {photos.length ? <GalleryGrid photos={photos} /> : <p className="py-16 text-center font-serif text-xl">Твоя плёнка пока ждёт первого кадра</p>}
    </div>
  )
}
