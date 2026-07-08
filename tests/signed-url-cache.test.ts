import { describe, expect, test, vi } from 'vitest'
import { SignedUrlCache } from '@/lib/signed-url-cache'

function makeSigner() {
  let counter = 0
  const calls: string[][] = []
  const sign = vi.fn(async (paths: string[]) => {
    calls.push(paths)
    const map = new Map<string, string>()
    for (const p of paths) map.set(p, `${p}?token=${++counter}`)
    return map
  })
  return { sign, calls }
}

describe('SignedUrlCache', () => {
  test('first call signs all paths', async () => {
    const { sign } = makeSigner()
    const cache = new SignedUrlCache(() => 0)
    const urls = await cache.getUrls(['a', 'b'], sign)
    expect(sign).toHaveBeenCalledTimes(1)
    expect(sign).toHaveBeenCalledWith(['a', 'b'])
    expect(urls.get('a')).toBe('a?token=1')
    expect(urls.get('b')).toBe('b?token=2')
  })

  test('second call within TTL signs nothing and returns identical URLs', async () => {
    const { sign } = makeSigner()
    let now = 0
    const cache = new SignedUrlCache(() => now)
    const first = await cache.getUrls(['a', 'b'], sign)

    now += 5 * 60_000 // 5 minutes later, well within TTL and refresh window
    const second = await cache.getUrls(['a', 'b'], sign)

    expect(sign).toHaveBeenCalledTimes(1)
    expect(second.get('a')).toBe(first.get('a'))
    expect(second.get('b')).toBe(first.get('b'))
  })

  test('entries near expiry (<10 min) are re-signed', async () => {
    const { sign, calls } = makeSigner()
    let now = 0
    const cache = new SignedUrlCache(() => now)
    await cache.getUrls(['a'], sign)

    // 55 minutes later -> 5 minutes left, inside the 10 min refresh window
    now += 55 * 60_000
    const refreshed = await cache.getUrls(['a'], sign)

    expect(sign).toHaveBeenCalledTimes(2)
    expect(calls[1]).toEqual(['a'])
    expect(refreshed.get('a')).toBe('a?token=2')
  })

  test('removed paths are pruned', async () => {
    const { sign } = makeSigner()
    let now = 0
    const cache = new SignedUrlCache(() => now)
    await cache.getUrls(['a', 'b'], sign)

    now += 5 * 60_000
    const urls = await cache.getUrls(['a'], sign)
    expect(urls.has('b')).toBe(false)
    expect(sign).toHaveBeenCalledTimes(1)

    // now re-request 'b' - it should be signed again since it was pruned
    const urlsAgain = await cache.getUrls(['a', 'b'], sign)
    expect(sign).toHaveBeenCalledTimes(2)
    expect(urlsAgain.get('b')).toBe('b?token=3')
  })
})
