'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { loadGuest } from '@/lib/client/guest'
import GalleryGrid, { GalleryPhoto } from '@/components/GalleryGrid'

const POLL_MS = 8000

export default function GalleryPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])

  const refresh = useCallback(() => {
    fetch('/api/photos')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setPhotos(d.photos))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const guest = loadGuest()
    if (!guest) {
      setAllowed(false)
      return
    }
    fetch(`/api/guests/${guest.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setAllowed(d.used >= 1))
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
        <h1 className="font-serif text-2xl text-wine">Общий альбом</h1>
        <Link href="/" className="font-mono text-xs uppercase tracking-widest underline underline-offset-4">
          к камере
        </Link>
      </header>
      <GalleryGrid photos={photos} />
    </div>
  )
}
