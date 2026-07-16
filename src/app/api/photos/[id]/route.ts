import { isAdminRequest } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-server'
import { isValidGuestId } from '@/lib/validation'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) return new Response(null, { status: 401 })
  const { id } = await params
  if (!isValidGuestId(id)) return new Response(null, { status: 400 })
  const body = await req.json().catch(() => null)
  if (typeof body?.hidden !== 'boolean') return new Response(null, { status: 400 })

  const sb = supabaseAdmin()
  const { data, error } = await sb.from('photos')
    .update({ hidden_at: body.hidden ? new Date().toISOString() : null })
    .eq('id', id)
    .select('hidden_at')
    .maybeSingle()
  if (error) return new Response(null, { status: 500 })
  if (!data) return new Response(null, { status: 404 })
  return Response.json({ hiddenAt: data.hidden_at })
}

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
