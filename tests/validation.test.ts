import { describe, expect, test } from 'vitest'
import {
  validateGuestName, isValidGuestId, validateUpload, MAX_UPLOAD_BYTES,
} from '@/lib/validation'

describe('validateGuestName', () => {
  test('trims and accepts a normal name', () => {
    expect(validateGuestName('  Анна ')).toBe('Анна')
  })
  test('rejects empty, too long, non-string', () => {
    expect(validateGuestName('   ')).toBeNull()
    expect(validateGuestName('x'.repeat(51))).toBeNull()
    expect(validateGuestName(42)).toBeNull()
    expect(validateGuestName(undefined)).toBeNull()
  })
})

describe('isValidGuestId', () => {
  test('accepts uuid, rejects junk', () => {
    expect(isValidGuestId('123e4567-e89b-42d3-a456-426614174000')).toBe(true)
    expect(isValidGuestId('not-a-uuid')).toBe(false)
    expect(isValidGuestId(null)).toBe(false)
  })
})

describe('validateUpload', () => {
  test('accepts jpeg under limit', () => {
    expect(validateUpload({ type: 'image/jpeg', size: 1024 })).toBeNull()
  })
  test('rejects missing file, wrong type, zero and oversize', () => {
    expect(validateUpload(null)).toBe('no_file')
    expect(validateUpload({ type: 'image/png', size: 1024 })).toBe('bad_type')
    expect(validateUpload({ type: 'image/jpeg', size: 0 })).toBe('bad_size')
    expect(validateUpload({ type: 'image/jpeg', size: MAX_UPLOAD_BYTES + 1 })).toBe('bad_size')
  })
})
