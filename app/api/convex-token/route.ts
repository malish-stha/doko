import { auth } from '@/auth'
import { mintConvexToken } from '@/lib/convexToken'

/**
 * Issues a short-lived RS256 JWT for the browser Convex client. Signing
 * details live in lib/convexToken.ts (shared with server components).
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  const user = session?.user
  const email = user?.email?.trim().toLowerCase()
  if (!user || !email) {
    return Response.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  try {
    const token = await mintConvexToken({ email, name: user.name, image: user.image })
    return Response.json({ token }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[convex-token] failed to sign token:', error)
    return Response.json({ error: 'Token signing unavailable' }, { status: 500 })
  }
}
