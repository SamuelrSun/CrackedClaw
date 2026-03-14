"use client";

import { useState, useEffect, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { WorkflowForm, WorkflowFormData, TriggerType } from "@/components/workflows/workflow-form";
import { getIconComponent } from "@/components/workflows/icon-picker";
import { Play, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import type { Workflow } from "@/lib/mock-data";

interface WorkflowRun {
  id: string;
  status: "success" | "failed" | "running";
  startedAt: string;
  completedAt?: string;
  duration?: string;
}

export default function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runHistory] = useState<WorkflowRun[]>([]);

  useEffect(() => {
    async function fetchWorkflow() {
      try {
        const response = await fetch(`/api/workflows/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Workflow not found");
          } else {
            throw new Error("Failed to fetch workflow");
          }
          return;
        }
        const data = await response.json();
        setWorkflow(data.workflow);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load workflow");
      } finally {
        setIsLoading(false);
      }
    }

    fetchWorkflow();
  }, [id]);

  const handleUpdate = async (data: WorkflowFormData) => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/workflows/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          icon: data.icon,
          trigger_type: data.triggerType,
          schedule: data.triggerType === "scheduled" ? data.schedule : null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update workflow");
      }

      const result = await response.json();
      setWorkflow(result.workflow);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update workflow");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/workflows/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete workflow");
      }

      router.push("/workflows");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete workflow");
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleRun = async () => {
    try {
      const response = await fetch(`/api/workflows/${id}/run`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to run workflow");
      }

      // Refresh workflow data to get updated lastRun
      const workflowResponse = await fetch(`/api/workflows/${id}`);
      if (workflowResponse.ok) {
        const data = await workflowResponse.json();
        setWorkflow(data.workflow);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run workflow");
    }
  };

  const handleToggleStatus = async () => {
    if (!workflow) return;

    const newStatus = workflow.status === "active" ? "inactive" : "active";

    try {
      const response = await fetch(`/api/workflows/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update workflow status");
      }

      const result = await response.json();
      setWorkflow(result.workflow);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  // Breadcrumbs with dynamic workflow name
  const breadcrumbItems = useMemo(() => [
    { label: "Home", href: "/" },
    { label: "Workflows", href: "/workflows" },
    { label: workflow?.name || "Loading..." },
  ], [workflow?.name]);

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Breadcrumbs 
          items={[
            { label: "Home", href: "/" },
            { label: "Workflows", href: "/workflows" },
            { label: "Loading..." },
          ]} 
        />
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-grid/10 w-1/3"></div>
          <div className="h-64 bg-grid/10"></div>
        </div>
      </div>
    );
  }

  if (error && !workflow) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Breadcrumbs 
          items={[
            { label: "Home", href: "/" },
            { label: "Workflows", href: "/workflows" },
            { label: "Error" },
          ]} 
        />
        <Card>
          <div className="text-center py-8">
            <p className="text-grid/60">{error}</p>
            <Button variant="solid" onClick={() => router.push("/workflows")} className="mt-4">
              Go Back
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!workflow) return null;

  const Icon = getIconComponent(workflow.icon);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Breadcrumbs items={breadcrumbItems} />

      {error && (
        <div className="mb-4 p-3 bg-coral/10 border border-coral text-coral text-sm">
          {error}
        </div>
      )}

      {isEditing ? (
        <Card>
          <h2 className="font-header text-xl font-bold tracking-tight mb-6">
            Edit Workflow
          </h2>
          <WorkflowForm
            initialData={{
              name: workflow.name,
              description: workflow.description,
              icon: workflow.icon,
              triggerType: "manual" as TriggerType,
            }}
            onSubmit={handleUpdate}
            onCancel={() => setIsEditing(false)}
            submitLabel="Save Changes"
            isLoading={isSaving}
          />
        </Card>
      ) : (
        <>
          {/* Workflow Info Card */}
          <Card className="mb-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 border border-white/[0.1] flex items-center justify-center">
                  <Icon size={24} className="text-forest" />
                </div>
                <div>
                  <h1 className="font-header text-2xl font-bold tracking-tight">
                    {workflow.name}
                  </h1>
                  <p className="text-sm text-grid/60 mt-1">{workflow.description}</p>
                </div>
              </div>
              <Badge status={workflow.status}>{workflow.status}</Badge>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-white/[0.08]">
              <Button variant="solid" onClick={handleRun}>
                <Play size={14} className="mr-1" />
                Run Now
              </Button>
              <Button variant="ghost" onClick={handleToggleStatus}>
                {workflow.status === "active" ? "Deactivate" : "Activate"}
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" onClick={() => setIsEditing(true)}>
                <Pencil size={14} className="mr-1" />
                Edit
              </Button>
              <Button variant="ghost" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 size={14} className="mr-1" />
                Delete
              </Button>
            </div>
          </Card>

          {/* Workflow Details */}
          <Card className="mb-6" label="Details">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wide text-grid/60 block mb-1">
                  Last Run
                </span>
                <span className="text-sm">{workflow.lastRun}</span>
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wide text-grid/60 block mb-1">
                  Status
                </span>
                <span className="text-sm capitalize">{workflow.status}</span>
              </div>
            </div>
          </Card>

          {/* Run History */}
          <Card label="Run History">
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
                Recent executions
              </span>
              <Link 
                href={`/workflows/${id}/runs`}
                className="font-mono text-[10px] uppercase tracking-wide text-forest hover:underline"
              >
                View All →
              </Link>
            </div>
            {runHistory.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-grid/50 text-sm">No runs yet</p>
                <p className="text-grid/40 text-xs mt-1">
                  Run this workflow to see execution history
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {runHistory.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between p-3 border border-white/[0.08]"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        status={
                          run.status === "success"
                            ? "active"
                            : run.status === "failed"
                            ? "error"
                            : "pending"
                        }
                      >
                        {run.status}
                      </Badge>
                      <span className="text-sm">{run.startedAt}</span>
                    </div>
                    {run.duration && (
                      <span className="font-mono text-xs text-grid/50">
                        {run.duration}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Workflow"
        message={`Are you sure you want to delete "${workflow.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
      />
    </div>
  );
}
