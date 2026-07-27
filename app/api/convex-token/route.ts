import { auth } from '@/auth'
import { SignJWT } from 'jose'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return Response.json({ token: null })
    }

    const secret = new TextEncoder().encode(process.env.AUTH_SECRET!)

    const token = await new SignJWT({
      email: session.user.email,
      name: session.user.name ?? session.user.email,
      picture: session.user.image ?? undefined,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(session.user.email)
      .setIssuer(process.env.CONVEX_AUTH_DOMAIN || 'http://localhost:3000')
      .setAudience('doko')
      .setIssuedAt()
      .setExpirationTime('1d')
      .sign(secret)

    return Response.json({ token })
  } catch (error) {
    console.error('convex-token error:', error)
    return Response.json({ token: null })
  }
}
