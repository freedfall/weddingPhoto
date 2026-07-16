import { addPhoto, GuestNotFoundError, LimitReachedError } from '@/lib/photo-service'
import { isAdminRequest } from '@/lib/admin-auth'
import { SignedUrlCache } from '@/lib/signed-url-cache'
import { realPhotoDeps } from '@/lib/supabase-photo-deps'
import { supabaseAdmin } from '@/lib/supabase-server'
import { isValidGuestId, validateUpload } from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const urlCache = new SignedUrlCache()

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
  width: number | null
  height: number | null
  hidden_at: string | null
  guests: { name: string } | null
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const guestId = searchParams.get('guestId')
  const includeHidden = searchParams.get('includeHidden') === '1'
  if (guestId && !isValidGuestId(guestId)) return Response.json({ error: 'bad_guest_id' }, { status: 400 })
  if (includeHidden && !isAdminRequest(req)) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const sb = supabaseAdmin()
  let query = sb.from('photos')
    .select('id, storage_path, thumb_path, created_at, width, height, hidden_at, guests(name)')
    .order('created_at', { ascending: false })
  if (guestId) query = query.eq('guest_id', guestId)
  if (!includeHidden) query = query.is('hidden_at', null)
  const { data, error } = await query
  if (error) return Response.json({ error: 'db_error' }, { status: 500 })

  const rows = (data ?? []) as unknown as PhotoRow[]
  if (rows.length === 0) return photosResponse([])

  const paths = rows.flatMap((p) => [p.thumb_path, p.storage_path])
  let urlByPath: Map<string, string>
  try {
    urlByPath = await urlCache.getUrls(paths, async (toSign) => {
      const { data: signed, error: signErr } = await sb.storage.from('photos').createSignedUrls(toSign, 3600)
      if (signErr) throw new Error(signErr.message)
      const map = new Map<string, string>()
      for (const s of signed ?? []) {
        if (s.signedUrl) map.set(s.path ?? '', s.signedUrl)
      }
      return map
    })
  } catch {
    return Response.json({ error: 'sign_error' }, { status: 500 })
  }
  return photosResponse(rows.map((p) => ({
      id: p.id,
      name: p.guests?.name ?? '',
      createdAt: p.created_at,
      width: p.width,
      height: p.height,
      thumbUrl: urlByPath.get(p.thumb_path) ?? null,
      fullUrl: urlByPath.get(p.storage_path) ?? null,
      hiddenAt: p.hidden_at,
    })))
}

function photosResponse(photos: unknown[]) {
  return Response.json(
    { photos },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  )
}
