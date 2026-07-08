import { PHOTO_LIMIT } from '@/lib/validation'

export class LimitReachedError extends Error {}
export class GuestNotFoundError extends Error {}

export type Thumb = { data: Buffer; width: number; height: number }

export type PhotoDeps = {
  newId(): string
  makeThumb(original: Buffer): Promise<Thumb>
  uploadFile(path: string, data: Buffer, contentType: string): Promise<void>
  removeFiles(paths: string[]): Promise<void>
  claimSlot(
    guestId: string,
    storagePath: string,
    thumbPath: string,
    dims: { width: number; height: number }
  ): Promise<{ photoId: string; used: number }>
}

export async function addPhoto(
  deps: PhotoDeps,
  guestId: string,
  original: Buffer
): Promise<{ photoId: string; used: number; remaining: number }> {
  const id = deps.newId()
  const storagePath = `${guestId}/${id}.jpg`
  const thumbPath = `${guestId}/${id}_thumb.jpg`

  const thumb = await deps.makeThumb(original)
  await deps.uploadFile(storagePath, original, 'image/jpeg')
  await deps.uploadFile(thumbPath, thumb.data, 'image/jpeg')

  try {
    const { photoId, used } = await deps.claimSlot(guestId, storagePath, thumbPath, {
      width: thumb.width,
      height: thumb.height,
    })
    return { photoId, used, remaining: PHOTO_LIMIT - used }
  } catch (err) {
    await deps.removeFiles([storagePath, thumbPath]).catch(() => {})
    throw err
  }
}
