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
