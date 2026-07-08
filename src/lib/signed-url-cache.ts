const TTL_MS = 3600_000
const REFRESH_WINDOW_MS = 10 * 60_000

export type SignedUrlEntry = { url: string; expiresAt: number }
export type SignFn = (paths: string[]) => Promise<Map<string, string>>

export class SignedUrlCache {
  private cache = new Map<string, SignedUrlEntry>()

  constructor(private now: () => number = Date.now) {}

  async getUrls(paths: string[], sign: SignFn): Promise<Map<string, string>> {
    const currentPaths = new Set(paths)
    for (const key of this.cache.keys()) {
      if (!currentPaths.has(key)) this.cache.delete(key)
    }

    const now = this.now()
    const stale = paths.filter((p) => {
      const entry = this.cache.get(p)
      return !entry || entry.expiresAt - now < REFRESH_WINDOW_MS
    })

    if (stale.length > 0) {
      const signed = await sign(stale)
      for (const path of stale) {
        const url = signed.get(path)
        if (url) this.cache.set(path, { url, expiresAt: now + TTL_MS })
      }
    }

    const result = new Map<string, string>()
    for (const path of paths) {
      const entry = this.cache.get(path)
      if (entry) result.set(path, entry.url)
    }
    return result
  }
}
