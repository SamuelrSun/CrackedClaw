import { Activity } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface NoActivityProps {
  onStartChat?: () => void;
}

export function NoActivity({ onStartChat }: NoActivityProps) {
  return (
    <EmptyState
      icon={<Activity size={48} strokeWidth={1.5} />}
      title="No Recent Activity"
      description="Start a conversation to see activity here"
      action={{
        label: "Start Chat",
        href: "/chat"
      }}
    />
  );
}
