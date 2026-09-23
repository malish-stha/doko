/**
 * Convex verifies RS256 tokens minted by the Next.js app at /api/convex-token
 * against the JWKS served at `${CONVEX_AUTH_ISSUER}/.well-known/jwks.json`.
 *
 * Set on the Convex deployment (not in .env.local):
 *   npx convex env set CONVEX_AUTH_ISSUER https://your-app.example.com
 *
 * The value must equal the Next.js `AUTH_URL` exactly (no trailing slash).
 * Convex fetches the JWKS over the public internet, so local development
 * needs a tunnel (cloudflared / ngrok) as both AUTH_URL and CONVEX_AUTH_ISSUER.
 *
 * There is intentionally no localhost fallback: a missing issuer fails the
 * deployment instead of silently running every function unauthenticated.
 */
const issuer = process.env.CONVEX_AUTH_ISSUER?.replace(/\/+$/, '')

if (!issuer) {
  throw new Error(
    'CONVEX_AUTH_ISSUER is not set on this Convex deployment. ' +
      'Run: npx convex env set CONVEX_AUTH_ISSUER <site origin>',
  )
}

const authConfig = {
  providers: [
    {
      type: 'customJwt',
      applicationID: 'doko',
      issuer,
      jwks: `${issuer}/.well-known/jwks.json`,
      algorithm: 'RS256',
    },
  ],
}

export default authConfig
