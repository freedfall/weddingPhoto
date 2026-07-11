# Analog-Film Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Пересобрать все гостевые экраны свадебного фотоприложения вокруг метафоры аналоговой плёнки (перфорация, кассета, проявка, галерея-стол), не меняя логику.

**Architecture:** Только представления: `globals.css` (тема, перфорация, анимация проявки), `layout.tsx` (шрифт Cormorant), четыре компонента (NameForm, CameraScreen, GalleryGrid, Lightbox) и страница галереи. Два новых чистых модуля с юнит-тестами: детерминированный «разброс» карточек и трекер новых фото для эффекта проявки.

**Tech Stack:** Next 15 (app router), Tailwind CSS v4 (`@theme` в globals.css), next/font/google, vitest.

**Spec:** `docs/superpowers/specs/2026-07-12-film-redesign-design.md`

## Global Constraints

- Логика не меняется: API-роуты, `photo-service`, `upload`, `compress`, `guest`, Embla-карусель, polling, admin — не трогать.
- Никаких новых npm-зависимостей и растровых ассетов; вся графика — CSS/инлайн-SVG/data-URI.
- `prefers-reduced-motion: reduce` — все новые анимации отключаются или вырождаются в fade.
- Zero-CLS: aspect-ratio-контейнеры в галерее сохраняются как есть.
- Тексты на русском, «технические» маркировки плёнки — латиницей в моно (`WEDDING FILM · 10 EXP`).
- Данные события берутся только из `EVENT` (`src/lib/event.ts`), лимит — из `PHOTO_LIMIT` (`src/lib/validation.ts`).
- После каждой задачи: `npx vitest run` зелёный.

---

### Task 1: Фундамент темы — шрифт, палитра, перфорация, keyframes

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces (CSS-классы для следующих задач): `.perf-strip`, `.perf-strip--paper`, `.film-strip-v`, `.develop` (работает в связке с `.img-fade.loaded`), CSS-переменная `--tilt` внутри `card-in`; токены `--color-sepia`, `--color-cream`; `--font-serif` = Cormorant.

- [ ] **Step 1: Подключить Cormorant в layout**

Заменить содержимое `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Cormorant, JetBrains_Mono, Montserrat_Alternates } from 'next/font/google'
import './globals.css'

const cormorant = Cormorant({
  subsets: ['cyrillic', 'latin'],
  weight: ['500', '600', '700'],
  variable: '--font-cormorant',
})
const montserratAlt = Montserrat_Alternates({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-msa',
})
const jbMono = JetBrains_Mono({ subsets: ['cyrillic', 'latin'], variable: '--font-jbmono' })

export const metadata: Metadata = {
  title: 'Свадебная плёнка',
  description: '10 кадров на гостя — общий альбом свадьбы',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body
        className={`${cormorant.variable} ${montserratAlt.variable} ${jbMono.variable} bg-paper text-ink font-sans antialiased min-h-dvh`}
      >
        <main className="mx-auto max-w-md min-h-dvh px-5 py-6">{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Обновить тему и добавить плёночные элементы в globals.css**

В `src/app/globals.css`:

2a. Заменить блок `@theme`:

```css
@theme {
  --color-paper: #FAF6EE;
  --color-ink: #1C1A17;
  --color-wine: #6E1423;
  --color-line: #E5DCCB;
  --color-sepia: #B07A35;
  --color-cream: #F1E7D4;
  --font-serif: var(--font-cormorant), serif;
  --font-sans: var(--font-msa), sans-serif;
  --font-mono: var(--font-jbmono), monospace;
}
```

2b. В правиле `body::before` поднять зерно: `opacity: 0.07;` и в data-URI SVG заменить `width='120' height='120'` на `width='90' height='90'` (в обоих местах — svg и rect).

2c. Заменить keyframes `card-in`, чтобы поворот `--tilt` переживал анимацию (fill-mode `both` иначе затирает инлайновый transform):

```css
@keyframes card-in {
  from { opacity: 0; transform: translateY(8px) scale(0.98) rotate(var(--tilt, 0deg)); }
  to { opacity: 1; transform: translateY(0) scale(1) rotate(var(--tilt, 0deg)); }
}
```

2d. Добавить в конец файла (перед медиа-запросом reduced-motion):

```css
/* --- плёночные элементы --- */

/* горизонтальный ряд перфорации: тёмные «окошки» на прозрачном фоне */
.perf-strip {
  height: 9px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='9'%3E%3Crect x='4' y='0.5' width='10' height='8' rx='2' fill='%231C1A17'/%3E%3C/svg%3E");
  background-repeat: repeat-x;
}

