'use client'

import { useCallback, useEffect, useState } from 'react'
import { GalleryPhoto } from '@/components/GalleryGrid'

const KEY = 'wp_admin'

export default function AdminPage() {
  const [password, setPassword] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [downloading, setDownloading] = useState(false)

  const refresh = useCallback(() => {
    if (!password) return
    fetch('/api/photos?includeHidden=1', { headers: { 'x-admin-password': password }, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setPhotos(d.photos))
      .catch(() => {})
  }, [password])

  useEffect(() => {
    const saved = sessionStorage.getItem(KEY)
    if (saved) setPassword(saved)
  }, [])

  useEffect(() => {
    if (password) refresh()
  }, [password, refresh])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/admin/check', { headers: { 'x-admin-password': input } })
    if (res.status === 204) {
      sessionStorage.setItem(KEY, input)
      setPassword(input)
    } else {
      setError('Неверный пароль')
    }
  }

  async function remove(id: string) {
    if (!password || !confirm('Удалить это фото навсегда?')) return
    const res = await fetch(`/api/photos/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': password },
    })
    if (res.status === 204) setPhotos((prev) => prev.filter((p) => p.id !== id))
    else alert('Не удалось удалить')
  }

  async function setHidden(photo: GalleryPhoto, hidden: boolean) {
    if (!password) return
    const res = await fetch(`/api/photos/${photo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ hidden }),
    })
    if (!res.ok) {
      alert('Не удалось изменить видимость')
      return
    }
    const data = await res.json()
    setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, hiddenAt: data.hiddenAt } : p)))
  }

  async function downloadAll() {
    if (!password || downloading) return
    setDownloading(true)
    try {
      const res = await fetch('/api/download', { headers: { 'x-admin-password': password } })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'wedding-photos.zip'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Не удалось скачать архив')
    } finally {
      setDownloading(false)
    }
  }

  if (!password) {
    return (
      <form onSubmit={login} className="mx-auto flex min-h-[70dvh] max-w-xs flex-col justify-center gap-3">
        <h1 className="text-center font-serif text-2xl text-wine">Для своих</h1>
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Пароль"
          className="border-b border-ink/40 bg-transparent py-2 text-center outline-none focus:border-wine"
        />
        <button type="submit" className="rounded-full bg-wine py-3 font-mono text-sm uppercase tracking-widest text-paper">
          Войти
        </button>
        {error && <p className="text-center text-sm text-wine">{error}</p>}
      </form>
    )
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-wine">Админка</h1>
        <button
          onClick={downloadAll}
          disabled={downloading}
          className="rounded-full bg-wine px-4 py-2 font-mono text-xs uppercase tracking-widest text-paper disabled:opacity-40"
        >
          {downloading ? 'собираю…' : 'Скачать всё (ZIP)'}
        </button>
      </header>
      <p className="font-mono text-xs opacity-60">
        Всего фото: {photos.length} · скрыто: {photos.filter((p) => p.hiddenAt).length}
      </p>
      <div className="columns-2 gap-3 sm:columns-3">
        {photos.map((p) => (
          <figure key={p.id} className={`mb-3 break-inside-avoid bg-white p-2 shadow-sm${p.hiddenAt ? ' opacity-50' : ''}`}>
            {p.thumbUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={p.thumbUrl} alt={`Фото от ${p.name}`} loading="lazy" className="w-full" />
            )}
            <figcaption className="flex items-center justify-between gap-2 py-1 font-mono text-[10px]">
              <span className="opacity-60">{p.name}</span>
              <span className="flex gap-2">
                <button onClick={() => setHidden(p, !p.hiddenAt)} className="underline underline-offset-2">
                  {p.hiddenAt ? 'вернуть' : 'скрыть'}
                </button>
                <button onClick={() => remove(p.id)} className="text-wine underline underline-offset-2">
                  удалить
                </button>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
