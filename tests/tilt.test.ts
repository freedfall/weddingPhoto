import { describe, expect, it } from 'vitest'
import { photoTilt } from '@/lib/client/tilt'

describe('photoTilt', () => {
  it('детерминирован: одинаковый id даёт одинаковый результат', () => {
    expect(photoTilt('abc-123')).toEqual(photoTilt('abc-123'))
  })

  it('держит диапазоны: rotate в [-1.5, 1.5], shadowX в [-2, 2]', () => {
    for (const id of ['a', 'b', 'zz', 'photo-9f8e', '00000000-0000-0000-0000-000000000000']) {
      const { rotate, shadowX } = photoTilt(id)
      expect(rotate).toBeGreaterThanOrEqual(-1.5)
      expect(rotate).toBeLessThanOrEqual(1.5)
      expect(shadowX).toBeGreaterThanOrEqual(-2)
      expect(shadowX).toBeLessThanOrEqual(2)
    }
  })

  it('разные id дают разные повороты (хотя бы на этой паре)', () => {
    expect(photoTilt('first-id').rotate).not.toBe(photoTilt('second-id').rotate)
  })
})
