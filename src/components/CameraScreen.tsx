'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { compressImage } from '@/lib/client/compress'
import { Guest, saveUsedCache } from '@/lib/client/guest'
import { uploadWithRetry } from '@/lib/client/upload'
import { PHOTO_LIMIT } from '@/lib/validation'

export default function CameraScreen({ guest }: { guest: Guest }) {
  const [used, setUsed] = useState<number | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function loadUsed() {
    setLoadFailed(false)
    setUsed(null)
    fetch(`/api/guests/${guest.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setUsed(d.used)
        if (d.used >= 1) saveUsedCache(d.used)
      })
      .catch(() => setLoadFailed(true))
  }

  useEffect(() => {
    loadUsed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guest.id])

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    try {
      const blob = await compressImage(file)
      setPreview({ blob, url: URL.createObjectURL(blob) })
    } catch {
      setError('Не удалось обработать снимок, попробуй ещё раз.')
    }
  }

  function discardPreview() {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  async function keep() {
    if (!preview || sending) return
    setSending(true)
    setError('')
    const result = await uploadWithRetry(preview.blob, guest.id)
    setSending(false)
    if (result.ok) {
      setUsed(result.data.used)
      saveUsedCache(result.data.used)
      discardPreview()
    } else if (result.fatal && result.status === 409) {
      setUsed(PHOTO_LIMIT)
      saveUsedCache(PHOTO_LIMIT)
      discardPreview()
    } else {
      setError('Не удалось отправить фото. Кадр не потрачен — попробуй ещё раз.')
    }
  }

  if (loadFailed) {
    return (
      <div className="space-y-4 py-20 text-center">
        <p className="font-mono text-sm">Не удалось загрузить плёнку. Проверь связь.</p>
        <button
          onClick={loadUsed}
          className="rounded-full border border-ink/30 px-6 py-3 font-mono text-sm uppercase tracking-widest"
        >
          Попробовать ещё раз
        </button>
      </div>
    )
  }

  if (used === null) return <p className="py-20 text-center font-mono text-sm">плёнка заряжается…</p>

  const left = PHOTO_LIMIT - used
  const done = left <= 0

  return (
    <div className="flex min-h-[85dvh] flex-col items-center justify-between py-4 text-center">
      <header className="space-y-1">
        <p className="font-serif text-2xl font-medium">Привет, {guest.name}!</p>
        <div className="mx-auto mt-3 inline-block overflow-hidden rounded-md bg-ink px-4 shadow-sm">
          <div className="perf-strip perf-strip--paper opacity-40" aria-hidden />
          <span key={left} className="counter-roll block py-1 font-mono text-2xl tabular-nums text-paper">
            {String(left).padStart(2, '0')}
            <span className="text-paper/50">/{PHOTO_LIMIT}</span>
          </span>
          <div className="perf-strip perf-strip--paper opacity-40" aria-hidden />
        </div>
        <p className="font-mono text-[11px] uppercase tracking-widest opacity-50">кадров осталось</p>
      </header>

      {done ? (
        <div className="card-in space-y-4">
          <svg viewBox="0 0 120 80" className="mx-auto w-28" aria-hidden>
            <rect x="72" y="30" width="34" height="20" fill="var(--color-ink)" />
            <path d="M106 30 h8 a4 4 0 0 1 0 8 h-8 z" fill="var(--color-ink)" />
            <rect x="8" y="12" width="64" height="56" rx="8" fill="var(--color-ink)" />
            <rect x="24" y="4" width="12" height="10" rx="2" fill="var(--color-ink)" />
            <rect x="16" y="24" width="48" height="32" rx="3" fill="var(--color-paper)" />
            <text x="40" y="38" textAnchor="middle" fontSize="9" fill="var(--color-wine)" fontFamily="var(--font-mono)">
              WED 400
            </text>
            <text x="40" y="50" textAnchor="middle" fontSize="7" fill="var(--color-ink)" fontFamily="var(--font-mono)">
              10 EXP
            </text>
          </svg>
          <p className="font-serif text-3xl font-semibold text-wine">Плёнка отснята</p>
          <p className="text-sm opacity-70">Спасибо! Все твои кадры уже в общем альбоме.</p>
        </div>
      ) : preview ? (
        <div className="card-in w-full space-y-4">
          <div className="mx-auto inline-block max-w-full bg-ink px-2 shadow-md">
            <div className="perf-strip perf-strip--paper" aria-hidden />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.url} alt="Твой кадр" className="max-h-[42dvh] max-w-full object-contain py-1" />
            <div className="flex items-center justify-between pb-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-sepia">
                frame {String(used + 1).padStart(2, '0')}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-paper/40">wedding 400</span>
            </div>
            <div className="perf-strip perf-strip--paper" aria-hidden />
          </div>
          <div className="flex justify-center gap-3">
            <button
              onClick={keep}
              disabled={sending}
              className="rounded-full bg-wine px-6 py-3 font-mono text-sm uppercase tracking-widest text-paper transition-transform active:scale-95 disabled:opacity-40"
            >
              {sending ? 'отправляется…' : 'Оставить'}
            </button>
            <button
              onClick={discardPreview}
              disabled={sending}
              className="rounded-full border border-ink/30 px-6 py-3 font-mono text-sm uppercase tracking-widest transition-transform active:scale-95 disabled:opacity-40"
            >
              Переснять
            </button>
          </div>
          {sending && (
            <p className="font-mono text-[11px] uppercase tracking-widest opacity-60">
              сохраняем кадр в альбом — не закрывай страницу
            </p>
          )}
        </div>
      ) : (
        <div className="relative grid size-28 place-items-center">
          <svg
            className="pointer-events-none absolute inset-0 size-full -rotate-90"
            viewBox="0 0 100 100"
            aria-hidden
          >
            <circle cx="50" cy="50" r="46" fill="none" stroke="var(--color-line)" strokeWidth="3" />
            {used > 0 && (
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="var(--color-wine)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${(used / PHOTO_LIMIT) * 289} 289`}
                className="motion-safe:transition-[stroke-dasharray] motion-safe:duration-500"
              />
            )}
          </svg>
          <button
            onClick={() => inputRef.current?.click()}
            aria-label="Сделать снимок"
            className="group relative z-10 grid size-24 place-items-center rounded-full border-4 border-wine/30 transition-transform active:scale-90"
          >
            <span className="block size-16 rounded-full bg-wine transition-transform group-active:scale-90" />
          </button>
        </div>
      )}

      <footer className="space-y-3">
        {error && <p className="text-sm text-wine">{error}</p>}
        {used >= 1 && (
          <Link href="/gallery" className="font-mono text-sm uppercase tracking-widest text-wine underline underline-offset-4">
            Смотреть общий альбом →
          </Link>
        )}
      </footer>

      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={onPick} hidden />
    </div>
  )
}
