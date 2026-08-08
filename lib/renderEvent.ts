export function renderEventSentence(event: {
  kind: string
  userName?: string
  payload?: any
}): string {
  const rawActor = event.userName || 'Teammate'
  const actor = rawActor === 'anonymous' ? 'Teammate' : rawActor
  const payload = event.payload || {}

  switch (event.kind) {
    case 'ticket.created':
      return `${actor} created this ticket`
    case 'ticket.status_changed':
      return `${actor} moved status from ${payload.from?.replace('_', ' ') || 'unknown'} to ${payload.to?.replace('_', ' ') || 'unknown'}`
    case 'ticket.assigned':
      return payload.assigneeId
        ? `${actor} assigned this ticket`
        : `${actor} unassigned this ticket`
    case 'ticket.priority_changed':
      return `${actor} changed priority to ${payload.priority}`
    case 'ticket.commented':
      return `${actor} added a comment`
    case 'subtask.added':
      return `${actor} added sub-task "${payload.title}"`
    case 'subtask.checked':
      return `${actor} completed sub-task "${payload.title}"`
    case 'subtask.unchecked':
      return `${actor} marked sub-task "${payload.title}" as incomplete`
    case 'subtask.removed':
      return `${actor} deleted sub-task "${payload.title}"`
    case 'ticket.linked':
      return `${actor} linked ${payload.type?.replace('_', ' ')} ${payload.targetKey || payload.sourceKey || 'ticket'}`
    case 'ticket.unlinked':
      return `${actor} removed link (${payload.type?.replace('_', ' ')})`
    case 'ticket.watched':
      return `${actor} started watching this ticket`
    case 'ticket.unwatched':
      return `${actor} stopped watching this ticket`
    case 'ticket.attached':
      return `${actor} attached file "${payload.filename}"`
    case 'ticket.attachment_removed':
      return `${actor} removed attachment "${payload.filename}"`
    case 'ticket.updated':
      if (payload.title) return `${actor} updated ticket title to "${payload.title}"`
      if (payload.description !== undefined) return `${actor} updated ticket description`
      if (payload.priority) return `${actor} set priority to ${payload.priority}`
      if (payload.storyPoints !== undefined)
        return payload.storyPoints != null
          ? `${actor} set story points to ${payload.storyPoints}`
          : `${actor} cleared story points`
      if (payload.sprintId !== undefined) return `${actor} updated sprint assignment`
      if (payload.epicId !== undefined) return `${actor} updated parent epic`
      return `${actor} updated this ticket`
    default:
      return `${actor} updated this ticket`
  }
}

