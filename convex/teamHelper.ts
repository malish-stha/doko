import { ConvexError } from 'convex/values'
import { QueryCtx, MutationCtx } from './_generated/server'
import { Doc, Id } from './_generated/dataModel'

/**
 * Identity and team resolution for every Convex function.
 *
 * Identity comes exclusively from `ctx.auth` (the RS256 token minted by
 * /api/convex-token). `userId` is the token subject, which the token route
 * sets to the lowercased email. Nothing here trusts client-supplied emails,
 * hands out fallback teams, or writes to the database.
 */

export type Ctx = QueryCtx | MutationCtx
export type Role = Doc<'teamMembers'>['role']

export type AuthErrorCode =
  | 'UNAUTHENTICATED'
  | 'NO_TEAM'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'NOT_A_MEMBER'

export function authError(code: AuthErrorCode, message: string) {
  return new ConvexError({ code, message })
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export type AuthContext = {
  userId: string
  email: string
  name?: string
  picture?: string
}

export type UserContext = AuthContext & {
  user: Doc<'users'> | null
}

export type TeamContext = UserContext & {
  teamId: Id<'teams'>
  membership: Doc<'teamMembers'>
  role: Role
}

/** Throws UNAUTHENTICATED unless the request carries a verified identity. */
export async function requireAuth(ctx: Ctx): Promise<AuthContext> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw authError('UNAUTHENTICATED', 'You must be signed in.')
  }
  return {
    userId: identity.subject,
    email: identity.email ? normalizeEmail(identity.email) : identity.subject,
    name: identity.name ?? undefined,
    picture: identity.pictureUrl ?? undefined,
  }
}

/** Loads the `users` row for the caller (by userId, then by email). */
export async function findUser(ctx: Ctx, userId: string, email: string) {
  const byId = await ctx.db
    .query('users')
    .withIndex('by_userId', q => q.eq('userId', userId))
    .first()
  if (byId) return byId
  return await ctx.db
    .query('users')
    .withIndex('by_email', q => q.eq('email', email))
    .first()
}

export async function requireUser(ctx: Ctx): Promise<UserContext> {
  const auth = await requireAuth(ctx)
  const user = await findUser(ctx, auth.userId, auth.email)
  return { ...auth, user }
}

/**
 * Membership row for (team, user). Matches on the canonical userId first and
 * falls back to the member's email for rows written before identities were
 * canonicalised. Read-only: legacy rows are fixed by the migration, never by
 * an auto-heal patch in the request path.
 */
export async function getMembership(
  ctx: Ctx,
  teamId: Id<'teams'>,
  userId: string,
  email?: string,
): Promise<Doc<'teamMembers'> | null> {
  const direct = await ctx.db
    .query('teamMembers')
    .withIndex('by_team_user', q => q.eq('teamId', teamId).eq('userId', userId))
    .first()
  if (direct) return direct
  if (!email) return null
  const clean = normalizeEmail(email)
  const members = await ctx.db
    .query('teamMembers')
    .withIndex('by_team', q => q.eq('teamId', teamId))
    .collect()
  return members.find(m => normalizeEmail(m.email) === clean) ?? null
}

/** Every membership row for the caller, canonical userId first then legacy email rows. */
export async function listMemberships(ctx: Ctx, userId: string, email: string) {
  const byUser = await ctx.db
    .query('teamMembers')
    .withIndex('by_user', q => q.eq('userId', userId))
    .collect()
  if (byUser.length > 0) return byUser
  // Legacy rows keyed by a different subject but carrying the same email.
  return await ctx.db
    .query('teamMembers')
    .withIndex('by_email', q => q.eq('email', email))
    .collect()
}

/**
 * Resolves the caller's active team: `users.teamId` when a membership row
 * backs it, otherwise the first membership. Returns null when the caller
 * belongs to no team. Never throws for a missing team and never writes.
 */
export async function optionalTeam(ctx: Ctx): Promise<TeamContext | null> {
  const base = await requireUser(ctx)

  if (base.user?.teamId) {
    const membership = await getMembership(ctx, base.user.teamId, base.userId, base.email)
    if (membership) {
      return { ...base, teamId: base.user.teamId, membership, role: membership.role }
    }
  }

  const memberships = await listMemberships(ctx, base.userId, base.email)
  const first = memberships.sort((a, b) => a.joinedAt - b.joinedAt)[0]
  if (!first) return null
  return { ...base, teamId: first.teamId, membership: first, role: first.role }
}

/** Like optionalTeam but throws NO_TEAM when the caller has no membership. */
export async function requireTeam(ctx: Ctx): Promise<TeamContext> {
  const team = await optionalTeam(ctx)
  if (!team) {
    throw authError('NO_TEAM', 'You are not a member of any team workspace.')
  }
  return team
}

export async function requireRole(ctx: Ctx, roles: readonly Role[]): Promise<TeamContext> {
  const team = await requireTeam(ctx)
  if (!roles.includes(team.role)) {
    throw authError('FORBIDDEN', `This action requires one of: ${roles.join(', ')}.`)
  }
  return team
}

export function isAdminRole(role: Role) {
  return role === 'owner' || role === 'admin'
}

/** Loads a ticket and asserts it belongs to `teamId`; NOT_FOUND otherwise. */
export async function assertTicketInTeam(
  ctx: Ctx,
  ticketId: Id<'tickets'>,
  teamId: Id<'teams'>,
): Promise<Doc<'tickets'>> {
  const ticket = await ctx.db.get(ticketId)
  if (!ticket || ticket.teamId !== teamId) {
    throw authError('NOT_FOUND', 'Ticket not found.')
  }
  return ticket
}
