# Wedding Photo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Веб-приложение «плёнка на 10 кадров» для гостей свадьбы: съёмка камерой телефона, общая галерея с опросом раз в 8 секунд, админка с удалением и ZIP-выгрузкой.

**Architecture:** Next.js (App Router) на Vercel: три страницы (`/`, `/gallery`, `/admin`) + API-роуты. Supabase — Postgres (таблицы `guests`, `photos`, атомарная функция `claim_photo_slot`) и приватный Storage-бакет `photos` (оригинал 2560px + превью 400px на снимок). Все обращения к Supabase — только с сервера через service-ключ; браузер получает подписанные URL.

**Tech Stack:** Next.js 15 (TypeScript, App Router), Tailwind CSS v4, Supabase JS v2, sharp (превью), archiver (ZIP), Vitest (тесты), qrcode (QR-скрипт).

## Global Constraints

- Только бесплатные тарифы: Vercel Hobby, Supabase Free (Storage 1 ГБ, egress 5 ГБ/мес).
- Сжатие фото на клиенте: длинная сторона **2560px, JPEG quality 0.9**; превью на сервере: **ширина 400px, JPEG quality 75**.
- Лимит: **10 фото на гостя** (`PHOTO_LIMIT = 10`), проверка атомарная на сервере.
- Ключи Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) и `ADMIN_PASSWORD` живут только в env сервера, никаких `NEXT_PUBLIC_*` секретов.
- Палитра: фон `#FAF7F2`, текст `#1C1A17`, акцент `#6E1423`, линии `#E5DFD5`.
- Шрифты (Google Fonts, кириллица): Playfair Display (заголовки), Inter (текст), JetBrains Mono (счётчик/подписи).
- Весь UI-текст — русский, обращение к гостю на «ты».
- Node 20+, TypeScript strict. Vercel body limit 4.5 МБ — наши загрузки ~1 МБ; максимум принимаем 6 МБ.
- Имена молодожёнов и дата — в одном файле `src/lib/event.ts` (значения подставит владелец).

---

### Task 1: Скаффолд проекта + Vitest

**Files:**
- Create: весь каркас через `create-next-app` (в текущую папку `weddingPhoto`)
- Create: `vitest.config.ts`, `tests/smoke.test.ts`
- Modify: `package.json` (скрипт `test`)

**Interfaces:**
- Produces: рабочий Next.js-проект c алиасом `@/* → src/*`, команда `npm test` (Vitest).

- [ ] **Step 1: Создать проект**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```

(Каталог уже содержит `docs/` и `.git` — create-next-app спросит про непустую папку; подтвердить. Если откажется — создать во временной папке и перенести содержимое, сохранив `docs/`.)

- [ ] **Step 2: Установить зависимости**

```bash
npm i @supabase/supabase-js sharp archiver
npm i -D vitest @types/archiver qrcode @types/qrcode
```

- [ ] **Step 3: Конфиг Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
```

В `package.json` в `scripts` добавить: `"test": "vitest run"`.

- [ ] **Step 4: Smoke-тест**

Create `tests/smoke.test.ts`:

```ts
import { expect, test } from 'vitest'

test('vitest works', () => {
  expect(1 + 1).toBe(2)
})
```

- [ ] **Step 5: Проверить**

Run: `npm test` → Expected: `1 passed`.
Run: `npm run build` → Expected: успешная сборка.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest"
```

---

### Task 2: Схема Supabase + серверный клиент

**Files:**
- Create: `supabase/schema.sql`
- Create: `src/lib/supabase-server.ts`
- Create: `.env.example`, `.env.local` (в `.gitignore` уже есть)

**Interfaces:**
- Produces: `supabaseAdmin(): SupabaseClient` — серверный клиент с service-ключом; SQL-функция `claim_photo_slot(p_guest_id uuid, p_storage_path text, p_thumb_path text) → (photo_id uuid, photos_used int)`, кидающая `limit_reached` / `guest_not_found`; приватный бакет `photos`.

- [ ] **Step 1: Написать схему**

Create `supabase/schema.sql`:

```sql
create table guests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 50),
  created_at timestamptz not null default now()
);

create table photos (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests(id) on delete cascade,
  storage_path text not null,
  thumb_path text not null,
  created_at timestamptz not null default now()
);

create index photos_guest_id_idx on photos (guest_id);

-- Доступ только через service role: RLS включён, политик нет.
alter table guests enable row level security;
alter table photos enable row level security;

create or replace function claim_photo_slot(
  p_guest_id uuid,
  p_storage_path text,
  p_thumb_path text
) returns table (photo_id uuid, photos_used int)
language plpgsql
as $$
declare
  v_id uuid;
  v_used int;
begin
  perform 1 from guests where id = p_guest_id for update;
  if not found then
    raise exception 'guest_not_found';
  end if;

  select count(*) into v_used from photos where guest_id = p_guest_id;
  if v_used >= 10 then
    raise exception 'limit_reached';
  end if;

  insert into photos (guest_id, storage_path, thumb_path)
  values (p_guest_id, p_storage_path, p_thumb_path)
  returning id into v_id;

  return query select v_id, v_used + 1;
