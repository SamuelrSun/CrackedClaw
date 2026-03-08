"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { WorkflowForm, WorkflowFormData } from "@/components/workflows/workflow-form";

export default function NewWorkflowPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: WorkflowFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          icon: data.icon,
          trigger_type: data.triggerType,
          schedule: data.triggerType === "scheduled" ? data.schedule : null,
          status: "inactive",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create workflow");
      }

      const result = await response.json();
      router.push(`/workflows/${result.workflow.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workflow");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Breadcrumbs 
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Workflows", href: "/workflows" },
          { label: "New" },
        ]} 
      />
      
      <div className="mb-6">
        <h1 className="font-header text-3xl font-bold tracking-tight leading-tight">
          Create Workflow
        </h1>
        <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mt-1">
          Define a new automation
        </p>
      </div>

      <Card>
        {error && (
          <div className="mb-4 p-3 bg-coral/10 border border-coral text-coral text-sm">
            {error}
          </div>
        )}
        <WorkflowForm
          onSubmit={handleSubmit}
          onCancel={() => router.push("/workflows")}
          submitLabel="Create Workflow"
          isLoading={isLoading}
        />
      </Card>
    </div>
  );
}
