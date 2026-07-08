const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024
export const PHOTO_LIMIT = 10

export function validateGuestName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.trim()
  if (name.length < 1 || name.length > 50) return null
  return name
}

export function isValidGuestId(id: unknown): id is string {
  return typeof id === 'string' && UUID_RE.test(id)
}

export function validateUpload(file: { type: string; size: number } | null): string | null {
  if (!file) return 'no_file'
  if (file.type !== 'image/jpeg') return 'bad_type'
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) return 'bad_size'
  return null
}