end;
$$;

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;
```

- [ ] **Step 2: Применить схему (ручной шаг)**

В дашборде Supabase: создать проект (если нет) → SQL Editor → вставить содержимое `supabase/schema.sql` → Run. Expected: `Success. No rows returned`.

- [ ] **Step 3: Серверный клиент**

Create `src/lib/supabase-server.ts`:

```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export function supabaseAdmin(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
```

- [ ] **Step 4: Env-файлы**

Create `.env.example`:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ADMIN_PASSWORD=choose-a-strong-password
```

Скопировать в `.env.local` и заполнить реальными значениями из Supabase → Project Settings → API (URL и `service_role` key).

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql src/lib/supabase-server.ts .env.example
git commit -m "feat: supabase schema, claim_photo_slot, server client"
```

---

### Task 3: Валидация входных данных (TDD)

**Files:**
- Create: `src/lib/validation.ts`
- Test: `tests/validation.test.ts`

**Interfaces:**
- Produces: `validateGuestName(raw: unknown): string | null` (trim, 1–50 символов, иначе null); `isValidGuestId(id: unknown): id is string` (uuid); `validateUpload(file: { type: string; size: number } | null): string | null` (null = ок, иначе код ошибки `no_file | bad_type | bad_size`); `MAX_UPLOAD_BYTES = 6 * 1024 * 1024`; `PHOTO_LIMIT = 10`.

- [ ] **Step 1: Написать падающие тесты**

Create `tests/validation.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import {
  validateGuestName, isValidGuestId, validateUpload, MAX_UPLOAD_BYTES,
} from '@/lib/validation'

describe('validateGuestName', () => {
  test('trims and accepts a normal name', () => {
    expect(validateGuestName('  Анна ')).toBe('Анна')
  })
  test('rejects empty, too long, non-string', () => {
    expect(validateGuestName('   ')).toBeNull()
    expect(validateGuestName('x'.repeat(51))).toBeNull()
    expect(validateGuestName(42)).toBeNull()
    expect(validateGuestName(undefined)).toBeNull()
  })
})

describe('isValidGuestId', () => {
  test('accepts uuid, rejects junk', () => {
    expect(isValidGuestId('123e4567-e89b-42d3-a456-426614174000')).toBe(true)
    expect(isValidGuestId('not-a-uuid')).toBe(false)
    expect(isValidGuestId(null)).toBe(false)
  })
})

describe('validateUpload', () => {
  test('accepts jpeg under limit', () => {
    expect(validateUpload({ type: 'image/jpeg', size: 1024 })).toBeNull()
  })
  test('rejects missing file, wrong type, zero and oversize', () => {
    expect(validateUpload(null)).toBe('no_file')
    expect(validateUpload({ type: 'image/png', size: 1024 })).toBe('bad_type')
    expect(validateUpload({ type: 'image/jpeg', size: 0 })).toBe('bad_size')
    expect(validateUpload({ type: 'image/jpeg', size: MAX_UPLOAD_BYTES + 1 })).toBe('bad_size')
  })
})
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npm test` → Expected: FAIL (модуль `@/lib/validation` не существует).

- [ ] **Step 3: Реализация**

Create `src/lib/validation.ts`:

```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024
export const PHOTO_LIMIT = 10

export function validateGuestName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.trim()
  if (name.length < 1 || name.length > 50) return null
  return name
}

export function isValidGuestId(id: unknown): id is string {
  return typeof id === 'string' && UUID_RE.test(id)
}

export function validateUpload(file: { type: string; size: number } | null): string | null {
  if (!file) return 'no_file'
  if (file.type !== 'image/jpeg') return 'bad_type'
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) return 'bad_size'
  return null
}
```

- [ ] **Step 4: Тесты зелёные**

Run: `npm test` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation.ts tests/validation.test.ts
git commit -m "feat: input validation helpers"
```

---

### Task 4: Проверка админ-пароля (TDD)

**Files:**
- Create: `src/lib/admin-auth.ts`
- Test: `tests/admin-auth.test.ts`

**Interfaces:**
- Consumes: заголовок `x-admin-password` из `Request`.
- Produces: `isAdminRequest(req: Request, password?: string): boolean` — сравнение через `timingSafeEqual`; `false`, если пароль в env не задан.

- [ ] **Step 1: Падающие тесты**

Create `tests/admin-auth.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { isAdminRequest } from '@/lib/admin-auth'

function reqWith(header?: string): Request {
  return new Request('http://x/', {
    headers: header === undefined ? {} : { 'x-admin-password': header },
  })
}

describe('isAdminRequest', () => {
  test('accepts correct password', () => {
    expect(isAdminRequest(reqWith('secret'), 'secret')).toBe(true)
  })
  test('rejects wrong, missing, different-length password', () => {
    expect(isAdminRequest(reqWith('nope'), 'secret')).toBe(false)
    expect(isAdminRequest(reqWith(''), 'secret')).toBe(false)
    expect(isAdminRequest(reqWith(undefined), 'secret')).toBe(false)
    expect(isAdminRequest(reqWith('secret-longer'), 'secret')).toBe(false)
  })
  test('rejects everything when password not configured', () => {
    expect(isAdminRequest(reqWith('anything'), undefined)).toBe(false)
    expect(isAdminRequest(reqWith(''), '')).toBe(false)
  })
})
```

- [ ] **Step 2: Убедиться, что падают**

Run: `npm test` → Expected: FAIL (модуль не существует).

- [ ] **Step 3: Реализация**

Create `src/lib/admin-auth.ts`:

```ts
import { timingSafeEqual } from 'node:crypto'

export function isAdminRequest(
  req: Request,
  password: string | undefined = process.env.ADMIN_PASSWORD
): boolean {
  if (!password) return false
  const given = Buffer.from(req.headers.get('x-admin-password') ?? '')
  const expected = Buffer.from(password)
  return given.length === expected.length && timingSafeEqual(given, expected)
}
```

- [ ] **Step 4: Тесты зелёные**

Run: `npm test` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-auth.ts tests/admin-auth.test.ts
git commit -m "feat: admin password check with timing-safe compare"
```

---

### Task 5: Сервис добавления фото (TDD)

**Files:**
- Create: `src/lib/photo-service.ts`
- Test: `tests/photo-service.test.ts`

**Interfaces:**
- Consumes: `PHOTO_LIMIT` из `@/lib/validation`.
- Produces:
  - `class LimitReachedError extends Error`, `class GuestNotFoundError extends Error`
  - `type PhotoDeps = { newId(): string; makeThumb(original: Buffer): Promise<Buffer>; uploadFile(path: string, data: Buffer, contentType: string): Promise<void>; removeFiles(paths: string[]): Promise<void>; claimSlot(guestId: string, storagePath: string, thumbPath: string): Promise<{ photoId: string; used: number }> }`
  - `addPhoto(deps: PhotoDeps, guestId: string, original: Buffer): Promise<{ photoId: string; used: number; remaining: number }>`
  - Пути файлов: оригинал `${guestId}/${id}.jpg`, превью `${guestId}/${id}_thumb.jpg`.
  - Порядок: thumb → upload обоих файлов → `claimSlot`; при ошибке claim — удалить оба файла и пробросить ошибку.

- [ ] **Step 1: Падающие тесты**

Create `tests/photo-service.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import {
  addPhoto, LimitReachedError, GuestNotFoundError, PhotoDeps,
} from '@/lib/photo-service'

