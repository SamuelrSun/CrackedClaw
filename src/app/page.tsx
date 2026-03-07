import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getWorkflows, getActivityLog, getTokenUsage } from "@/lib/supabase/data";
import { ActivityFeed } from "@/components/activity/activity-feed";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage() {
  const [workflows, activityLog, tokenUsage] = await Promise.all([
    getWorkflows(),
    getActivityLog({ limit: 5 }),
    getTokenUsage(),
  ]);

  const activeWorkflows = workflows.filter(w => w.status === "active");

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-header text-3xl font-bold tracking-tight leading-tight">
          Command Center
        </h1>
        <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mt-1">
          Agent Dashboard / Overview
        </p>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-[rgba(58,58,56,0.2)]">
        {/* Client-side gateway status components */}
        <DashboardClient initialTokenUsage={tokenUsage} />

        {/* Active Workflows */}
        <Card label="Active Workflows" accentColor="#1A3C2B" className="md:col-span-2" bordered={false}>
          <div className="space-y-3 mt-2">
            {activeWorkflows.length > 0 ? (
              activeWorkflows.slice(0, 4).map((w) => (
                <div key={w.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge status="active">{w.name}</Badge>
                  </div>
                  <span className="font-mono text-[10px] text-grid/40">{w.lastRun}</span>
                </div>
              ))
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-grid/50 mb-2">No workflows yet</p>
                <p className="font-mono text-[10px] text-grid/40">
                  Create your first workflow to automate tasks
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card label="Recent Activity" accentColor="#FF8C69" className="md:col-span-2" bordered={false}>
          <ActivityFeed 
            activities={activityLog} 
            limit={5} 
            showViewAll={true}
          />
        </Card>
      </div>
    </div>
  );
}
