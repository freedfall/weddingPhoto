'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { loadGuest, loadUsedCache, saveUsedCache } from '@/lib/client/guest'
import GalleryGrid, { GalleryPhoto } from '@/components/GalleryGrid'
import GalleryTimeline from '@/components/GalleryTimeline'

const POLL_MS = 8000

// Кэш на время жизни вкладки: при повторном заходе галерея рисуется сразу,
// свежий список подтягивается фоном (и далее раз в 8 секунд).
let photosCache: GalleryPhoto[] | null = null

export default function GalleryPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [photos, setPhotos] = useState<GalleryPhoto[]>(photosCache ?? [])
  const [loaded, setLoaded] = useState(photosCache !== null)
  const [view, setView] = useState<'grid' | 'timeline'>('grid')
  const latestRefresh = useRef(0)

  const refresh = useCallback(() => {
    const request = ++latestRefresh.current
    fetch('/api/photos', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        // Запросы от таймера и возврата на вкладку могут завершиться не по
        // порядку. Устаревший ответ не должен затирать более свежий список.
        if (request !== latestRefresh.current) return
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
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-sepia">wedding film · live</p>
            <h1 className="font-serif text-4xl font-semibold leading-none text-wine">Общий альбом</h1>
          </div>
          <Link
            href="/"
            className="mt-1 rounded-full border border-ink/15 bg-white/60 px-4 py-2 font-mono text-xs uppercase tracking-wide transition-transform active:scale-95"
          >
            ← камера
          </Link>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white/55 p-1.5">
          <span className="px-3 font-mono text-xs uppercase tracking-wide text-ink/55">Все кадры</span>
          <Link
            href="/my-photos"
            className="rounded-xl bg-ink px-4 py-2 font-mono text-xs uppercase tracking-wide text-paper transition-transform active:scale-95"
          >
            Моя плёнка →
          </Link>
        </div>
        {loaded && photos.length > 0 && (
          <div className="mx-auto flex w-fit rounded-2xl bg-ink/[0.06] p-1.5 font-mono text-sm uppercase tracking-wide">
            <button
              onClick={() => setView('grid')}
              className={`rounded-xl px-5 py-2.5 transition-colors ${
                view === 'grid' ? 'bg-paper text-wine shadow-sm' : 'text-ink/45'
              }`}
              aria-pressed={view === 'grid'}
            >
              Сетка
            </button>
            <button
              onClick={() => setView('timeline')}
              className={`rounded-xl px-5 py-2.5 transition-colors ${
                view === 'timeline' ? 'bg-paper text-wine shadow-sm' : 'text-ink/45'
              }`}
              aria-pressed={view === 'timeline'}
          >
            Лента
          </button>
          </div>
        )}
      </header>
      {loaded ? (view === 'grid' ? <GalleryGrid photos={photos} /> : <GalleryTimeline photos={photos} />) : <GallerySkeleton />}
    </div>
  )
}

function GallerySkeleton() {
  const heights = ['h-36', 'h-48', 'h-40', 'h-52', 'h-44', 'h-36']
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {heights.map((h, i) => (
        <div key={i} className="skeleton self-start bg-white p-2 pb-1 shadow-sm" style={{ animationDelay: `${i * 120}ms` }}>
          <div className={`${h} w-full bg-line/60`} />
          <div className="my-1.5 h-2 w-1/2 bg-line/60" />
        </div>
      ))}
    </div>
  )
}