function makeDeps(overrides: Partial<PhotoDeps> = {}) {
  const uploaded: string[] = []
  const removed: string[] = []
  const deps: PhotoDeps = {
    newId: () => 'photo-1',
    makeThumb: async () => Buffer.from('thumb'),
    uploadFile: async (path) => { uploaded.push(path) },
    removeFiles: async (paths) => { removed.push(...paths) },
    claimSlot: async () => ({ photoId: 'photo-1', used: 3 }),
    ...overrides,
  }
  return { deps, uploaded, removed }
}

const GUEST = '123e4567-e89b-42d3-a456-426614174000'

describe('addPhoto', () => {
  test('uploads original and thumb, returns counters', async () => {
    const { deps, uploaded } = makeDeps()
    const res = await addPhoto(deps, GUEST, Buffer.from('img'))
    expect(uploaded).toEqual([`${GUEST}/photo-1.jpg`, `${GUEST}/photo-1_thumb.jpg`])
    expect(res).toEqual({ photoId: 'photo-1', used: 3, remaining: 7 })
  })

  test('cleans up storage when limit reached', async () => {
    const { deps, removed } = makeDeps({
      claimSlot: async () => { throw new LimitReachedError('limit') },
    })
    await expect(addPhoto(deps, GUEST, Buffer.from('img'))).rejects.toBeInstanceOf(LimitReachedError)
    expect(removed).toEqual([`${GUEST}/photo-1.jpg`, `${GUEST}/photo-1_thumb.jpg`])
  })

  test('cleans up storage when guest not found', async () => {
    const { deps, removed } = makeDeps({
      claimSlot: async () => { throw new GuestNotFoundError('guest') },
    })
    await expect(addPhoto(deps, GUEST, Buffer.from('img'))).rejects.toBeInstanceOf(GuestNotFoundError)
    expect(removed.length).toBe(2)
  })

  test('propagates claim error even if cleanup fails', async () => {
    const { deps } = makeDeps({
      claimSlot: async () => { throw new LimitReachedError('limit') },
      removeFiles: async () => { throw new Error('storage down') },
    })
    await expect(addPhoto(deps, GUEST, Buffer.from('img'))).rejects.toBeInstanceOf(LimitReachedError)
  })
})
```

- [ ] **Step 2: Убедиться, что падают**

Run: `npm test` → Expected: FAIL.

- [ ] **Step 3: Реализация**

Create `src/lib/photo-service.ts`:

```ts
import { PHOTO_LIMIT } from '@/lib/validation'

export class LimitReachedError extends Error {}
export class GuestNotFoundError extends Error {}

export type PhotoDeps = {
  newId(): string
  makeThumb(original: Buffer): Promise<Buffer>
  uploadFile(path: string, data: Buffer, contentType: string): Promise<void>
  removeFiles(paths: string[]): Promise<void>
  claimSlot(guestId: string, storagePath: string, thumbPath: string): Promise<{ photoId: string; used: number }>
}

export async function addPhoto(
  deps: PhotoDeps,
  guestId: string,
  original: Buffer
): Promise<{ photoId: string; used: number; remaining: number }> {
  const id = deps.newId()
  const storagePath = `${guestId}/${id}.jpg`
  const thumbPath = `${guestId}/${id}_thumb.jpg`

  const thumb = await deps.makeThumb(original)
  await deps.uploadFile(storagePath, original, 'image/jpeg')
  await deps.uploadFile(thumbPath, thumb, 'image/jpeg')

  try {
    const { photoId, used } = await deps.claimSlot(guestId, storagePath, thumbPath)
    return { photoId, used, remaining: PHOTO_LIMIT - used }
  } catch (err) {
    await deps.removeFiles([storagePath, thumbPath]).catch(() => {})
    throw err
  }
}
```

- [ ] **Step 4: Тесты зелёные**

Run: `npm test` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/photo-service.ts tests/photo-service.test.ts
git commit -m "feat: photo upload service with limit cleanup"
```

---

### Task 6: Supabase-адаптер и публичные API-роуты

**Files:**
- Create: `src/lib/supabase-photo-deps.ts`
- Create: `src/app/api/guests/route.ts`
- Create: `src/app/api/guests/[id]/route.ts`
- Create: `src/app/api/photos/route.ts`

**Interfaces:**
- Consumes: `supabaseAdmin`, `addPhoto`/`PhotoDeps`/ошибки, валидаторы из Task 3.
- Produces:
  - `realPhotoDeps(): PhotoDeps` (sharp-превью, Storage-загрузка, RPC `claim_photo_slot` с маппингом ошибок)
  - `POST /api/guests` `{name}` → 200 `{guestId, name}` | 400 `{error:'bad_name'}`
  - `GET /api/guests/[id]` → 200 `{name, used, limit}` | 400 | 404
  - `POST /api/photos` (multipart `file`, `guestId`) → 201 `{photoId, used, remaining}` | 400 | 404 `{error:'guest_not_found'}` | 409 `{error:'limit_reached'}`
  - `GET /api/photos` → 200 `{photos: [{id, name, createdAt, thumbUrl, fullUrl}]}` (новые сверху, подписанные URL на 1 час)

- [ ] **Step 1: Адаптер**

Create `src/lib/supabase-photo-deps.ts`:

