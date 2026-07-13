import { describe, expect, test } from 'vitest'
import {
  addPhoto, LimitReachedError, GuestNotFoundError, PhotoDeps,
} from '@/lib/photo-service'

function makeDeps(overrides: Partial<PhotoDeps> = {}) {
  const uploaded: string[] = []
  const removed: string[] = []
  const claims: unknown[] = []
  const deps: PhotoDeps = {
    newId: () => 'photo-1',
    makeThumb: async () => ({ data: Buffer.from('thumb'), width: 400, height: 300 }),
    uploadFile: async (path) => { uploaded.push(path) },
    removeFiles: async (paths) => { removed.push(...paths) },
    claimSlot: async (...args) => {
      claims.push(args)
      return { photoId: 'photo-1', used: 3 }
    },
    ...overrides,
  }
  return { deps, uploaded, removed, claims }
}

const GUEST = '123e4567-e89b-42d3-a456-426614174000'

describe('addPhoto', () => {
  test('uploads original and thumb, returns counters', async () => {
    const { deps, uploaded, claims } = makeDeps()
    const res = await addPhoto(deps, GUEST, Buffer.from('img'))
    expect(uploaded).toEqual([`${GUEST}/photo-1.jpg`, `${GUEST}/photo-1_thumb.jpg`])
    expect(res).toEqual({ photoId: 'photo-1', used: 3, remaining: 7 })
    expect(claims).toEqual([
      [GUEST, `${GUEST}/photo-1.jpg`, `${GUEST}/photo-1_thumb.jpg`, { width: 400, height: 300 }],
    ])
  })

  test('cleans up storage when limit reached', async () => {
    const { deps, removed } = makeDeps({
      claimSlot: async () => { throw new LimitReachedError('limit') },
    })
    await expect(addPhoto(deps, GUEST, Buffer.from('img'))).rejects.toBeInstanceOf(LimitReachedError)
    expect(removed).toEqual([`${GUEST}/photo-1.jpg`, `${GUEST}/photo-1_thumb.jpg`])
  })

  test('cleans up storage when guest not found', async () => {
    const { deps, removed } = makeDeps({
      claimSlot: async () => { throw new GuestNotFoundError('guest') },
    })
    await expect(addPhoto(deps, GUEST, Buffer.from('img'))).rejects.toBeInstanceOf(GuestNotFoundError)
    expect(removed.length).toBe(2)
  })

  test('cleans up storage when one of the uploads fails', async () => {
    const { deps, removed } = makeDeps({
      uploadFile: async (path) => {
        if (path.endsWith('_thumb.jpg')) throw new Error('storage down')
      },
    })
    await expect(addPhoto(deps, GUEST, Buffer.from('img'))).rejects.toThrow('storage down')
    expect(removed).toEqual([`${GUEST}/photo-1.jpg`, `${GUEST}/photo-1_thumb.jpg`])
  })

  test('propagates claim error even if cleanup fails', async () => {
    const { deps } = makeDeps({
      claimSlot: async () => { throw new LimitReachedError('limit') },
      removeFiles: async () => { throw new Error('storage down') },
    })
    await expect(addPhoto(deps, GUEST, Buffer.from('img'))).rejects.toBeInstanceOf(LimitReachedError)
  })
})
