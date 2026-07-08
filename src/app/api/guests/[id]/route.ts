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
