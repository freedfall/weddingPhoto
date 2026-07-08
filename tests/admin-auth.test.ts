import { describe, expect, test } from 'vitest'
import { isAdminRequest } from '@/lib/admin-auth'

function reqWith(header?: string): Request {
  return new Request('http://x/', {
    headers: header === undefined ? {} : { 'x-admin-password': header },
  })
}

describe('isAdminRequest', () => {
  test('accepts correct password', () => {
    expect(isAdminRequest(reqWith('secret'), 'secret')).toBe(true)
  })
  test('rejects wrong, missing, different-length password', () => {
    expect(isAdminRequest(reqWith('nope'), 'secret')).toBe(false)
    expect(isAdminRequest(reqWith(''), 'secret')).toBe(false)
    expect(isAdminRequest(reqWith(undefined), 'secret')).toBe(false)
    expect(isAdminRequest(reqWith('secret-longer'), 'secret')).toBe(false)
  })
  test('rejects everything when password not configured', () => {
    expect(isAdminRequest(reqWith('anything'), undefined)).toBe(false)
    expect(isAdminRequest(reqWith(''), '')).toBe(false)
  })
})