/* вариант для тёмных подложек: окошки цвета бумаги */
.perf-strip--paper {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='9'%3E%3Crect x='4' y='0.5' width='10' height='8' rx='2' fill='%23FAF6EE'/%3E%3C/svg%3E");
}

/* вертикальная полоска плёнки: тёмная лента с перфорацией по краям */
.film-strip-v {
  width: 34px;
  border-radius: 3px;
  background-color: var(--color-ink);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='18'%3E%3Crect x='4' y='5' width='6' height='9' rx='2' fill='%23FAF6EE'/%3E%3Crect x='24' y='5' width='6' height='9' rx='2' fill='%23FAF6EE'/%3E%3C/svg%3E");
  background-repeat: repeat-y;
}

/* «проявка»: новое фото проступает из засвеченной сепии.
   Стартует только когда картинка загрузилась (класс loaded), иначе
   анимация успела бы отыграть на пустом теге. */
@keyframes develop {
  0% { opacity: 0.25; filter: sepia(0.9) blur(6px) brightness(1.5) contrast(0.65); }
  55% { opacity: 1; filter: sepia(0.55) blur(2px) brightness(1.15) contrast(0.85); }
  100% { opacity: 1; filter: none; }
}

.img-fade.loaded.develop {
  animation: develop 1.2s ease-out both;
}
```

2e. В медиа-запрос `prefers-reduced-motion` добавить строку:

```css
  .img-fade.loaded.develop { animation: fade-in 0.25s ease-out both; }
```

- [ ] **Step 3: Проверить, что ничего не сломалось**

Run: `npx vitest run`
Expected: все существующие тесты PASS.

Run: `npx next build`
Expected: build успешен (проверяет, что Cormorant с указанными weights/subsets существует).

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: film theme foundation - Cormorant, sepia palette, perforation, develop keyframes"
```

---

### Task 2: Детерминированный «разброс» карточек (photoTilt)

**Files:**
- Create: `src/lib/client/tilt.ts`
- Test: `tests/tilt.test.ts`

**Interfaces:**
- Produces: `photoTilt(id: string): { rotate: number; shadowX: number }` — `rotate` в градусах в диапазоне [-1.5, 1.5], `shadowX` в px в диапазоне [-2, 2]; чистая детерминированная функция.

- [ ] **Step 1: Написать падающий тест**

Создать `tests/tilt.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { photoTilt } from '@/lib/client/tilt'

describe('photoTilt', () => {
  it('детерминирован: одинаковый id даёт одинаковый результат', () => {
    expect(photoTilt('abc-123')).toEqual(photoTilt('abc-123'))
  })

  it('держит диапазоны: rotate в [-1.5, 1.5], shadowX в [-2, 2]', () => {
    for (const id of ['a', 'b', 'zz', 'photo-9f8e', '00000000-0000-0000-0000-000000000000']) {
      const { rotate, shadowX } = photoTilt(id)
      expect(rotate).toBeGreaterThanOrEqual(-1.5)
      expect(rotate).toBeLessThanOrEqual(1.5)
      expect(shadowX).toBeGreaterThanOrEqual(-2)
      expect(shadowX).toBeLessThanOrEqual(2)
    }
  })

  it('разные id дают разные повороты (хотя бы на этой паре)', () => {
    expect(photoTilt('first-id').rotate).not.toBe(photoTilt('second-id').rotate)
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run tests/tilt.test.ts`
Expected: FAIL — модуль `@/lib/client/tilt` не найден.

- [ ] **Step 3: Реализация**

Создать `src/lib/client/tilt.ts`:

```ts
// Детерминированный «разброс» фотокарточек на столе: угол и сдвиг тени
// вычисляются из hash(id), поэтому стабильны между рендерами и заходами.
export function photoTilt(id: string): { rotate: number; shadowX: number } {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  const unitA = (((h % 1000) + 1000) % 1000) / 999
  const unitB = ((((h >> 10) % 1000) + 1000) % 1000) / 999
  return {
    rotate: (unitA - 0.5) * 3,
    shadowX: (unitB - 0.5) * 4,
  }
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run tests/tilt.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/client/tilt.ts tests/tilt.test.ts
git commit -m "feat: deterministic photo tilt from id hash"
```

---

### Task 3: Трекер новых фото для эффекта проявки (developSet)

**Files:**
- Create: `src/lib/client/develop.ts`
- Test: `tests/develop.test.ts`

