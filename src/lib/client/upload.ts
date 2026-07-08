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
