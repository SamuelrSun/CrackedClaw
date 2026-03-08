"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import { useFormValidation } from "@/hooks/use-form-validation";
import { validateRequired, validateMaxLength, composeValidators } from "@/lib/validation";
import { workflows as initialWorkflows, Workflow } from "@/lib/mock-data";
import { X } from "lucide-react";

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>(initialWorkflows);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form validation for creating workflow
  const createForm = useFormValidation({
    fields: {
      name: composeValidators(
        (v) => validateRequired(v, "Name"),
        (v) => validateMaxLength(v, 50, "Name"),
      ),
      description: (v) => validateMaxLength(v, 500, "Description"),
    },
    onSubmit: handleCreateWorkflow,
  });

  async function handleCreateWorkflow(values: { name: string; description: string }) {
    setCreating(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const newWorkflow: Workflow = {
        id: Date.now().toString(),
        name: values.name,
        description: values.description || "No description",
        icon: "⚡",
        status: "pending",
        lastRun: "Never",
      };
      
      setWorkflows(prev => [newWorkflow, ...prev]);
      setShowCreateForm(false);
      createForm.reset();
    } catch (err) {
      console.error('Failed to create workflow:', err);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-header text-3xl font-bold tracking-tight leading-tight">
            Workflows
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mt-1">
            Pre-built automation commands
          </p>
        </div>
        <Button variant="solid" onClick={() => setShowCreateForm(true)}>Create Workflow</Button>
      </div>

      {/* Create Workflow Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[rgba(58,58,56,0.2)] w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-[rgba(58,58,56,0.1)]">
              <h2 className="font-header text-lg font-bold">Create Workflow</h2>
              <button 
                onClick={() => {
                  setShowCreateForm(false);
                  createForm.reset();
                }}
                className="text-grid/50 hover:text-forest transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={createForm.handleSubmit} className="p-4 space-y-4">
              {/* Form Error Summary */}
              {createForm.formErrors.length > 0 && (
                <FormErrorSummary 
                  errors={createForm.formErrors}
                  onScrollToFirst={createForm.scrollToFirstError}
                />
              )}
              
              <Input
                label="Name"
                placeholder="My Workflow"
                value={createForm.values.name}
                onChange={createForm.handleChange("name")}
                onBlur={createForm.handleBlur("name")}
                error={createForm.errors.name}
                touched={createForm.touched.name}
              />
              
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
                  Description (optional)
                </label>
                <textarea
                  className={`w-full bg-white border rounded-none px-3 py-2 font-body text-sm text-forest placeholder:text-grid/30 outline-none transition-colors min-h-[80px] resize-none ${
                    createForm.errors.description && createForm.touched.description
                      ? "border-coral focus:border-coral"
                      : "border-[rgba(58,58,56,0.2)] focus:border-forest"
                  }`}
                  placeholder="What does this workflow do..."
                  value={createForm.values.description}
                  onChange={createForm.handleChange("description")}
                  onBlur={createForm.handleBlur("description")}
                />
                {createForm.errors.description && createForm.touched.description && (
                  <span className="font-mono text-[11px] text-coral">
                    {createForm.errors.description}
                  </span>
                )}
                <span className="font-mono text-[9px] text-grid/40">
                  {createForm.values.description.length}/500 characters
                </span>
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setShowCreateForm(false);
                    createForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="solid" 
                  size="sm"
                  disabled={creating || !createForm.isValid}
                >
                  {creating ? "Creating..." : "Create Workflow"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-px bg-[rgba(58,58,56,0.2)]">
        {workflows.map((wf) => (
          <Card key={wf.id} label={wf.icon} accentColor={wf.status === "active" ? "#9EFFBF" : wf.status === "pending" ? "#F4D35E" : undefined}>
            <div className="mt-2">
              <h3 className="font-header text-lg font-bold tracking-tight">{wf.name}</h3>
              <p className="text-sm text-grid/60 mt-1">{wf.description}</p>
              <div className="flex items-center justify-between mt-4">
                <Badge status={wf.status}>{wf.status}</Badge>
                <Button variant="solid" size="sm">Run</Button>
              </div>
              <p className="font-mono text-[10px] text-grid/40 mt-3">
                Last run: {wf.lastRun}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
