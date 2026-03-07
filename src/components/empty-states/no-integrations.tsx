import { Puzzle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export function NoIntegrations() {
  return (
    <EmptyState
      icon={<Puzzle size={48} strokeWidth={1.5} />}
      title="No Integrations Connected"
      description="Connect your tools to give your agent superpowers"
      action={{
        label: "Add Integration",
        href: "/integrations/add"
      }}
    />
  );
}
