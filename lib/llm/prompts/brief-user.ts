import type { Doc } from '@/convex/_generated/dataModel'

type Args = {
  user: Doc<'users'>
  forDate: string
  events: Doc<'activityEvents'>[]
  myTickets: Doc<'tickets'>[]
}

export function buildUserPrompt({
  user,
  forDate,
  events,
  myTickets,
}: Args): string {
  const eventsSummary = events.map(e => ({
    kind: e.kind,
    actor: e.userId,
    payload: e.payload,
    ts: new Date(e.ts).toISOString(),
  }))
  const ticketsSummary = myTickets.map(t => ({
    key: t.key,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
  }))
  return `Writing today's Brief for ${user.name} (timezone ${user.timezone}). Today is ${forDate}.

Team events in the past 24 hours (JSON):
${JSON.stringify(eventsSummary, null, 2)}

${user.name}'s open tickets (JSON):
${JSON.stringify(ticketsSummary, null, 2)}

Meetings today: (none — calendar integration pending)

Write the Brief now.`
}