```ts
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-server'
import { GuestNotFoundError, LimitReachedError, PhotoDeps } from '@/lib/photo-service'

export function realPhotoDeps(): PhotoDeps {
  const sb = supabaseAdmin()
  return {
    newId: () => randomUUID(),

    async makeThumb(original) {
      return sharp(original).rotate().resize({ width: 400 }).jpeg({ quality: 75 }).toBuffer()
    },

    async uploadFile(path, data, contentType) {
      const { error } = await sb.storage.from('photos').upload(path, data, { contentType })
      if (error) throw new Error(`storage upload failed: ${error.message}`)
    },

    async removeFiles(paths) {
      await sb.storage.from('photos').remove(paths)
    },

    async claimSlot(guestId, storagePath, thumbPath) {
      const { data, error } = await sb.rpc('claim_photo_slot', {
        p_guest_id: guestId,
        p_storage_path: storagePath,
        p_thumb_path: thumbPath,
      })
      if (error) {
        if (error.message.includes('limit_reached')) throw new LimitReachedError(error.message)
        if (error.message.includes('guest_not_found')) throw new GuestNotFoundError(error.message)
        throw new Error(`claim_photo_slot failed: ${error.message}`)
      }
      const row = Array.isArray(data) ? data[0] : data
      return { photoId: row.photo_id as string, used: row.photos_used as number }
    },
  }
}
```

- [ ] **Step 2: Роут гостей**

Create `src/app/api/guests/route.ts`:

```ts
import { supabaseAdmin } from '@/lib/supabase-server'
import { validateGuestName } from '@/lib/validation'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const name = validateGuestName(body?.name)
  if (!name) return Response.json({ error: 'bad_name' }, { status: 400 })

  const { data, error } = await supabaseAdmin()
    .from('guests').insert({ name }).select('id').single()
  if (error) return Response.json({ error: 'db_error' }, { status: 500 })

  return Response.json({ guestId: data.id, name })
}
```

Create `src/app/api/guests/[id]/route.ts`:

```ts
import { supabaseAdmin } from '@/lib/supabase-server'
import { isValidGuestId, PHOTO_LIMIT } from '@/lib/validation'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isValidGuestId(id)) return Response.json({ error: 'bad_id' }, { status: 400 })

  const sb = supabaseAdmin()
  const { data: guest } = await sb.from('guests').select('name').eq('id', id).maybeSingle()
  if (!guest) return Response.json({ error: 'guest_not_found' }, { status: 404 })

  const { count } = await sb.from('photos')
    .select('id', { count: 'exact', head: true }).eq('guest_id', id)

  return Response.json({ name: guest.name, used: count ?? 0, limit: PHOTO_LIMIT })
}
```

- [ ] **Step 3: Роут фото**

Create `src/app/api/photos/route.ts`:

```ts
import { addPhoto, GuestNotFoundError, LimitReachedError } from '@/lib/photo-service'
import { realPhotoDeps } from '@/lib/supabase-photo-deps'
import { supabaseAdmin } from '@/lib/supabase-server'
import { isValidGuestId, validateUpload } from '@/lib/validation'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const guestId = form?.get('guestId')

  if (!isValidGuestId(guestId)) return Response.json({ error: 'bad_guest_id' }, { status: 400 })
  const uploadErr = validateUpload(file instanceof File ? file : null)
  if (uploadErr) return Response.json({ error: uploadErr }, { status: 400 })

  const original = Buffer.from(await (file as File).arrayBuffer())
  try {
    const result = await addPhoto(realPhotoDeps(), guestId, original)
    return Response.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof LimitReachedError) return Response.json({ error: 'limit_reached' }, { status: 409 })
    if (err instanceof GuestNotFoundError) return Response.json({ error: 'guest_not_found' }, { status: 404 })
    console.error('photo upload failed', err)
    return Response.json({ error: 'upload_failed' }, { status: 500 })
  }
}

type PhotoRow = {
  id: string
  storage_path: string
  thumb_path: string
  created_at: string
  guests: { name: string } | null
}

export async function GET() {
  const sb = supabaseAdmin()
  const { data, error } = await sb.from('photos')
    .select('id, storage_path, thumb_path, created_at, guests(name)')
    .order('created_at', { ascending: false })
  if (error) return Response.json({ error: 'db_error' }, { status: 500 })

  const rows = (data ?? []) as unknown as PhotoRow[]
  if (rows.length === 0) return Response.json({ photos: [] })

  const paths = rows.flatMap((p) => [p.thumb_path, p.storage_path])
  const { data: signed, error: signErr } = await sb.storage.from('photos').createSignedUrls(paths, 3600)
  if (signErr) return Response.json({ error: 'sign_error' }, { status: 500 })

  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
  return Response.json({
    photos: rows.map((p) => ({
      id: p.id,
      name: p.guests?.name ?? '',
      createdAt: p.created_at,
      thumbUrl: urlByPath.get(p.thumb_path) ?? null,
      fullUrl: urlByPath.get(p.storage_path) ?? null,
    })),
  })
}
```

- [ ] **Step 4: Ручная проверка через curl**

Run: `npm run dev`, затем в другом терминале (нужен любой jpeg, например `test.jpg`):

```bash
curl -s -X POST localhost:3000/api/guests -H 'Content-Type: application/json' -d '{"name":"Тест"}'
# → {"guestId":"<uuid>","name":"Тест"}

curl -s -X POST localhost:3000/api/photos -F file=@test.jpg -F guestId=<uuid>
# → {"photoId":"...","used":1,"remaining":9}   (status 201)

curl -s localhost:3000/api/guests/<uuid>
# → {"name":"Тест","used":1,"limit":10}

curl -s localhost:3000/api/photos | head -c 300
# → {"photos":[{"id":...,"thumbUrl":"https://...","fullUrl":"https://..."}]}

for i in $(seq 2 11); do curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:3000/api/photos -F file=@test.jpg -F guestId=<uuid>; done
# → девять раз 201, затем 409
```

