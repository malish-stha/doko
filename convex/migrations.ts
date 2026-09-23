import { v } from 'convex/values'
import { internalAction, internalMutation, internalQuery, MutationCtx } from './_generated/server'
import { internal } from './_generated/api'
import { Doc, Id, TableNames } from './_generated/dataModel'
import { normalizeEmail } from './teamHelper'

/**
 * One-off data migrations. Each step is a paginated internal mutation that
 * processes `BATCH` documents per call and returns the cursor to continue
 * from; `runAll` drives every step to completion. Every step is idempotent,
 * so re-running is safe.
 *
 *   npx convex run migrations:runAll
 *
 * Order matters for the schema: run this BEFORE deploying the commit that
 * makes tickets.teamId / channels.teamId / activityEvents.teamId required.
 */

const BATCH = 100

type Page = { nextCursor: string | null; done: boolean; touched: number }

const pageArgs = { cursor: v.union(v.string(), v.null()) }

async function paginate<T extends TableNames>(
  ctx: MutationCtx,
  table: T,
  cursor: string | null,
  each: (doc: Doc<T>) => Promise<boolean>,
): Promise<Page> {
  const result = await ctx.db.query(table).paginate({ cursor, numItems: BATCH })
  let touched = 0
  for (const doc of result.page) {
    if (await each(doc as Doc<T>)) touched++
  }
  return { nextCursor: result.isDone ? null : result.continueCursor, done: result.isDone, touched }
}

/* ------------------------------------------------------------------ */
/* Identity canonicalisation                                            */
/* ------------------------------------------------------------------ */

/**
 * Every legacy user id (Google `sub`, mixed-case email, display name...) maps
 * to the canonical lowercased email. Built from users and teamMembers rows.
 */
export const identityMap = internalQuery({
  args: {},
  handler: async ctx => {
    const map: Record<string, string> = {}
    for (const u of await ctx.db.query('users').collect()) {
      const email = normalizeEmail(u.email)
      if (u.userId !== email) map[u.userId] = email
      if (u.email !== email) map[u.email] = email
      if (u.name && !map[u.name] && u.name !== email) map[u.name] = email
    }
    for (const m of await ctx.db.query('teamMembers').collect()) {
      const email = normalizeEmail(m.email)
      if (m.userId !== email) map[m.userId] = email
      if (m.email !== email) map[m.email] = email
    }
    return map
  },
})

const canon = (map: Record<string, string>, value: string) => map[value] ?? value

/** users: key on lowercased email; merge duplicates onto the earliest row. */
export const canonicalizeUsers = internalMutation({
  args: {},
  handler: async ctx => {
    const users = await ctx.db.query('users').collect()
    const byEmail = new Map<string, Doc<'users'>[]>()
    for (const u of users) {
      const email = normalizeEmail(u.email)
      byEmail.set(email, [...(byEmail.get(email) ?? []), u])
    }
    let patched = 0
    let merged = 0
    for (const [email, rows] of byEmail) {
      rows.sort((a, b) => a.createdAt - b.createdAt)
      const [keep, ...dupes] = rows
      const mergedFields: Partial<Doc<'users'>> = {}
      for (const d of dupes) {
        for (const key of ['teamId', 'jobTitle', 'department', 'bio', 'phone', 'location', 'avatarUrl', 'githubUrl', 'linkedinUrl'] as const) {
          if (keep[key] === undefined && d[key] !== undefined && mergedFields[key] === undefined) {
            ;(mergedFields as Record<string, unknown>)[key] = d[key]
          }
        }
        await ctx.db.delete(d._id)
        merged++
      }
      if (keep.userId !== email || keep.email !== email || Object.keys(mergedFields).length) {
        await ctx.db.patch(keep._id, { ...mergedFields, userId: email, email })
        patched++
      }
    }
    return { patched, merged }
  },
})

