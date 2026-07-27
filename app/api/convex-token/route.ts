import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function GET(req: NextRequest) {
  try {
    const rawToken = await getToken({
      req,
      secret: process.env.AUTH_SECRET,
      raw: true,
    })
    return NextResponse.json({ token: rawToken ?? null })
  } catch (error) {
    return NextResponse.json({ token: null })
  }
}
