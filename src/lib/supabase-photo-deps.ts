import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-server'
import { GuestNotFoundError, LimitReachedError, PhotoDeps } from '@/lib/photo-service'

export function realPhotoDeps(): PhotoDeps {
  const sb = supabaseAdmin()
  return {
    newId: () => randomUUID(),

    async makeThumb(original) {
      return sharp(original).rotate().resize({ width: 400 }).jpeg({ quality: 75 }).toBuffer()
    },

    async uploadFile(path, data, contentType) {
      const { error } = await sb.storage.from('photos').upload(path, data, { contentType })
      if (error) throw new Error(`storage upload failed: ${error.message}`)
    },

    async removeFiles(paths) {
      await sb.storage.from('photos').remove(paths)
    },

    async claimSlot(guestId, storagePath, thumbPath) {
      const { data, error } = await sb.rpc('claim_photo_slot', {
        p_guest_id: guestId,
        p_storage_path: storagePath,
        p_thumb_path: thumbPath,
      })
      if (error) {
        if (error.message.includes('limit_reached')) throw new LimitReachedError(error.message)
        if (error.message.includes('guest_not_found')) throw new GuestNotFoundError(error.message)
        throw new Error(`claim_photo_slot failed: ${error.message}`)
      }
      const row = Array.isArray(data) ? data[0] : data
      return { photoId: row.photo_id as string, used: row.photos_used as number }
    },
  }
}
