'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { compressImage } from '@/lib/client/compress'
import { Guest } from '@/lib/client/guest'
import { uploadWithRetry } from '@/lib/client/upload'
import { PHOTO_LIMIT } from '@/lib/validation'

export default function CameraScreen({ guest }: { guest: Guest }) {
  const [used, setUsed] = useState<number | null>(null)
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/guests/${guest.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setUsed(d.used))
      .catch(() => setUsed(0))
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
      discardPreview()
    } else if (result.fatal && result.status === 409) {
      setUsed(PHOTO_LIMIT)
      discardPreview()
    } else {
      setError('Не удалось отправить фото. Кадр не потрачен — попробуй ещё раз.')
    }
  }

  if (used === null) return <p className="py-20 text-center font-mono text-sm">плёнка заряжается…</p>

  const left = PHOTO_LIMIT - used
  const done = left <= 0

  return (
    <div className="flex min-h-[85dvh] flex-col items-center justify-between py-4 text-center">
      <header className="space-y-1">
        <p className="font-serif text-xl">Привет, {guest.name}!</p>
        <div className="mx-auto mt-3 inline-block border border-line bg-white/60 px-4 py-1">
          <span className="font-mono text-2xl tabular-nums text-wine">
            {String(left).padStart(2, '0')}/{PHOTO_LIMIT}
          </span>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-widest opacity-50">кадров осталось</p>
      </header>

      {done ? (
        <div className="space-y-4">
          <p className="font-serif text-2xl text-wine">Плёнка отснята 🎞</p>
          <p className="text-sm opacity-70">Спасибо! Все твои кадры уже в общем альбоме.</p>
        </div>
      ) : preview ? (
        <div className="w-full space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt="Твой кадр" className="mx-auto max-h-[45dvh] border-8 border-white shadow-md" />
          <div className="flex justify-center gap-3">
            <button
              onClick={keep}
              disabled={sending}
              className="rounded-full bg-wine px-6 py-3 font-mono text-sm uppercase tracking-widest text-paper disabled:opacity-40"
            >
              {sending ? 'отправляется…' : 'Оставить'}
            </button>
            <button
              onClick={discardPreview}
              disabled={sending}
              className="rounded-full border border-ink/30 px-6 py-3 font-mono text-sm uppercase tracking-widest disabled:opacity-40"
            >
              Переснять
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          aria-label="Сделать снимок"
          className="grid size-24 place-items-center rounded-full border-4 border-wine/30"
        >
          <span className="block size-16 rounded-full bg-wine" />
        </button>
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
