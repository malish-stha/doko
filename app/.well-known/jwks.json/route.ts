import { importSPKI, exportJWK } from 'jose'

/**
 * Public JSON Web Key Set that Convex fetches to verify tokens issued by
 * /api/convex-token. Must be reachable from the public internet.
 *
 * Env:
 *   CONVEX_JWT_PUBLIC_KEY  SPKI PEM (openssl rsa -in private.pem -pubout)
 *   CONVEX_JWT_KID         key id, must match the token header (default "doko-1")
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  const pem = process.env.CONVEX_JWT_PUBLIC_KEY
  if (!pem) {
    return Response.json({ error: 'CONVEX_JWT_PUBLIC_KEY is not set' }, { status: 500 })
  }

  try {
    const key = await importSPKI(pem.replace(/\n/g, '\n'), 'RS256', { extractable: true })
    const jwk = await exportJWK(key)
    return Response.json(
      {
        keys: [
          {
            ...jwk,
            kid: process.env.CONVEX_JWT_KID ?? 'doko-1',
            use: 'sig',
            alg: 'RS256',
          },
        ],
      },
      { headers: { 'Cache-Control': 'public, max-age=3600' } },
    )
  } catch (error) {
    console.error('[jwks] failed to export public key:', error)
    return Response.json({ error: 'JWKS unavailable' }, { status: 500 })
  }
}