/** teamMembers: canonical userId + email, one row per (team, email). */
export const canonicalizeMembers = internalMutation({
  args: {},
  handler: async ctx => {
    const rows = await ctx.db.query('teamMembers').collect()
    const seen = new Map<string, Doc<'teamMembers'>>()
    let patched = 0
    let removed = 0
    const rank = { owner: 3, admin: 2, member: 1 }
    for (const m of rows.sort((a, b) => a.joinedAt - b.joinedAt)) {
      const email = normalizeEmail(m.email)
      const key = `${m.teamId}:${email}`
      const existing = seen.get(key)
      if (existing) {
        // Keep the higher role, drop the duplicate.
        if (rank[m.role] > rank[existing.role]) await ctx.db.patch(existing._id, { role: m.role })
        await ctx.db.delete(m._id)
        removed++
        continue
      }
      seen.set(key, m)
      if (m.userId !== email || m.email !== email) {
        await ctx.db.patch(m._id, { userId: email, email })
        patched++
      }
    }
    return { patched, removed }
  },
})

/** Rewrites one string field on a table through the identity map. */
async function rewriteField<T extends TableNames>(
  ctx: MutationCtx,
  table: T,
  field: string,
  cursor: string | null,
  map: Record<string, string>,
) {
  return await paginate(ctx, table, cursor, async doc => {
    const value = (doc as unknown as Record<string, unknown>)[field]
    if (typeof value !== 'string') return false
    const next = canon(map, value)
    if (next === value) return false
    await ctx.db.patch(doc._id, { [field]: next } as never)
    return true
  })
}

const REWRITES: Array<[TableNames, string]> = [
  ['tickets', 'assigneeId'],
  ['tickets', 'reporterId'],
  ['comments', 'authorId'],
  ['messages', 'authorId'],
  ['reactions', 'userId'],
  ['watchers', 'userId'],
  ['savedFilters', 'userId'],
  ['mentions', 'mentionedUserId'],
  ['mentions', 'mentionedByUserId'],
  ['attachments', 'uploadedBy'],
  ['ticketLinks', 'createdBy'],
  ['briefs', 'userId'],
  ['aiRateLimits', 'userId'],
  ['teams', 'ownerId'],
  ['activityEvents', 'userId'],
  ['invites', 'invitedBy'],
  ['boardConfig', 'updatedBy'],
]

export const canonicalizeField = internalMutation({
  args: { table: v.string(), field: v.string(), ...pageArgs, map: v.record(v.string(), v.string()) },
  handler: async (ctx, args) => {
    return await rewriteField(ctx, args.table as TableNames, args.field, args.cursor, args.map)
  },
})

/** channels.memberIds are arrays: rewrite and dedupe each. */
export const canonicalizeChannelMembers = internalMutation({
  args: { ...pageArgs, map: v.record(v.string(), v.string()) },
  handler: async (ctx, args) => {
    return await paginate(ctx, 'channels', args.cursor, async c => {
      const next = Array.from(new Set(c.memberIds.map(id => canon(args.map, id))))
      if (next.length === c.memberIds.length && next.every((id, i) => id === c.memberIds[i])) return false
      await ctx.db.patch(c._id, { memberIds: next })
      return true
    })
  },
})

/* ------------------------------------------------------------------ */
/* Backfills                                                            */
/* ------------------------------------------------------------------ */

/** tickets.teamId from the reporter's (earliest) membership. */
export const backfillTicketTeams = internalMutation({
  args: pageArgs,
  handler: async (ctx, args) => {
    return await paginate(ctx, 'tickets', args.cursor, async t => {
      if (t.teamId) return false
      const membership = await ctx.db
        .query('teamMembers')
        .withIndex('by_user', q => q.eq('userId', t.reporterId))
        .collect()
      const first = membership.sort((a, b) => a.joinedAt - b.joinedAt)[0]
      if (!first) return false
      await ctx.db.patch(t._id, { teamId: first.teamId })
      return true
    })
  },
})

/** channels.dmKey for DMs created before the key existed; kind for legacy rows. */
export const backfillChannels = internalMutation({
  args: pageArgs,
  handler: async (ctx, args) => {
    return await paginate(ctx, 'channels', args.cursor, async c => {
      const patch: Partial<Doc<'channels'>> = {}
      if (!c.kind) patch.kind = c.isPrivate ? 'private' : 'public'
      if ((c.kind === 'dm' || patch.kind === 'dm') && !c.dmKey && c.memberIds.length === 2) {
        const sorted = [...c.memberIds].sort()
        patch.dmKey = `dm:${c.teamId}:${sorted[0]}:${sorted[1]}`
      }
      if (Object.keys(patch).length === 0) return false
      await ctx.db.patch(c._id, patch)
      return true
    })
  },
})

