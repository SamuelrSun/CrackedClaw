import { Brain } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface NoMemoryProps {
  onAddMemory?: () => void;
}

export function NoMemory({ onAddMemory }: NoMemoryProps) {
  return (
    <EmptyState
      icon={<Brain size={48} strokeWidth={1.5} />}
      title="Memory is Empty"
      description="Your agent will remember important things here"
      action={{
        label: "Add Memory",
        onClick: onAddMemory
      }}
    />
  );
}
