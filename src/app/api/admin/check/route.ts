import { isAdminRequest } from '@/lib/admin-auth'

export async function GET(req: Request) {
  if (!isAdminRequest(req)) return new Response(null, { status: 401 })
  return new Response(null, { status: 204 })
}
