'use client'

import { useState } from 'react'
import { Guest } from '@/lib/client/guest'
import { EVENT } from '@/lib/event'

export default function NameForm({ onDone }: { onDone: (g: Guest) => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      onDone({ id: data.guestId, name: data.name })
    } catch {
      setError('Не получилось сохранить имя. Проверь связь и попробуй ещё раз.')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-[80dvh] flex-col justify-center gap-8 text-center">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-wine">{EVENT.date}</p>
        <h1 className="font-serif text-4xl text-wine">{EVENT.couple}</h1>
      </header>

      <div className="mx-auto max-w-xs space-y-2 border-y border-line py-6">
        <p className="font-serif text-lg">У тебя есть плёнка на 10 кадров</p>
        <p className="text-sm opacity-70">
          Снимай моменты этого вечера — каждый кадр сразу попадает в наш общий альбом.
        </p>
      </div>

      <form onSubmit={submit} className="mx-auto flex w-full max-w-xs flex-col gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          placeholder="Как тебя зовут?"
          className="rounded-none border-b border-ink/40 bg-transparent py-2 text-center text-lg outline-none focus:border-wine"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="mt-2 rounded-full bg-wine py-3 font-mono text-sm uppercase tracking-widest text-paper disabled:opacity-40"
        >
          {busy ? 'секунду…' : 'Начать съёмку'}
        </button>
        {error && <p className="text-sm text-wine">{error}</p>}
      </form>
    </div>
  )
}