Expected: коды и тела как в комментариях. Тестовые данные удалим позже через админку.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase-photo-deps.ts src/app/api
git commit -m "feat: guests and photos API routes"
```

---

### Task 7: Админ-API — проверка, удаление, ZIP

**Files:**
- Create: `src/app/api/admin/check/route.ts`
- Create: `src/app/api/photos/[id]/route.ts`
- Create: `src/app/api/download/route.ts`

**Interfaces:**
- Consumes: `isAdminRequest`, `supabaseAdmin`, `isValidGuestId` (для uuid фото используем тот же валидатор — формат одинаковый).
- Produces:
  - `GET /api/admin/check` → 204 | 401 (проверка пароля с фронта)
  - `DELETE /api/photos/[id]` (header `x-admin-password`) → 204 | 401 | 404
  - `GET /api/download` (header `x-admin-password`) → 200 `application/zip` поток | 401. Имена в архиве: `<имя гостя>_<первые 8 символов id>.jpg`.

- [ ] **Step 1: Роут проверки пароля**

Create `src/app/api/admin/check/route.ts`:

```ts
import { isAdminRequest } from '@/lib/admin-auth'

export async function GET(req: Request) {
  if (!isAdminRequest(req)) return new Response(null, { status: 401 })
  return new Response(null, { status: 204 })
}
```

- [ ] **Step 2: Удаление фото**

Create `src/app/api/photos/[id]/route.ts`:

```ts
import { isAdminRequest } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-server'
import { isValidGuestId } from '@/lib/validation'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) return new Response(null, { status: 401 })
  const { id } = await params
  if (!isValidGuestId(id)) return new Response(null, { status: 400 })

  const sb = supabaseAdmin()
  const { data: photo } = await sb.from('photos')
    .select('storage_path, thumb_path').eq('id', id).maybeSingle()
  if (!photo) return new Response(null, { status: 404 })

  await sb.storage.from('photos').remove([photo.storage_path, photo.thumb_path])
  const { error } = await sb.from('photos').delete().eq('id', id)
  if (error) return new Response(null, { status: 500 })

  return new Response(null, { status: 204 })
}
```

- [ ] **Step 3: ZIP-выгрузка**

Create `src/app/api/download/route.ts`:

```ts
import archiver from 'archiver'
import { PassThrough, Readable } from 'node:stream'
import { isAdminRequest } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const maxDuration = 300

type Row = { id: string; storage_path: string; guests: { name: string } | null }

export async function GET(req: Request) {
  if (!isAdminRequest(req)) return new Response(null, { status: 401 })

  const sb = supabaseAdmin()
  const { data } = await sb.from('photos')
    .select('id, storage_path, guests(name)')
    .order('created_at', { ascending: true })
  const rows = (data ?? []) as unknown as Row[]

  const archive = archiver('zip', { zlib: { level: 0 } })
  const out = new PassThrough()
  archive.pipe(out)

  ;(async () => {
    try {
      for (const row of rows) {
        const { data: blob } = await sb.storage.from('photos').download(row.storage_path)
        if (!blob) continue
        const safeName = (row.guests?.name ?? 'guest').replace(/[^\p{L}\p{N} _-]/gu, '')
        archive.append(Buffer.from(await blob.arrayBuffer()), {
          name: `${safeName}_${row.id.slice(0, 8)}.jpg`,
        })
      }
      await archive.finalize()
    } catch (err) {
      console.error('zip failed', err)
      archive.abort()
    }
  })()

  return new Response(Readable.toWeb(out) as ReadableStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="wedding-photos.zip"',
    },
  })
}
```

- [ ] **Step 4: Ручная проверка**

```bash
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/api/admin/check                       # → 401
curl -s -o /dev/null -w "%{http_code}\n" -H "x-admin-password: $ADMIN_PASSWORD" localhost:3000/api/admin/check  # → 204
curl -s -H "x-admin-password: $ADMIN_PASSWORD" localhost:3000/api/download -o wedding.zip && unzip -l wedding.zip
# → список jpg-файлов вида Тест_xxxxxxxx.jpg
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE -H "x-admin-password: $ADMIN_PASSWORD" localhost:3000/api/photos/<photo-id>  # → 204
```

Expected: коды как в комментариях; после DELETE фото исчезает из `GET /api/photos`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin 'src/app/api/photos/[id]' src/app/api/download
git commit -m "feat: admin API - check, delete, zip download"
```

---

### Task 8: Клиентские библиотеки — сжатие, загрузка с ретраями, гость (TDD для ретраев)

**Files:**
- Create: `src/lib/client/compress.ts`
- Create: `src/lib/client/upload.ts`
- Create: `src/lib/client/guest.ts`
- Test: `tests/upload.test.ts`

**Interfaces:**
- Produces:
  - `compressImage(file: Blob, maxSide?: number, quality?: number): Promise<Blob>` — canvas-сжатие 2560px/0.9, EXIF-ориентация через `createImageBitmap(..., { imageOrientation: 'from-image' })` с фолбэком на `<img>`.
  - `uploadWithRetry(blob: Blob, guestId: string, opts?): Promise<UploadResult>` где `UploadResult = { ok: true; data: { photoId: string; used: number; remaining: number } } | { ok: false; fatal: boolean; status: number }`. 3 попытки, пауза 1с/2с; 400/404/409 — fatal без ретраев.
  - `loadGuest(): Guest | null`, `saveGuest(g: Guest): void`, `type Guest = { id: string; name: string }` (localStorage, ключ `wp_guest`).

- [ ] **Step 1: Падающие тесты на ретраи**

Create `tests/upload.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest'
import { uploadWithRetry } from '@/lib/client/upload'

const GUEST = '123e4567-e89b-42d3-a456-426614174000'
const okJson = { photoId: 'p1', used: 1, remaining: 9 }
const noWait = () => Promise.resolve()

function res(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status })
}

describe('uploadWithRetry', () => {
  test('succeeds first try', async () => {
    const doFetch = vi.fn().mockResolvedValue(res(201, okJson))
    const r = await uploadWithRetry(new Blob(['x']), GUEST, { doFetch, wait: noWait })
    expect(r).toEqual({ ok: true, data: okJson })
    expect(doFetch).toHaveBeenCalledTimes(1)
  })

  test('retries on 500 and network error, then succeeds', async () => {
    const doFetch = vi.fn()
      .mockResolvedValueOnce(res(500))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(res(201, okJson))
    const r = await uploadWithRetry(new Blob(['x']), GUEST, { doFetch, wait: noWait })
    expect(r.ok).toBe(true)
    expect(doFetch).toHaveBeenCalledTimes(3)
  })

  test('409 is fatal, no retry', async () => {
    const doFetch = vi.fn().mockResolvedValue(res(409, { error: 'limit_reached' }))
    const r = await uploadWithRetry(new Blob(['x']), GUEST, { doFetch, wait: noWait })
    expect(r).toEqual({ ok: false, fatal: true, status: 409 })
    expect(doFetch).toHaveBeenCalledTimes(1)
  })

  test('gives up after 3 failed attempts', async () => {
    const doFetch = vi.fn().mockResolvedValue(res(500))
    const r = await uploadWithRetry(new Blob(['x']), GUEST, { doFetch, wait: noWait })
    expect(r).toEqual({ ok: false, fatal: false, status: 500 })
    expect(doFetch).toHaveBeenCalledTimes(3)
  })
})
```

