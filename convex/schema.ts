import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  teams: defineTable({
    slug: v.string(),
    name: v.string(),
    ownerId: v.string(),
    workspaceDomain: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_owner', ['ownerId']),

  teamMembers: defineTable({
    teamId: v.id('teams'),
    userId: v.string(),
    email: v.string(),
    role: v.union(v.literal('owner'), v.literal('admin'), v.literal('member')),
    joinedAt: v.number(),
  })
    .index('by_team', ['teamId'])
    .index('by_user', ['userId']),

  invites: defineTable({
    teamId: v.id('teams'),
    teamName: v.string(),
    email: v.string(),
    token: v.string(),
    invitedBy: v.string(),
    invitedByEmail: v.string(),
    status: v.union(v.literal('pending'), v.literal('accepted'), v.literal('revoked')),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index('by_email_status', ['email', 'status'])
    .index('by_team', ['teamId']),

  sprints: defineTable({
    teamId: v.id('teams'),
    name: v.string(),
    goal: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    status: v.union(
      v.literal('planning'),
      v.literal('active'),
      v.literal('completed'),
    ),
    plannedPoints: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_team_status', ['teamId', 'status'])
    .index('by_team', ['teamId']),

  tickets: defineTable({
    teamId: v.optional(v.string()),
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

    sprintId: v.optional(v.id('sprints')),
    epicId: v.optional(v.id('tickets')),
    storyPoints: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_project_status', ['projectId', 'status'])
    .index('by_assignee', ['assigneeId'])
    .index('by_reporter', ['reporterId'])
    .index('by_key', ['key'])
    .index('by_sprint', ['sprintId'])
    .index('by_epic', ['epicId']),

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
    kind: v.optional(v.union(v.literal('public'), v.literal('private'), v.literal('dm'))),
    memberIds: v.array(v.string()),
    dmKey: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_team', ['teamId'])
    .index('by_team_kind', ['teamId', 'kind'])
    .index('by_dm_key', ['dmKey']),

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
    teamId: v.optional(v.id('teams')),
    jobTitle: v.optional(v.string()),
    department: v.optional(v.string()),
    bio: v.optional(v.string()),
    phone: v.optional(v.string()),
    location: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    githubUrl: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
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

  aiRateLimits: defineTable({
    userId: v.string(),
    actionType: v.string(),
    lastCalledAt: v.number(),
    callHistory: v.array(v.number()),
  }).index('by_user_action', ['userId', 'actionType']),

  subtasks: defineTable({
    ticketId: v.id('tickets'),
    title: v.string(),
    done: v.boolean(),
    order: v.number(),
    createdAt: v.number(),
  }).index('by_ticket', ['ticketId']),

  ticketLinks: defineTable({
    sourceId: v.id('tickets'),
    targetId: v.id('tickets'),
    type: v.union(
      v.literal('blocks'),
      v.literal('blocked_by'),
      v.literal('relates_to'),
      v.literal('duplicates'),
      v.literal('duplicated_by'),
    ),
    createdAt: v.number(),
    createdBy: v.string(),
  })
    .index('by_source', ['sourceId'])
    .index('by_target', ['targetId'])
    .index('by_source_target_type', ['sourceId', 'targetId', 'type']),

  mentions: defineTable({
    contextRefType: v.string(),
    contextRefId: v.string(),
    mentionedUserId: v.string(),
    mentionedByUserId: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index('by_user_read', ['mentionedUserId', 'read'])
    .index('by_user', ['mentionedUserId']),

  watchers: defineTable({
    ticketId: v.id('tickets'),
    userId: v.string(),
    subscribedAt: v.number(),
  })
    .index('by_ticket', ['ticketId'])
    .index('by_ticket_user', ['ticketId', 'userId'])
    .index('by_user', ['userId']),

  attachments: defineTable({
    ticketId: v.id('tickets'),
    storageId: v.id('_storage'),
    filename: v.string(),
    mimeType: v.string(),
    size: v.number(),
    uploadedBy: v.string(),
    uploadedAt: v.number(),
  }).index('by_ticket', ['ticketId']),

  boardConfig: defineTable({
    teamId: v.id('teams'),
    wipLimits: v.object({
      backlog: v.optional(v.number()),
      todo: v.optional(v.number()),
      in_progress: v.optional(v.number()),
      review: v.optional(v.number()),
      done: v.optional(v.number()),
    }),
    visibleColumns: v.array(v.string()),
    columnLabels: v.optional(v.any()),
    updatedAt: v.number(),
    updatedBy: v.string(),
  }).index('by_team', ['teamId']),

  savedFilters: defineTable({
    teamId: v.id('teams'),
    userId: v.string(),
    name: v.string(),
    scope: v.union(v.literal('board'), v.literal('list')),
    queryString: v.string(),
    isShared: v.boolean(),
    createdAt: v.number(),
  })
    .index('by_user_scope', ['userId', 'scope'])
    .index('by_team_scope_shared', ['teamId', 'scope', 'isShared']),
})

