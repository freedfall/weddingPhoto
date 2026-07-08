'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { loadGuest, loadUsedCache, saveUsedCache } from '@/lib/client/guest'
import GalleryGrid, { GalleryPhoto } from '@/components/GalleryGrid'

const POLL_MS = 8000

// Кэш на время жизни вкладки: при повторном заходе галерея рисуется сразу,
// свежий список подтягивается фоном (и далее раз в 8 секунд).
let photosCache: GalleryPhoto[] | null = null

export default function GalleryPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [photos, setPhotos] = useState<GalleryPhoto[]>(photosCache ?? [])
  const [loaded, setLoaded] = useState(photosCache !== null)

  const refresh = useCallback(() => {
    fetch('/api/photos')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        photosCache = d.photos
        setPhotos(d.photos)
        setLoaded(true)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const guest = loadGuest()
    if (!guest) {
      setAllowed(false)
      return
    }
    // Быстрый путь: камера уже сохранила счётчик — открываем сразу, без запроса.
    if (loadUsedCache() !== null) {
      setAllowed(true)
      return
    }
    fetch(`/api/guests/${guest.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (d.used >= 1) saveUsedCache(d.used)
        setAllowed(d.used >= 1)
      })
      .catch(() => setAllowed(false))
  }, [])

  useEffect(() => {
    if (!allowed) return
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [allowed, refresh])

  if (allowed === null) return null
  if (!allowed) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 text-center">
        <p className="font-serif text-xl">Альбом откроется после твоего первого кадра</p>
        <Link href="/" className="font-mono text-sm uppercase tracking-widest text-wine underline underline-offset-4">
          ← К камере
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <header className="flex items-baseline justify-between">
        <h1 className="font-serif text-2xl font-semibold text-wine">Общий альбом</h1>
        <Link href="/" className="font-mono text-xs uppercase tracking-widest underline underline-offset-4">
          к камере
        </Link>
      </header>
      {loaded ? <GalleryGrid photos={photos} /> : <GallerySkeleton />}
    </div>
  )
}

function GallerySkeleton() {
  const heights = ['h-36', 'h-48', 'h-40', 'h-52', 'h-44', 'h-36']
  return (
    <div className="columns-2 gap-3 sm:columns-3">
      {heights.map((h, i) => (
        <div key={i} className="skeleton mb-3 break-inside-avoid bg-white p-2 pb-1 shadow-sm" style={{ animationDelay: `${i * 120}ms` }}>
          <div className={`${h} w-full bg-line/60`} />
          <div className="my-1.5 h-2 w-1/2 bg-line/60" />
        </div>
      ))}
    </div>
  )
}
