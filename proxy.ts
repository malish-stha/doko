import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isPublic = req.nextUrl.pathname === '/sign-in'
  if (!isPublic && !req.auth) {
    return NextResponse.redirect(new URL('/sign-in', req.nextUrl))
  }
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png|favicon\\.ico).*)'],
}
