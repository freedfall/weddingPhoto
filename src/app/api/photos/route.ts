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