- [ ] **Step 2: Убедиться, что падают**

Run: `npm test` → Expected: FAIL.

- [ ] **Step 3: Реализация upload**

Create `src/lib/client/upload.ts`:

```ts
export type UploadResult =
  | { ok: true; data: { photoId: string; used: number; remaining: number } }
  | { ok: false; fatal: boolean; status: number }

type Opts = {
  attempts?: number
  doFetch?: typeof fetch
  wait?: (ms: number) => Promise<void>
}

const defaultWait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export async function uploadWithRetry(
  blob: Blob,
  guestId: string,
  { attempts = 3, doFetch = fetch, wait = defaultWait }: Opts = {}
): Promise<UploadResult> {
  let lastStatus = 0
  for (let i = 0; i < attempts; i++) {
    try {
      const form = new FormData()
      form.append('file', blob, 'photo.jpg')
      form.append('guestId', guestId)
      const res = await doFetch('/api/photos', { method: 'POST', body: form })
      if (res.status === 201) return { ok: true, data: await res.json() }
      if ([400, 404, 409].includes(res.status)) return { ok: false, fatal: true, status: res.status }
      lastStatus = res.status
    } catch {
      lastStatus = 0
    }
    if (i < attempts - 1) await wait(1000 * (i + 1))
  }
  return { ok: false, fatal: false, status: lastStatus }
}
```

- [ ] **Step 4: Тесты зелёные**

Run: `npm test` → Expected: PASS.

- [ ] **Step 5: Сжатие и гость (без юнит-тестов — DOM API, проверяется вручную в Task 11)**

Create `src/lib/client/compress.ts`:

```ts
export async function compressImage(file: Blob, maxSide = 2560, quality = 0.9): Promise<Blob> {
  const source = await loadBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(source.width * scale)
  canvas.height = Math.round(source.height * scale)
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height)
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality)
  )
}

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      await new Promise((res, rej) => {
        img.onload = res
        img.onerror = rej
        img.src = url
      })
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}
```

Create `src/lib/client/guest.ts`:

```ts
export type Guest = { id: string; name: string }

const KEY = 'wp_guest'

export function loadGuest(): Guest | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const g = JSON.parse(raw)
    return typeof g?.id === 'string' && typeof g?.name === 'string' ? g : null
  } catch {
    return null
  }
}

export function saveGuest(g: Guest): void {
  localStorage.setItem(KEY, JSON.stringify(g))
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/client tests/upload.test.ts
git commit -m "feat: client compress, retrying upload, guest storage"
```

---

### Task 9: Тема — шрифты, палитра, layout

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Create: `src/lib/event.ts`
- Delete: дефолтный контент `src/app/page.tsx` заменим в Task 10; удалить неиспользуемые ассеты create-next-app (`public/*.svg`).

**Interfaces:**
- Produces: CSS-токены `--color-paper/-ink/-wine/-line`, классы Tailwind `bg-paper text-ink text-wine border-line font-serif font-mono`; `EVENT = { couple: string; date: string }` из `@/lib/event`.

- [ ] **Step 1: Данные события**

Create `src/lib/event.ts`:

```ts
export const EVENT = {
  couple: 'Имя & Имя', // заменить на имена молодожёнов
  date: 'дата свадьбы', // например: '12 сентября 2026'
}
```

- [ ] **Step 2: Layout со шрифтами**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Inter, JetBrains_Mono, Playfair_Display } from 'next/font/google'
import './globals.css'

const playfair = Playfair_Display({ subsets: ['cyrillic', 'latin'], variable: '--font-playfair' })
const inter = Inter({ subsets: ['cyrillic', 'latin'], variable: '--font-inter' })
const jbMono = JetBrains_Mono({ subsets: ['cyrillic', 'latin'], variable: '--font-jbmono' })

