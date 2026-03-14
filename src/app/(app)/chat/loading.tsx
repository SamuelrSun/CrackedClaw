import { Skeleton } from "@/components/ui/skeleton";
import { ConversationListSkeleton } from "@/components/skeletons/list-skeleton";
import { ChatSkeleton } from "@/components/skeletons/chat-skeleton";

export default function ChatLoading() {
  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Conversation Sidebar Skeleton */}
      <aside className="w-64 border-r border-white/[0.1] bg-paper flex flex-col">
        <div className="px-4 py-3 border-b border-white/[0.1] flex items-center justify-between">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-7 w-12" />
        </div>
        <div className="flex-1 overflow-y-auto">
          <ConversationListSkeleton rows={6} />
        </div>
        
        {/* Gateway Status */}
        <div className="px-4 py-3 border-t border-white/[0.1] bg-paper">
          <div className="flex items-center gap-2">
            <Skeleton className="w-2 h-2" rounded />
            <Skeleton className="h-2 w-24" />
          </div>
        </div>
      </aside>

      {/* Chat Area Skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <ChatSkeleton messages={5} />
        </div>

        {/* Input */}
        <div className="border-t border-white/[0.1] p-4">
          <div className="flex gap-2">
            <Skeleton className="flex-1 h-10" />
            <Skeleton className="h-10 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}
