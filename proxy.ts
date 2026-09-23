import { auth } from '@/auth'
import { NextResponse } from 'next/server'

/**
 * Everything is authenticated except the explicit public allow-list below.
 * New routes are protected by default instead of leaking until someone
 * remembers to add them to a regex.
 */
const PUBLIC_PATHS = new Set(['/', '/sign-in', '/privacy', '/terms'])
const PUBLIC_PREFIXES = ['/api/auth', '/.well-known']

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true
  return PUBLIC_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export default auth(req => {
  const { pathname, search } = req.nextUrl
  if (isPublicPath(pathname) || req.auth) return

  const signIn = new URL('/sign-in', req.nextUrl)
  signIn.searchParams.set('redirect', `${pathname}${search}`)
  return NextResponse.redirect(signIn)
})

export const config = {
  // API routes handle their own auth (they return 401 rather than redirecting).
  matcher: ['/((?!api|_next/static|_next/image|.*\\.(?:png|svg|ico|jpg|jpeg|webp)$).*)'],
}