/** activityEvents.ticketId so the ticket timeline index covers old rows. */
export const backfillEventTickets = internalMutation({
  args: pageArgs,
  handler: async (ctx, args) => {
    return await paginate(ctx, 'activityEvents', args.cursor, async e => {
      if (e.ticketId) return false
      let ticketId: Id<'tickets'> | null = null
      if (e.refType === 'ticket') ticketId = ctx.db.normalizeId('tickets', e.refId)
      else if (typeof e.payload?.ticketId === 'string') ticketId = ctx.db.normalizeId('tickets', e.payload.ticketId)
      else if (e.refType === 'comment') {
        const id = ctx.db.normalizeId('comments', e.refId)
        const c = id ? await ctx.db.get(id) : null
        ticketId = c?.ticketId ?? null
      } else if (e.refType === 'subtask') {
        const id = ctx.db.normalizeId('subtasks', e.refId)
        const s = id ? await ctx.db.get(id) : null
        ticketId = s?.ticketId ?? null
      } else if (e.refType === 'ticketLink' && typeof e.payload?.sourceId === 'string') {
        ticketId = ctx.db.normalizeId('tickets', e.payload.sourceId)
      }
      if (!ticketId || !(await ctx.db.get(ticketId))) return false
      await ctx.db.patch(e._id, { ticketId })
      return true
    })
  },
})

/** Legacy tickets.attachments[] storage ids become attachments rows. */
export const migrateLegacyAttachments = internalMutation({
  args: pageArgs,
  handler: async (ctx, args) => {
    return await paginate(ctx, 'tickets', args.cursor, async t => {
      if (!t.attachments || t.attachments.length === 0) return false
      for (const raw of t.attachments) {
        const storageId = raw as Id<'_storage'>
        const meta = await ctx.db.system.get(storageId)
        if (!meta) continue
        const existing = await ctx.db
          .query('attachments')
          .withIndex('by_storage', q => q.eq('storageId', storageId))
          .first()
        if (existing) continue
        await ctx.db.insert('attachments', {
          ticketId: t._id,
          storageId,
          filename: 'attachment',
          mimeType: meta.contentType ?? 'application/octet-stream',
          size: meta.size,
          uploadedBy: t.reporterId,
          uploadedAt: t.createdAt,
        })
      }
      await ctx.db.patch(t._id, { attachments: [] })
      return true
    })
  },
})

/* ------------------------------------------------------------------ */
/* Orchestration                                                        */
/* ------------------------------------------------------------------ */

export const runAll = internalAction({
  args: {},
  handler: async ctx => {
    const summary: Record<string, number> = {}
    const drive = async (name: string, step: (cursor: string | null) => Promise<Page>) => {
      let cursor: string | null = null
      let touched = 0
      for (let i = 0; i < 10_000; i++) {
        const page: Page = await step(cursor)
        touched += page.touched
        if (page.done) break
        cursor = page.nextCursor
      }
      summary[name] = touched
    }

    // Build the legacy-id -> email map BEFORE rewriting users/members, which erases the legacy ids.
    const map = await ctx.runQuery(internal.migrations.identityMap, {})

    const users = await ctx.runMutation(internal.migrations.canonicalizeUsers, {})
    summary['users.patched'] = users.patched
    summary['users.merged'] = users.merged
    const members = await ctx.runMutation(internal.migrations.canonicalizeMembers, {})
    summary['teamMembers.patched'] = members.patched
    summary['teamMembers.removed'] = members.removed

    for (const [table, field] of REWRITES) {
      await drive(`${table}.${field}`, cursor =>
        ctx.runMutation(internal.migrations.canonicalizeField, { table, field, cursor, map }),
      )
    }
    await drive('channels.memberIds', cursor =>
      ctx.runMutation(internal.migrations.canonicalizeChannelMembers, { cursor, map }),
    )
    await drive('tickets.teamId', cursor => ctx.runMutation(internal.migrations.backfillTicketTeams, { cursor }))
    await drive('channels.kind/dmKey', cursor => ctx.runMutation(internal.migrations.backfillChannels, { cursor }))
    await drive('activityEvents.ticketId', cursor => ctx.runMutation(internal.migrations.backfillEventTickets, { cursor }))
    await drive('tickets.attachments', cursor => ctx.runMutation(internal.migrations.migrateLegacyAttachments, { cursor }))

    console.log('[migrations] done', JSON.stringify(summary))
    return summary
  },
})
