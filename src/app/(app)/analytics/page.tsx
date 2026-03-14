import { Card } from "@/components/ui/card";
import { usageStats, activityLog } from "@/lib/mock-data";

const stats = [
  { label: "Total Workflow Runs", value: usageStats.totalWorkflowRuns.toLocaleString(), accent: "#9EFFBF" },
  { label: "Total Messages", value: usageStats.totalMessages.toLocaleString(), accent: "#FF8C69" },
  { label: "Tokens Used Today", value: `${(usageStats.tokensUsedToday / 1000).toFixed(1)}K`, accent: "#F4D35E" },
  { label: "Active Integrations", value: usageStats.activeIntegrations.toString(), accent: "#1A3C2B" },
];

export default function AnalyticsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-header text-3xl font-bold tracking-tight leading-tight">
          Analytics
        </h1>
        <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mt-1">
          Usage statistics and activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-px bg-white/[0.05] mb-px">
        {stats.map((stat) => (
          <Card key={stat.label} label={stat.label} accentColor={stat.accent}>
            <span className="font-header text-4xl font-bold tracking-tight block mt-2">
              {stat.value}
            </span>
          </Card>
        ))}
      </div>

      {/* Activity Log */}
      <div className="grid grid-cols-1 gap-px bg-white/[0.05]">
        <Card label="Activity Log" accentColor="#FF8C69">
          <div className="mt-2 space-y-3">
            {activityLog.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between border-b border-white/[0.08] pb-3 last:border-0"
              >
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-1.5 bg-forest rounded-none" />
                  <div>
                    <p className="text-sm">{item.action}</p>
                    <p className="font-mono text-[10px] text-grid/50">{item.detail}</p>
                  </div>
                </div>
                <span className="font-mono text-[10px] text-grid/40">{item.timestamp}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
