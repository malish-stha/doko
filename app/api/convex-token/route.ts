import { auth } from '@/auth'
import { encode } from 'next-auth/jwt'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ token: null })
  const token = await encode({
    token: session as any,
    secret: process.env.AUTH_SECRET!,
    salt: 'authjs.session-token',
  })
  return Response.json({ token })
}