export const metadata: Metadata = {
  title: 'Свадебная плёнка',
  description: '10 кадров на гостя — общий альбом свадьбы',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={`${playfair.variable} ${inter.variable} ${jbMono.variable} bg-paper text-ink font-sans antialiased min-h-dvh`}>
        <main className="mx-auto max-w-md min-h-dvh px-5 py-6">{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Токены темы**

Replace `src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-paper: #FAF7F2;
  --color-ink: #1C1A17;
  --color-wine: #6E1423;
  --color-line: #E5DFD5;
  --font-serif: var(--font-playfair), serif;
  --font-sans: var(--font-inter), sans-serif;
  --font-mono: var(--font-jbmono), monospace;
}

/* едва заметное зерно на фоне */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0.04;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E");
}
```

- [ ] **Step 4: Проверка**

Run: `npm run dev` → открыть `localhost:3000`. Expected: кремовый фон с лёгким зерном (дефолтная страница Next пока на месте — заменим в Task 10). `npm run build` проходит.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: theme - fonts, palette, grain, layout shell"
```

---

### Task 10: Экран приветствия

**Files:**
- Replace: `src/app/page.tsx`
- Create: `src/components/NameForm.tsx`
- Create: `src/components/CameraScreen.tsx` (заглушка, полная версия в Task 11)

**Interfaces:**
- Consumes: `loadGuest/saveGuest/Guest`, `EVENT`, `POST /api/guests`.
- Produces: `NameForm({ onDone: (g: Guest) => void })`; `page.tsx` показывает `NameForm` без гостя в localStorage, иначе `CameraScreen({ guest })`.

- [ ] **Step 1: Страница-переключатель**

Replace `src/app/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Guest, loadGuest, saveGuest } from '@/lib/client/guest'
import NameForm from '@/components/NameForm'
import CameraScreen from '@/components/CameraScreen'

export default function Home() {
  const [guest, setGuest] = useState<Guest | null | undefined>(undefined)
  useEffect(() => setGuest(loadGuest()), [])

  if (guest === undefined) return null
  if (!guest) return <NameForm onDone={(g) => { saveGuest(g); setGuest(g) }} />
  return <CameraScreen guest={guest} />
}
```

- [ ] **Step 2: Форма имени**

Create `src/components/NameForm.tsx`:

```tsx
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
```

- [ ] **Step 3: Заглушка камеры (чтобы собиралось)**

Create `src/components/CameraScreen.tsx`:

```tsx
'use client'

import { Guest } from '@/lib/client/guest'

export default function CameraScreen({ guest }: { guest: Guest }) {
  return <p>Привет, {guest.name}! Камера появится в следующей задаче.</p>
}
```

- [ ] **Step 4: Проверка**

Run: `npm run dev` → открыть в браузере. Expected: экран приветствия; после ввода имени показывается заглушка; после перезагрузки страницы форма не появляется (имя в localStorage). `npm run build` проходит.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/components
git commit -m "feat: welcome screen with name form"
```

---

### Task 11: Экран камеры

**Files:**
- Replace: `src/components/CameraScreen.tsx`

**Interfaces:**
- Consumes: `compressImage`, `uploadWithRetry`, `GET /api/guests/[id]`, `PHOTO_LIMIT`.
- Produces: полный экран съёмки: счётчик кадров, спуск через `<input type="file" accept="image/*" capture="environment">`, превью «Оставить/Переснять», состояния «отправляется…», ошибки, «плёнка отснята», ссылка в галерею при `used >= 1`.

- [ ] **Step 1: Реализация**

Replace `src/components/CameraScreen.tsx`:

```tsx
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
```

- [ ] **Step 2: Проверка на десктопе**

Run: `npm run dev`. В браузере: выбрать файл (на десктопе `capture` открывает выбор файла) → превью → «Оставить» → счётчик уменьшается; «Переснять» — счётчик не меняется. С DevTools → Network → Offline: «Оставить» даёт ошибку, кадр не списан.

- [ ] **Step 3: Проверка на телефоне**

Открыть dev-сервер с телефона в той же сети (`npm run dev -- -H 0.0.0.0`, адрес `http://<ip-мака>:3000`). iOS Safari и Android Chrome: кнопка спуска открывает камеру, снимок → превью → загрузка; вертикальные и горизонтальные фото не лежат на боку.

- [ ] **Step 4: Commit**

```bash
git add src/components/CameraScreen.tsx
git commit -m "feat: camera screen with film counter and retrying upload"
```

---

### Task 12: Галерея

**Files:**
- Create: `src/app/gallery/page.tsx`
- Create: `src/components/GalleryGrid.tsx`
- Create: `src/components/Lightbox.tsx`

**Interfaces:**
- Consumes: `GET /api/photos`, `loadGuest`.
- Produces: `type GalleryPhoto = { id: string; name: string; createdAt: string; thumbUrl: string | null; fullUrl: string | null }` (экспорт из `GalleryGrid.tsx`); страница с опросом раз в 8 с + при возврате на вкладку; полароидные карточки; лайтбокс с листанием. Гость без единого фото видит «Сначала сделай первый кадр».

- [ ] **Step 1: Страница галереи**

Create `src/app/gallery/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Сетка**

Create `src/components/GalleryGrid.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Lightbox from '@/components/Lightbox'

export type GalleryPhoto = {
  id: string
  name: string
  createdAt: string
  thumbUrl: string | null
  fullUrl: string | null
}

export default function GalleryGrid({ photos }: { photos: GalleryPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (photos.length === 0) {
    return <p className="py-16 text-center font-mono text-sm opacity-60">Пока ни одного кадра — будь первым!</p>
  }

  return (
    <>
      <div className="columns-2 gap-3 sm:columns-3">
        {photos.map((p, i) => (
          <figure key={p.id} className="mb-3 break-inside-avoid bg-white p-2 pb-1 shadow-sm" onClick={() => setOpenIndex(i)}>
            {p.thumbUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={p.thumbUrl} alt={`Фото от ${p.name}`} loading="lazy" className="w-full" />
            )}
            <figcaption className="flex justify-between py-1 font-mono text-[10px] opacity-60">
              <span>{p.name}</span>
              <span>{new Date(p.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      {openIndex !== null && (
        <Lightbox photos={photos} index={openIndex} onIndex={setOpenIndex} onClose={() => setOpenIndex(null)} />
      )}
    </>
  )
}
```

- [ ] **Step 3: Лайтбокс**

Create `src/components/Lightbox.tsx`:

```tsx
'use client'

import { GalleryPhoto } from '@/components/GalleryGrid'

type Props = {
  photos: GalleryPhoto[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}

export default function Lightbox({ photos, index, onIndex, onClose }: Props) {
  const photo = photos[index]
  if (!photo) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/95" onClick={onClose}>
      <div className="flex justify-end p-4">
        <button aria-label="Закрыть" className="font-mono text-2xl text-paper">✕</button>
      </div>
      <div className="flex flex-1 items-center justify-between gap-2 px-2 pb-8" onClick={(e) => e.stopPropagation()}>
        <button
          aria-label="Предыдущее"
          disabled={index === 0}
          onClick={() => onIndex(index - 1)}
          className="p-3 font-mono text-2xl text-paper disabled:opacity-20"
        >
          ‹
        </button>
        <figure className="max-h-full">
          {photo.fullUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={photo.fullUrl} alt={`Фото от ${photo.name}`} className="max-h-[75dvh] w-auto border-8 border-white" />
          )}
          <figcaption className="pt-2 text-center font-mono text-xs text-paper/70">{photo.name}</figcaption>
        </figure>
        <button
          aria-label="Следующее"
          disabled={index === photos.length - 1}
          onClick={() => onIndex(index + 1)}
          className="p-3 font-mono text-2xl text-paper disabled:opacity-20"
        >
          ›
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Проверка**

Run: `npm run dev`. Гость с фото видит сетку; вторая вкладка (или телефон) загружает фото — в первой оно появляется в течение 8 секунд без перезагрузки. Лайтбокс листается, закрывается по фону и ✕. Новый браузер-инкогнито без гостя видит «Альбом откроется после первого кадра».

- [ ] **Step 5: Commit**

```bash
git add src/app/gallery src/components/GalleryGrid.tsx src/components/Lightbox.tsx
git commit -m "feat: shared gallery with polling and lightbox"
```

---

### Task 13: Страница админа

**Files:**
- Create: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/check`, `GET /api/photos`, `DELETE /api/photos/[id]`, `GET /api/download`, `GalleryPhoto`.
- Produces: `/admin` — форма пароля (сохраняется в sessionStorage `wp_admin`), список фото с удалением (с confirm), кнопка «Скачать всё (ZIP)».

- [ ] **Step 1: Реализация**

Create `src/app/admin/page.tsx`:

```tsx
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
    fetch('/api/photos')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setPhotos(d.photos))
      .catch(() => {})
  }, [])

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
      <p className="font-mono text-xs opacity-60">Всего фото: {photos.length}</p>
      <div className="columns-2 gap-3 sm:columns-3">
        {photos.map((p) => (
          <figure key={p.id} className="mb-3 break-inside-avoid bg-white p-2 shadow-sm">
            {p.thumbUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={p.thumbUrl} alt={`Фото от ${p.name}`} loading="lazy" className="w-full" />
            )}
            <figcaption className="flex items-center justify-between py-1 font-mono text-[10px]">
              <span className="opacity-60">{p.name}</span>
              <button onClick={() => remove(p.id)} className="text-wine underline underline-offset-2">
                удалить
              </button>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Проверка**

Run: `npm run dev` → `/admin`. Неверный пароль — «Неверный пароль»; верный — сетка. Удаление убирает фото (проверить, что оно исчезло и из `/gallery`). «Скачать всё» отдаёт zip, внутри jpg с именами гостей. После этого удалить все тестовые фото через админку.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin
git commit -m "feat: admin page - delete photos, zip download"
```

---

### Task 14: QR-скрипт, README, деплой

**Files:**
- Create: `scripts/qr.mjs`
- Replace: `README.md`

**Interfaces:**
- Consumes: пакет `qrcode` (dev-зависимость из Task 1).
- Produces: `node scripts/qr.mjs <url>` → `qr.png` (1200px, бордовый на кремовом); README с инструкцией деплоя и предсвадебным чек-листом.

- [ ] **Step 1: QR-скрипт**

Create `scripts/qr.mjs`:

```js
import QRCode from 'qrcode'

const url = process.argv[2]
if (!url) {
  console.error('Usage: node scripts/qr.mjs <site-url>')
  process.exit(1)
}

await QRCode.toFile('qr.png', url, {
  width: 1200,
  margin: 2,
  errorCorrectionLevel: 'H',
  color: { dark: '#6E1423', light: '#FAF7F2' },
})
console.log(`qr.png → ${url}`)
```

Run: `node scripts/qr.mjs https://example.com` → Expected: появляется `qr.png`, сканируется телефоном. Удалить тестовый файл: `rm qr.png` (добавить `qr.png` в `.gitignore`).

- [ ] **Step 2: README**

Replace `README.md`:

```markdown
# Свадебная плёнка 🎞

Гости сканируют QR на столе → получают «плёнку» на 10 кадров → снимают камерой телефона → все фото падают в общий альбом. Спека: `docs/superpowers/specs/2026-07-08-wedding-photo-design.md`.

## Запуск локально

1. `npm i`
2. Скопировать `.env.example` → `.env.local`, заполнить из Supabase (Project Settings → API) и придумать `ADMIN_PASSWORD`.
3. Применить `supabase/schema.sql` в SQL Editor проекта Supabase.
4. `npm run dev`

## Тесты

`npm test`

## Деплой (Vercel)

1. Запушить репозиторий на GitHub.
2. Vercel → Add New Project → импортировать репозиторий (настройки по умолчанию).
3. Environment Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`.
4. Deploy → проверить прод с телефона: снять кадр, увидеть его в галерее, зайти в `/admin`.

## QR для столов

`node scripts/qr.mjs https://<прод-домен>` → печатать `qr.png` (один QR на все столы).

## Чек-лист за 1–2 дня до свадьбы

- [ ] Открыть дашборд Supabase (бесплатный проект «засыпает» через ~неделю простоя).
- [ ] Удалить тестовых гостей/фото через `/admin`.
- [ ] Загрузить 2–3 «затравочных» фото, чтобы альбом не был пустым.
- [ ] Проверить путь целиком по QR с двух телефонов (iOS + Android).
- [ ] Записать админ-пароль у обоих.

## После свадьбы

Скачать ZIP через `/admin` в первые дни. Сайт можно оставить открытым для гостей.
```

- [ ] **Step 3: Деплой (ручной шаг)**

Создать GitHub-репозиторий, запушить, импортировать в Vercel, задать env-переменные, задеплоить. Проверить прод: полный путь гостя с телефона + `/admin`.

- [ ] **Step 4: Commit**

```bash
git add scripts/qr.mjs README.md .gitignore
git commit -m "feat: QR generator script and deploy docs"
```

---

## Финальная проверка по спеке

- Генеральная репетиция за ~неделю: 3–5 друзей проходят путь по QR с личных телефонов (iOS Safari + Android Chrome, обе ориентации).
- Прогон «плохой сети»: DevTools throttling → ретраи и статус «отправляется…» работают, кадр при отказе не списывается.
- Проверить лимиты Supabase после репетиции: Storage < 1 ГБ, egress в норме.