**Interfaces:**
- Produces: `developSet(ids: string[]): Set<string>` — вызывается на каждом рендере галереи с полным списком id; первый вызов «заряжает» базовую линию и возвращает пустой Set; далее возвращает накопленный Set id, появившихся после базовой линии (Set стабилен — id из него не удаляются, чтобы класс анимации не дёргался). `_resetDevelopTracker(): void` — только для тестов.
- Состояние module-level (живёт на вкладку, как существующий `photosCache`). Функция идемпотентна — безопасна при двойном рендере StrictMode.

- [ ] **Step 1: Написать падающий тест**

Создать `tests/develop.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { developSet, _resetDevelopTracker } from '@/lib/client/develop'

describe('developSet', () => {
  beforeEach(() => _resetDevelopTracker())

  it('первый вызов задаёт базовую линию и ничего не проявляет', () => {
    expect(developSet(['a', 'b']).size).toBe(0)
  })

  it('id, появившиеся после первого вызова, попадают в набор проявки', () => {
    developSet(['a', 'b'])
    expect([...developSet(['a', 'b', 'c'])]).toEqual(['c'])
  })

  it('набор накапливается и стабилен между вызовами', () => {
    developSet(['a'])
    developSet(['a', 'b'])
    const s = developSet(['a', 'b', 'c'])
    expect([...s].sort()) .toEqual(['b', 'c'])
    // повторный вызов с теми же id не меняет набор
    expect([...developSet(['a', 'b', 'c'])].sort()).toEqual(['b', 'c'])
  })

  it('идемпотентен при двойном первом вызове (StrictMode)', () => {
    developSet(['a'])
    expect(developSet(['a']).size).toBe(0)
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run tests/develop.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализация**

Создать `src/lib/client/develop.ts`:

```ts
// Отличает фото, приплывшие в галерею после её первого показа в этой
// вкладке: только они получают анимацию «проявки». Состояние живёт на
// вкладку — как photosCache на странице галереи.
let primed = false
const seen = new Set<string>()
const developing = new Set<string>()

export function developSet(ids: string[]): Set<string> {
  if (!primed) {
    primed = true
    ids.forEach((id) => seen.add(id))
    return developing
  }
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id)
      developing.add(id)
    }
  }
  return developing
}

