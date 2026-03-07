"use client";

import { useState, useEffect, useContext } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NoWorkflows } from "@/components/empty-states";
import { RunButton } from "@/components/workflows/run-button";
import { ToastContext } from "@/contexts/toast-context";
import type { Workflow } from "@/lib/mock-data";
import { 
  Sun, Mail, Search, FileText, Calendar, BarChart3, Zap, 
  History, type LucideIcon 
} from "lucide-react";
import Link from "next/link";

const iconMap: Record<string, LucideIcon> = { 
  Sun, Mail, Search, FileText, Calendar, BarChart3, Zap 
};

function getIcon(name: string): LucideIcon {
  return iconMap[name] ?? Zap;
}

function formatLastRun(lastRun: string): string {
  if (!lastRun || lastRun === "Never") return "Never";
  
  try {
    const date = new Date(lastRun);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  } catch {
    return lastRun;
  }
}

export default function CommandsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasGateway, setHasGateway] = useState(false);
  const toast = useContext(ToastContext);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch workflows
        const workflowsRes = await fetch("/api/workflows");
        if (workflowsRes.ok) {
          const data = await workflowsRes.json();
          setWorkflows(data.workflows || []);
        }

        // Check if gateway is connected
        const gatewayRes = await fetch("/api/gateway/status");
        if (gatewayRes.ok) {
          const data = await gatewayRes.json();
          setHasGateway(data.connected === true);
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleCreateWorkflow = () => {
    // TODO: Implement workflow creation modal
    alert("Create workflow functionality coming soon!");
  };

  const handleRunSuccess = (workflowId: string, workflowName: string) => {
    toast?.addToast({
      variant: "success",
      title: "Workflow Completed",
      message: `${workflowName} ran successfully`,
    });
    
    // Update the last run time in the UI
    setWorkflows((prev) =>
      prev.map((w) =>
        w.id === workflowId ? { ...w, lastRun: "Just now" } : w
      )
    );
  };

  const handleRunError = (workflowName: string, error: string) => {
    toast?.addToast({
      variant: "error",
      title: "Workflow Failed",
      message: `${workflowName}: ${error}`,
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-header text-3xl font-bold tracking-tight leading-tight">
              Commands
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mt-1">
              Pre-built workflows
            </p>
          </div>
        </div>
        <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-header text-3xl font-bold tracking-tight leading-tight">
            Commands
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mt-1">
            Pre-built workflows
          </p>
        </div>
        <Button variant="solid" onClick={handleCreateWorkflow}>
          <span className="mr-1">+</span> Create Workflow
        </Button>
      </div>

      {!hasGateway && workflows.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <strong>No gateway connected.</strong>{" "}
          <Link href="/settings" className="underline">
            Connect your OpenClaw gateway
          </Link>{" "}
          to run workflows.
        </div>
      )}

      {workflows.length === 0 ? (
        <div className="border border-[rgba(58,58,56,0.2)] bg-white">
          <NoWorkflows onCreateWorkflow={handleCreateWorkflow} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[rgba(58,58,56,0.2)]">
          {workflows.map((cmd) => {
            const Icon = getIcon(cmd.icon);
            const isActive = cmd.status === "active";
            
            return (
              <Card key={cmd.id} className="rounded-none" bordered={false}>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 border border-[rgba(58,58,56,0.2)] rounded-none flex items-center justify-center">
                    <Icon size={18} className="text-forest" />
                  </div>
                  <Badge status={cmd.status}>{cmd.status}</Badge>
                </div>
                <h3 className="font-header text-lg font-bold tracking-tight mb-1">
                  {cmd.name}
                </h3>
                <p className="text-sm text-grid/60 mb-4 leading-relaxed">
                  {cmd.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-grid/40 uppercase tracking-wide">
                      Last: {formatLastRun(cmd.lastRun)}
                    </span>
                    <Link
                      href={`/workflows/${cmd.id}/runs`}
                      className="text-grid/40 hover:text-forest transition-colors"
                      title="View run history"
                    >
                      <History size={14} />
                    </Link>
                  </div>
                  <RunButton
                    workflowId={cmd.id}
                    workflowName={cmd.name}
                    disabled={!hasGateway || !isActive}
                    lastRun={cmd.lastRun}
                    onSuccess={() => handleRunSuccess(cmd.id, cmd.name)}
                    onError={(error) => handleRunError(cmd.name, error)}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
