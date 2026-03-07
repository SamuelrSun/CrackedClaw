import { Zap } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface NoWorkflowsProps {
  onCreateWorkflow?: () => void;
}

export function NoWorkflows({ onCreateWorkflow }: NoWorkflowsProps) {
  return (
    <EmptyState
      icon={<Zap size={48} strokeWidth={1.5} />}
      title="No Workflows Yet"
      description="Workflows automate repetitive tasks"
      action={{
        label: "Create Workflow",
        onClick: onCreateWorkflow
      }}
    />
  );
}
