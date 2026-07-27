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
})
