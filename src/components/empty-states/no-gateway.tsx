import { Unplug } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export function NoGateway() {
  return (
    <EmptyState
      icon={<Unplug size={48} strokeWidth={1.5} />}
      title="Connect Your OpenClaw"
      description="Link your personal AI agent to unlock all features"
      action={{
        label: "Go to Settings",
        href: "/settings"
      }}
    />
  );
}
