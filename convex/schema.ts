import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  tickets: defineTable({
    projectId: v.string(),
    key: v.string(),
    type: v.union(
      v.literal('bug'),
      v.literal('feature'),
      v.literal('task'),
      v.literal('epic'),
    ),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal('backlog'),
      v.literal('todo'),
      v.literal('in_progress'),
      v.literal('review'),
      v.literal('done'),
    ),
    priority: v.union(
      v.literal('low'),
      v.literal('medium'),
      v.literal('high'),
      v.literal('urgent'),
    ),
    assigneeId: v.optional(v.string()),
    reporterId: v.string(),
    labels: v.array(v.string()),
    attachments: v.optional(v.array(v.string())),
    dueDate: v.optional(v.number()),
    sourceMessageId: v.optional(v.id('messages')),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_project_status', ['projectId', 'status'])
    .index('by_assignee', ['assigneeId'])
    .index('by_reporter', ['reporterId'])
    .index('by_key', ['key']),

  counters: defineTable({
    scope: v.string(),
    value: v.number(),
  }).index('by_scope', ['scope']),

  comments: defineTable({
    ticketId: v.id('tickets'),
    authorId: v.string(),
    body: v.string(),
    createdAt: v.number(),
  }).index('by_ticket', ['ticketId']),

  activityEvents: defineTable({
    teamId: v.string(),
    userId: v.string(),
    kind: v.string(),
    refType: v.string(),
    refId: v.string(),
    payload: v.any(),
    ts: v.number(),
  })
    .index('by_team_ts', ['teamId', 'ts'])
    .index('by_user_ts', ['userId', 'ts']),

  channels: defineTable({
    teamId: v.string(),
    name: v.string(),
    isPrivate: v.boolean(),
    memberIds: v.array(v.string()),
    createdAt: v.number(),
  }).index('by_team', ['teamId']),

  messages: defineTable({
    channelId: v.id('channels'),
    authorId: v.string(),
    body: v.string(),
    threadRootId: v.optional(v.id('messages')),
    createdAt: v.number(),
  })
    .index('by_channel_created', ['channelId', 'createdAt'])
    .index('by_thread', ['threadRootId']),

  reactions: defineTable({
    messageId: v.id('messages'),
    userId: v.string(),
    emoji: v.string(),
    createdAt: v.number(),
  }).index('by_message', ['messageId']),

  users: defineTable({
    userId: v.string(),
    email: v.string(),
    name: v.string(),
    timezone: v.string(),
    createdAt: v.number(),
  }).index('by_userId', ['userId']),

  briefs: defineTable({
    userId: v.string(),
    forDate: v.string(),
    body: v.string(),
    generatedAt: v.number(),
    sourceEventIds: v.array(v.id('activityEvents')),
    providerUsed: v.string(),
  }).index('by_user_date', ['userId', 'forDate']),
})
