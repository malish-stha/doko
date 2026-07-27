import { TicketDetailClient } from '@/components/tickets/TicketDetailClient'

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ key: string }>
}) {
  const { key } = await params
  return <TicketDetailClient ticketKey={key} />
}