export function _resetDevelopTracker() {
  primed = false
  seen.clear()
  developing.clear()
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run tests/develop.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/client/develop.ts tests/develop.test.ts
git commit -m "feat: develop-effect tracker for photos arriving after first gallery render"
```

---

### Task 4: Welcome-экран как упаковка плёнки (NameForm)

**Files:**
- Modify: `src/components/NameForm.tsx` (только JSX return; state и submit не трогать)

**Interfaces:**
- Consumes: CSS-классы Task 1 (`.film-strip-v`, `card-in` со стаггером через `animationDelay`).

- [ ] **Step 1: Переверстать return**

В `src/components/NameForm.tsx` заменить весь JSX return (логика выше остаётся):

```tsx
  return (
    <div className="flex min-h-[85dvh] flex-col items-center justify-center gap-7 text-center">
      <header className="card-in space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-ink/55">
          Wedding film · 10 exp
        </p>
        <h1 className="font-serif text-5xl font-semibold leading-tight text-wine">{EVENT.couple}</h1>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-sepia">{EVENT.date}</p>
      </header>

      <div className="film-strip-v card-in h-24" style={{ animationDelay: '120ms' }} aria-hidden />

      <div className="card-in max-w-xs space-y-2" style={{ animationDelay: '240ms' }}>
        <p className="font-serif text-2xl font-medium">У тебя есть плёнка на 10 кадров</p>
        <p className="text-sm opacity-70">
          Снимай моменты этого вечера — каждый кадр сразу попадает в наш общий альбом.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="card-in mx-auto flex w-full max-w-xs flex-col gap-3"
        style={{ animationDelay: '360ms' }}
      >
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
```

- [ ] **Step 2: Проверка**

Run: `npx vitest run`
Expected: PASS.

Run: `npx next build`
Expected: сборка успешна (ловит опечатки в JSX/классах).

- [ ] **Step 3: Commit**

```bash
git add src/components/NameForm.tsx
git commit -m "feat: welcome screen styled as film box - marking, serif names, film strip axis"
```

---

### Task 5: Экран камеры — кассета, кадр плёнки, кольцо прогресса (CameraScreen)

**Files:**
- Modify: `src/components/CameraScreen.tsx` (только JSX return после `const left…`; state/handlers не трогать)

**Interfaces:**
- Consumes: `.perf-strip--paper` из Task 1; `PHOTO_LIMIT`, `used`, `left`, `done`, `preview`, `sending`, `guest` — уже есть в компоненте.

- [ ] **Step 1: Переверстать return**

В `src/components/CameraScreen.tsx` заменить финальный return (всё от `return (` до конца компонента; обработчики и ранние return'ы `loadFailed`/`used === null` не трогать):

```tsx
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
        </div>
      ) : (
        <div className="relative">
          <svg className="absolute -inset-2 -rotate-90" viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="46" fill="none" stroke="var(--color-line)" strokeWidth="3" />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="var(--color-wine)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(used / PHOTO_LIMIT) * 289} 289`}
              className="transition-[stroke-dasharray] duration-500"
            />
          </svg>
          <button
            onClick={() => inputRef.current?.click()}
            aria-label="Сделать снимок"
            className="group grid size-24 place-items-center rounded-full border-4 border-wine/30 transition-transform active:scale-90"
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
```

- [ ] **Step 2: Проверка**

Run: `npx vitest run`
Expected: PASS.

Run: `npx next build`
Expected: сборка успешна.

- [ ] **Step 3: Commit**

```bash
git add src/components/CameraScreen.tsx
git commit -m "feat: camera screen - cassette counter, film-frame preview, shutter progress ring"
```

---

### Task 6: Галерея-стол с проявкой (GalleryGrid + страница галереи)

**Files:**
- Modify: `src/components/GalleryGrid.tsx`
- Modify: `src/app/gallery/page.tsx` (только header в JSX)

**Interfaces:**
- Consumes: `photoTilt` из Task 2, `developSet` из Task 3, `.perf-strip` и `--tilt`-совместимый `card-in` из Task 1.

- [ ] **Step 1: Переверстать GalleryGrid**

Заменить содержимое `src/components/GalleryGrid.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Lightbox from '@/components/Lightbox'
import { photoTilt } from '@/lib/client/tilt'
import { developSet } from '@/lib/client/develop'

export type GalleryPhoto = {
  id: string
  name: string
  createdAt: string
  width: number | null
  height: number | null
  thumbUrl: string | null
  fullUrl: string | null
}

// картинка появляется плавно; для уже закэшированных браузером — сразу
function revealWhenLoaded(el: HTMLImageElement | null) {
  if (el?.complete) el.classList.add('loaded')
}

export default function GalleryGrid({ photos }: { photos: GalleryPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  // фото, появившиеся после первого показа галереи, «проявляются»
  const developing = developSet(photos.map((p) => p.id))

  if (photos.length === 0) {
    return <p className="py-16 text-center font-mono text-sm opacity-60">Пока ни одного кадра — будь первым!</p>
  }

  return (
    <>
      <div className="columns-2 gap-3 sm:columns-3">
        {photos.map((p, i) => {
          const tilt = photoTilt(p.id)
          return (
            <figure
              key={p.id}
              className="card-in mb-3 break-inside-avoid bg-white p-2 pb-1 transition-transform active:scale-[0.98]"
              style={
                {
                  animationDelay: `${Math.min(i * 40, 400)}ms`,
                  '--tilt': `${tilt.rotate}deg`,
                  transform: 'rotate(var(--tilt))',
                  boxShadow: `${tilt.shadowX}px 2px 8px rgba(28, 26, 23, 0.14)`,
                } as React.CSSProperties
              }
              onClick={() => setOpenIndex(i)}
            >
              <div
                className="w-full overflow-hidden bg-cream"
                style={{ aspectRatio: p.width && p.height ? `${p.width} / ${p.height}` : '3 / 4' }}
              >
                {p.thumbUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    ref={revealWhenLoaded}
                    src={p.thumbUrl}
                    alt={`Фото от ${p.name}`}
                    loading="lazy"
                    onLoad={(e) => e.currentTarget.classList.add('loaded')}
                    className={`img-fade h-full w-full object-cover${developing.has(p.id) ? ' develop' : ''}`}
                  />
                )}
              </div>
              <figcaption className="flex justify-between py-1 font-mono text-[10px] uppercase">
                <span className="opacity-60">{p.name}</span>
                <span className="text-sepia">
                  {new Date(p.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </figcaption>
            </figure>
          )
        })}
      </div>
      {openIndex !== null && (
        <Lightbox photos={photos} index={openIndex} onIndex={setOpenIndex} onClose={() => setOpenIndex(null)} />
      )}
    </>
  )
}
```

- [ ] **Step 2: Обновить шапку страницы галереи**

В `src/app/gallery/page.tsx` заменить header в основном return:

```tsx
      <header className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h1 className="font-serif text-3xl font-semibold text-wine">Общий альбом</h1>
          <Link href="/" className="font-mono text-xs uppercase tracking-widest underline underline-offset-4">
            к камере
          </Link>
        </div>
        <div className="perf-strip opacity-30" aria-hidden />
      </header>
```

- [ ] **Step 3: Проверка**

Run: `npx vitest run`
Expected: PASS (включая tilt и develop тесты).

Run: `npx next build`
Expected: сборка успешна.

- [ ] **Step 4: Commit**

```bash
git add src/components/GalleryGrid.tsx src/app/gallery/page.tsx
git commit -m "feat: gallery table - deterministic card tilt, develop-in for new photos, film header"
```

---

### Task 7: Лайтбокс — кадр плёнки и штамп даты

**Files:**
- Modify: `src/components/Lightbox.tsx` (только разметка `<figure>` внутри карусели; Embla-логика не трогается)

**Interfaces:**
- Consumes: `.perf-strip--paper` из Task 1, токен `text-sepia`.

- [ ] **Step 1: Переверстать слайд**

В `src/components/Lightbox.tsx` заменить разметку внутри `photos.map((p, i) => (...))`:

```tsx
              <figure
                key={p.id}
                className="flex h-full min-w-0 flex-[0_0_100%] flex-col items-center justify-center gap-3 px-3 pb-6"
              >
                {p.fullUrl && loaded.has(i) && (
                  <div className="max-w-full" onClick={(e) => e.stopPropagation()}>
                    <div className="perf-strip perf-strip--paper opacity-50" aria-hidden />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.fullUrl}
                      alt={`Фото от ${p.name}`}
                      draggable={false}
                      className="max-h-[76dvh] max-w-full object-contain py-1"
                    />
                    <div className="perf-strip perf-strip--paper opacity-50" aria-hidden />
                  </div>
                )}
                <figcaption className="font-mono text-xs uppercase tracking-[0.2em] text-sepia">
                  {p.name} ·{' '}
                  {new Date(p.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </figcaption>
              </figure>
```

Примечание: `onClick` со `stopPropagation` переезжает с `<img>` на обёртку — тап по рамке кадра тоже не должен закрывать лайтбокс; тап по тёмному фону закрывает, как раньше.

- [ ] **Step 2: Проверка**

Run: `npx vitest run`
Expected: PASS.

Run: `npx next build`
Expected: сборка успешна.

- [ ] **Step 3: Commit**

```bash
git add src/components/Lightbox.tsx
git commit -m "feat: lightbox film frame with perforation and sepia date stamp"
```

---

### Task 8: Финальная визуальная проверка

**Files:** нет изменений кода (правки — только если проверка найдёт дефекты).

- [ ] **Step 1: Прогнать все тесты и сборку**

Run: `npx vitest run && npx next build`
Expected: всё зелёное.

- [ ] **Step 2: Живая проверка в браузере**

Запустить dev-сервер (`npm run dev`) и пройти сценарий на мобильном вьюпорте (~390px):

1. `/` без localStorage — welcome: маркировка, имена Cormorant'ом, вертикальная плёнка, каскадное появление.
2. Ввести имя → камера: окошко кассеты с перфорацией, кольцо прогресса вокруг затвора.
3. Выбрать фото → превью в тёмном кадре с перфорацией и подписью `frame NN`.
4. Отправить → счётчик крутится, кольцо прогресса дорастает.
5. `/gallery` — карточки с лёгкими поворотами, разными тенями; подписи `ИМЯ · ЧЧ:ММ` с sepia-временем; перфорация под заголовком.
6. Пока галерея открыта, загрузить фото со второй вкладки → в течение 8 с новый кадр «проявляется» из сепии.
7. Открыть лайтбокс: перфорация сверху/снизу, sepia-штамп; свайп, стрелки, Esc, тап по фону — работают.
8. Включить в DevTools эмуляцию `prefers-reduced-motion: reduce` → проявка и каскады вырождаются в fade, ничего не прыгает.

Expected: все пункты соответствуют спеке; дефекты чинятся и коммитятся отдельно.

- [ ] **Step 3: Итоговый коммит (если были правки) и сверка со спекой**

Пройтись по `docs/superpowers/specs/2026-07-12-film-redesign-design.md` — каждый пункт «Утверждённых приёмов» реализован; раздел «Вне скоупа» не задет.
