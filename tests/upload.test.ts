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
