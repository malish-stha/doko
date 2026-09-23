import * as jose from 'jose'

/**
 * Invite links carry an HS256 JWT so the accept page can prove the link was
 * issued by us before it looks anything up. Shared by invites.ts (sign /
 * verify) and email.ts (expiry copy).
 */

export const INVITE_EXPIRY_DAYS = 7
export const INVITE_EXPIRY_MS = INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
const ISSUER = 'doko-invite'

export type InviteTokenPayload = {
  teamId: string
  email: string
}

function getSecret() {
  const raw = process.env.INVITE_SIGNING_SECRET
  if (!raw || raw.length < 32) {
    throw new Error(
      'INVITE_SIGNING_SECRET is not set (need >= 32 chars). Run: npx convex env set INVITE_SIGNING_SECRET <random>',
    )
  }
  return new TextEncoder().encode(raw)
}

export async function signInviteToken(payload: InviteTokenPayload, expiresAtMs: number) {
  return await new jose.SignJWT({ teamId: payload.teamId, email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    // Unique per issuance so a resend always invalidates the previous link.
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAtMs / 1000))
    .sign(getSecret())
}

/** Returns the payload when the token is authentic and unexpired, else null. */
export async function verifyInviteToken(token: string): Promise<InviteTokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecret(), { issuer: ISSUER })
    if (typeof payload.teamId !== 'string' || typeof payload.email !== 'string') return null
    return { teamId: payload.teamId, email: payload.email }
  } catch {
    return null
  }
}
