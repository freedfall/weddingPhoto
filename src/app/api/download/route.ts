import { ZipArchive } from 'archiver'
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

  const archive = new ZipArchive({ zlib: { level: 0 } })
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
