import { MessageSquareIcon } from 'lucide-react'

export default function ChatPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="w-12 h-12 rounded-none bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mb-3">
        <MessageSquareIcon className="w-6 h-6 text-teal-400" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight">Select a channel</h2>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm">
        Pick a channel from the left sidebar or create a new one to start chatting with your team.
      </p>
    </div>
  )
}
