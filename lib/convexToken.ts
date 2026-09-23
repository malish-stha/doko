import { SignJWT, importPKCS8 } from 'jose'

/**
 * Mints the RS256 JWT Convex verifies against /.well-known/jwks.json.
 * Used by /api/convex-token (browser client) and by server components that
 * call Convex on the user's behalf (e.g. the invite accept page).
 *
 * Env:
 *   CONVEX_JWT_PRIVATE_KEY  PKCS8 PEM (openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt)
 *   CONVEX_JWT_KID          key id, must match the JWKS entry (default "doko-1")
 *   AUTH_URL                site origin; used as `iss` and must equal CONVEX_AUTH_ISSUER
 */

export const TOKEN_AUDIENCE = 'doko'
export const TOKEN_TTL = '1h'

let privateKey: Promise<CryptoKey> | null = null

function getPrivateKey() {
  if (!privateKey) {
    const pem = process.env.CONVEX_JWT_PRIVATE_KEY
    if (!pem) throw new Error('CONVEX_JWT_PRIVATE_KEY is not set')
    privateKey = importPKCS8(pem.replace(/\\n/g, '\n'), 'RS256')
  }
  return privateKey
}

export function getIssuer() {
  const raw = process.env.AUTH_URL
  if (!raw) throw new Error('AUTH_URL is not set')
  return raw.replace(/\/+$/, '')
}

export type TokenSubject = {
  email: string
  name?: string | null
  image?: string | null
}

export async function mintConvexToken(user: TokenSubject) {
  const email = user.email.trim().toLowerCase()
  return await new SignJWT({
    email,
    name: user.name ?? email,
    picture: user.image ?? undefined,
  })
    .setProtectedHeader({
      alg: 'RS256',
      typ: 'JWT',
      kid: process.env.CONVEX_JWT_KID ?? 'doko-1',
    })
    .setSubject(email)
    .setIssuer(getIssuer())
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(await getPrivateKey())
}
