import { MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface NoConversationsProps {
  onNewChat?: () => void;
}

export function NoConversations({ onNewChat }: NoConversationsProps) {
  return (
    <EmptyState
      icon={<MessageSquare size={48} strokeWidth={1.5} />}
      title="Start a Conversation"
      description="Chat with your AI agent"
      action={{
        label: "New Chat",
        onClick: onNewChat
      }}
    />
  );
}
