type EventLike = {
  kind: string
  userName?: string
  payload?: Record<string, unknown> | null
}

const FIELD_LABELS: Record<string, string> = {
  title: 'title',
  description: 'description',
  priority: 'priority',
  assigneeId: 'assignee',
  labels: 'labels',
  attachments: 'attachments',
  dueDate: 'due date',
  sprintId: 'sprint',
  epicId: 'parent epic',
  storyPoints: 'story points',
}

const human = (s: unknown) => String(s ?? '').replace(/_/g, ' ')

function describeChange(field: string, value: unknown): string {
  const label = FIELD_LABELS[field] ?? human(field)
  // The server records cleared fields as explicit null.
  if (value === null) return `cleared the ${label}`
  switch (field) {
    case 'title':
      return `renamed it to "${value}"`
    case 'description':
      return 'updated the description'
    case 'priority':
      return `set priority to ${human(value)}`
    case 'assigneeId':
      return 'changed the assignee'
    case 'storyPoints':
      return `set story points to ${value}`
    case 'dueDate':
      return typeof value === 'number' ? `set the due date to ${new Date(value).toLocaleDateString()}` : 'updated the due date'
    case 'sprintId':
      return 'moved it to another sprint'
    case 'epicId':
      return 'changed the parent epic'
    case 'labels':
      return Array.isArray(value) && value.length ? `set labels to ${value.join(', ')}` : 'cleared the labels'
    case 'attachments':
      return 'updated the attachments'
    default:
      return `updated the ${label}`
  }
}

function joinChanges(parts: string[]) {
  if (parts.length <= 1) return parts[0] ?? 'updated this ticket'
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** One sentence for a ticket-timeline event. */
export function renderEventSentence(event: EventLike): string {
  const rawActor = event.userName || 'Teammate'
  const actor = rawActor === 'anonymous' ? 'Teammate' : rawActor
  const payload = event.payload ?? {}
  const str = (k: string) => (typeof payload[k] === 'string' ? (payload[k] as string) : undefined)

  switch (event.kind) {
    case 'ticket.created':
      return `${actor} created this ticket`
    case 'ticket.deleted':
      return `${actor} deleted ticket ${str('key') ?? ''}`.trim()
    case 'ticket.status_changed':
      return `${actor} moved status from ${human(str('from') ?? 'unknown')} to ${human(str('to') ?? 'unknown')}`
    case 'ticket.assigned':
      return payload.assigneeId ? `${actor} assigned this ticket` : `${actor} unassigned this ticket`
    case 'ticket.priority_changed':
      return `${actor} changed priority to ${human(payload.priority)}`
    case 'ticket.moved_sprint':
      return payload.sprintId ? `${actor} moved this ticket into a sprint` : `${actor} moved this ticket to the backlog`
    case 'ticket.commented':
      return `${actor} added a comment`
    case 'ticket.comment_deleted':
      return `${actor} deleted a comment`
    case 'subtask.added':
      return `${actor} added sub-task "${str('title')}"`
    case 'subtask.checked':
      return `${actor} completed sub-task "${str('title')}"`
    case 'subtask.unchecked':
      return `${actor} marked sub-task "${str('title')}" as incomplete`
    case 'subtask.renamed':
      return `${actor} renamed sub-task "${str('from')}" to "${str('title')}"`
    case 'subtask.removed':
      return `${actor} deleted sub-task "${str('title')}"`
    case 'subtask.reordered':
      return `${actor} reordered the sub-tasks`
    case 'ticket.linked':
      return `${actor} linked ${human(str('type'))} ${str('targetKey') || str('sourceKey') || 'ticket'}`
    case 'ticket.unlinked':
      return `${actor} removed link (${human(str('type'))})`
    case 'ticket.watched':
      return `${actor} started watching this ticket`
    case 'ticket.unwatched':
      return `${actor} stopped watching this ticket`
    case 'ticket.attached':
      return `${actor} attached file "${str('filename')}"`
    case 'ticket.attachment_removed':
      return `${actor} removed attachment "${str('filename')}"`
    case 'ticket.updated': {
      // Every changed field is listed; `updatedAt` is bookkeeping, not a change.
      const changes = Object.entries(payload)
        .filter(([k]) => k !== 'updatedAt')
        .map(([k, val]) => describeChange(k, val))
      return `${actor} ${joinChanges(changes)}`
    }
    default:
      return `${actor} ${human(event.kind.split('.').pop() ?? 'updated')} this ticket`
  }
}
