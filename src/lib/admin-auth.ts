import { timingSafeEqual } from 'node:crypto'

export function isAdminRequest(
  req: Request,
  password: string | undefined = process.env.ADMIN_PASSWORD
): boolean {
  if (!password) return false
  const given = Buffer.from(req.headers.get('x-admin-password') ?? '')
  const expected = Buffer.from(password)
  return given.length === expected.length && timingSafeEqual(given, expected)
}
