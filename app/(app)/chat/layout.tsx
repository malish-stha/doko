import { ChannelSidebar } from '@/components/chat/ChannelSidebar'

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <ChannelSidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-background">{children}</div>
    </div>
  )
}
