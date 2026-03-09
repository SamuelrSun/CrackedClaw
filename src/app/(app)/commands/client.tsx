"use client";

import { useState, useEffect, useContext, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { ToastContext } from "@/contexts/toast-context";
import {
  Play,
  Pencil,
  Trash2,
  Plus,
  Clock,
  Zap,
  Calendar,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────

interface Workflow {
  id: string;
  name: string;
  description: string;
  status: "active" | "inactive" | "pending";
  lastRun: string;
  icon: string;
  prompt?: string;
  triggerPhrases?: string[];
  runCount?: number;
}

interface CronJob {
  id: string;
  name: string;
  description: string;
  schedule: string;
  humanSchedule: string;
  enabled: boolean;
  lastRunStatus: "success" | "error" | "pending" | "none";
  lastRunTime: string | null;
  runCount: number;
  prompt: string;
  workflowId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

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

const SCHEDULE_PRESETS: { label: string; value: string; human: string }[] = [
  { label: "Every hour", value: "0 * * * *", human: "Every hour" },
  { label: "Daily at 6 AM", value: "0 6 * * *", human: "Daily at 6:00 AM" },
  { label: "Daily at 9 AM", value: "0 9 * * *", human: "Daily at 9:00 AM" },
  { label: "Weekly on Monday", value: "0 9 * * 1", human: "Every Monday at 9:00 AM" },
  { label: "Custom", value: "custom", human: "Custom" },
];

// ─── Main Component ───────────────────────────────────────────────

export default function CommandsPageClient() {
  const [activeTab, setActiveTab] = useState<"workflows" | "scheduled">("workflows");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasGateway, setHasGateway] = useState(false);
  const toast = useContext(ToastContext);
  const router = useRouter();

  // Modals
  const [showNewWorkflow, setShowNewWorkflow] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [runningWorkflow, setRunningWorkflow] = useState<Workflow | null>(null);
  const [deletingWorkflow, setDeletingWorkflow] = useState<Workflow | null>(null);
  const [showNewCron, setShowNewCron] = useState(false);
  const [deletingCron, setDeletingCron] = useState<CronJob | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPrompt, setFormPrompt] = useState("");
  const [formTriggers, setFormTriggers] = useState("");
  const [formSchedule, setFormSchedule] = useState("0 9 * * *");
  const [formCustomCron, setFormCustomCron] = useState("");
  const [formSchedulePreset, setFormSchedulePreset] = useState("0 9 * * *");
  const [formCronWorkflow, setFormCronWorkflow] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [wRes, gRes] = await Promise.all([
        fetch("/api/workflows"),
        fetch("/api/gateway/status"),
      ]);
      if (wRes.ok) {
        const data = await wRes.json();
        setWorkflows(data.workflows || []);
      }
      if (gRes.ok) {
        const data = await gRes.json();
        setHasGateway(data.connected === true);
      }
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Workflow CRUD ────────────────────────────────────────────

  const resetForm = () => {
    setFormName("");
    setFormDesc("");
    setFormPrompt("");
    setFormTriggers("");
    setFormSaving(false);
  };

  const openEditModal = (w: Workflow) => {
    setFormName(w.name);
    setFormDesc(w.description);
    setFormPrompt(w.prompt || "");
    setFormTriggers((w.triggerPhrases || []).join(", "));
    setEditingWorkflow(w);
  };

  const handleCreateWorkflow = async () => {
    if (!formName.trim() || !formDesc.trim()) return;
    setFormSaving(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          description: formDesc,
          config: {
            prompt: formPrompt,
            triggerPhrases: formTriggers
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          },
        }),
      });
      if (res.ok) {
        toast?.addToast({ variant: "success", title: "Workflow created", message: formName });
        setShowNewWorkflow(false);
        resetForm();
        fetchData();
      } else {
        const data = await res.json();
        toast?.addToast({ variant: "error", title: "Error", message: data.error || "Failed" });
      }
    } catch {
      toast?.addToast({ variant: "error", title: "Error", message: "Network error" });
    } finally {
      setFormSaving(false);
    }
  };

  const handleUpdateWorkflow = async () => {
    if (!editingWorkflow || !formName.trim() || !formDesc.trim()) return;
    setFormSaving(true);
    try {
      const res = await fetch(`/api/workflows/${editingWorkflow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          description: formDesc,
          config: {
            prompt: formPrompt,
            triggerPhrases: formTriggers
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          },
        }),
      });
      if (res.ok) {
        toast?.addToast({ variant: "success", title: "Updated", message: formName });
        setEditingWorkflow(null);
        resetForm();
        fetchData();
      }
    } catch {
      toast?.addToast({ variant: "error", title: "Error", message: "Failed to update" });
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteWorkflow = async () => {
    if (!deletingWorkflow) return;
    try {
      const res = await fetch(`/api/workflows/${deletingWorkflow.id}`, { method: "DELETE" });
      if (res.ok) {
        toast?.addToast({ variant: "success", title: "Deleted", message: deletingWorkflow.name });
        setDeletingWorkflow(null);
        fetchData();
      }
    } catch {
      toast?.addToast({ variant: "error", title: "Error", message: "Failed to delete" });
    }
  };

  const handleRunWorkflow = (w: Workflow) => {
    setRunningWorkflow(w);
  };

  const handleStartChat = () => {
    if (!runningWorkflow) return;
    const prompt = runningWorkflow.prompt || runningWorkflow.description;
    router.push(`/chat?workflow=${runningWorkflow.id}&prompt=${encodeURIComponent(prompt)}`);
  };

  // ─── Cron CRUD (client-side state — no API yet) ──────────────

  const handleCreateCron = () => {
    const schedule = formSchedulePreset === "custom" ? formCustomCron : formSchedulePreset;
    const preset = SCHEDULE_PRESETS.find((p) => p.value === formSchedulePreset);
    const humanSchedule =
      formSchedulePreset === "custom" ? formCustomCron : preset?.human || schedule;

    const newJob: CronJob = {
      id: `cron-${Date.now()}`,
      name: formName,
      description: formDesc,
      schedule,
      humanSchedule,
      enabled: true,
      lastRunStatus: "none",
      lastRunTime: null,
      runCount: 0,
      prompt: formPrompt,
      workflowId: formCronWorkflow || undefined,
    };
    setCronJobs((prev) => [...prev, newJob]);
    toast?.addToast({ variant: "success", title: "Cron job created", message: formName });
    setShowNewCron(false);
    resetForm();
    setFormSchedulePreset("0 9 * * *");
    setFormCustomCron("");
    setFormCronWorkflow("");
  };

  const toggleCron = (id: string) => {
    setCronJobs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const handleDeleteCron = () => {
    if (!deletingCron) return;
    setCronJobs((prev) => prev.filter((c) => c.id !== deletingCron.id));
    toast?.addToast({ variant: "success", title: "Deleted", message: deletingCron.name });
    setDeletingCron(null);
  };

  // ─── Loading State ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="font-header text-3xl font-bold tracking-tight leading-tight">
            Commands
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mt-1">
            Workflows & scheduled tasks
          </p>
        </div>
        <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-header text-3xl font-bold tracking-tight leading-tight">
            Commands
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mt-1">
            Workflows & scheduled tasks
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === "workflows" ? (
            <Button
              variant="solid"
              onClick={() => {
                resetForm();
                setShowNewWorkflow(true);
              }}
            >
              <Plus size={14} className="mr-1" /> New Workflow
            </Button>
          ) : (
            <Button
              variant="solid"
              onClick={() => {
                resetForm();
                setFormSchedulePreset("0 9 * * *");
                setFormCustomCron("");
                setFormCronWorkflow("");
                setShowNewCron(true);
              }}
            >
              <Plus size={14} className="mr-1" /> New Cron Job
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[rgba(58,58,56,0.2)] mb-6">
        <button
          onClick={() => setActiveTab("workflows")}
          className={`px-4 py-2 font-mono text-[11px] uppercase tracking-wide transition-colors border-b-2 -mb-px ${
            activeTab === "workflows"
              ? "border-forest text-forest"
              : "border-transparent text-grid/50 hover:text-forest"
          }`}
        >
          <Zap size={14} className="inline mr-1.5 -mt-0.5" />
          Workflows
        </button>
        <button
          onClick={() => setActiveTab("scheduled")}
          className={`px-4 py-2 font-mono text-[11px] uppercase tracking-wide transition-colors border-b-2 -mb-px ${
            activeTab === "scheduled"
              ? "border-forest text-forest"
              : "border-transparent text-grid/50 hover:text-forest"
          }`}
        >
          <Calendar size={14} className="inline mr-1.5 -mt-0.5" />
          Scheduled
          {cronJobs.length > 0 && (
            <span className="ml-1.5 bg-forest/10 text-forest px-1.5 py-0.5 text-[10px] rounded-sm">
              {cronJobs.length}
            </span>
          )}
        </button>
      </div>

      {/* ─── Workflows Tab ─────────────────────────────────── */}
      {activeTab === "workflows" && (
        <>
          {!hasGateway && workflows.length > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <strong>No gateway connected.</strong>{" "}
              <a href="/settings" className="underline">
                Connect your CrackedClaw gateway
              </a>{" "}
              to run workflows.
            </div>
          )}

          {workflows.length === 0 ? (
            <Card className="text-center py-16 px-8">
              <div className="w-16 h-16 mx-auto mb-4 border border-[rgba(58,58,56,0.2)] flex items-center justify-center">
                <Zap size={28} className="text-grid/30" />
              </div>
              <h3 className="font-header text-xl font-bold tracking-tight mb-2">
                No workflows yet
              </h3>
              <p className="text-sm text-grid/60 max-w-md mx-auto mb-6 leading-relaxed">
                Workflows are reusable prompts you can trigger with a single click or
                a phrase. Create one to automate repetitive tasks — like a morning
                briefing, inbox summary, or code review checklist.
              </p>
              <div className="bg-white border border-[rgba(58,58,56,0.1)] p-4 max-w-sm mx-auto mb-6 text-left">
                <p className="font-mono text-[10px] uppercase tracking-wide text-grid/40 mb-2">
                  Example
                </p>
                <p className="font-header text-sm font-bold mb-1">Morning Briefing</p>
                <p className="text-xs text-grid/60">
                  &quot;Check my calendar for today, summarize unread emails, and give me a
                  weather update.&quot;
                </p>
              </div>
              <Button
                variant="solid"
                onClick={() => {
                  resetForm();
                  setShowNewWorkflow(true);
                }}
              >
                <Plus size={14} className="mr-1" /> Create your first workflow
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[rgba(58,58,56,0.2)] border border-[rgba(58,58,56,0.2)]">
              {workflows.map((w) => (
                <div key={w.id} className="bg-paper p-6 flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-header text-lg font-bold tracking-tight">
                      {w.name}
                    </h3>
                    <Badge status={w.status}>{w.status}</Badge>
                  </div>
                  <p className="text-sm text-grid/60 mb-3 leading-relaxed flex-1">
                    {w.description}
                  </p>

                  {/* Trigger phrases */}
                  {w.triggerPhrases && w.triggerPhrases.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {w.triggerPhrases.map((phrase) => (
                        <span
                          key={phrase}
                          className="inline-block bg-forest/5 text-forest/70 font-mono text-[10px] px-2 py-0.5 border border-forest/10"
                        >
                          {phrase}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-3 mb-4 font-mono text-[10px] text-grid/40 uppercase tracking-wide">
                    <span>Last: {formatLastRun(w.lastRun)}</span>
                    {typeof w.runCount === "number" && (
                      <span>{w.runCount} runs</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="solid"
                      onClick={() => handleRunWorkflow(w)}
                      disabled={!hasGateway || w.status !== "active"}
                    >
                      <Play size={12} className="mr-1" /> Run
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEditModal(w)}>
                      <Pencil size={12} className="mr-1" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-coral hover:bg-coral hover:text-white hover:border-coral"
                      onClick={() => setDeletingWorkflow(w)}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Scheduled Tab ─────────────────────────────────── */}
      {activeTab === "scheduled" && (
        <>
          {cronJobs.length === 0 ? (
            <Card className="text-center py-16 px-8">
              <div className="w-16 h-16 mx-auto mb-4 border border-[rgba(58,58,56,0.2)] flex items-center justify-center">
                <Clock size={28} className="text-grid/30" />
              </div>
              <h3 className="font-header text-xl font-bold tracking-tight mb-2">
                No scheduled jobs
              </h3>
              <p className="text-sm text-grid/60 max-w-md mx-auto mb-6 leading-relaxed">
                Cron jobs run workflows on a schedule — daily briefings, weekly
                reports, hourly monitoring. Set it and forget it.
              </p>
              <Button
                variant="solid"
                onClick={() => {
                  resetForm();
                  setFormSchedulePreset("0 9 * * *");
                  setShowNewCron(true);
                }}
              >
                <Plus size={14} className="mr-1" /> Create your first cron job
              </Button>
            </Card>
          ) : (
            <div className="space-y-px bg-[rgba(58,58,56,0.2)] border border-[rgba(58,58,56,0.2)]">
              {cronJobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-paper p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-header text-base font-bold tracking-tight truncate">
                        {job.name}
                      </h3>
                      {job.lastRunStatus !== "none" && (
                        <Badge
                          status={
                            job.lastRunStatus === "success"
                              ? "active"
                              : job.lastRunStatus === "error"
                              ? "error"
                              : "pending"
                          }
                        >
                          {job.lastRunStatus}
                        </Badge>
                      )}
                    </div>
                    <p className="font-mono text-[11px] text-grid/50 mb-1">
                      {job.humanSchedule}
                    </p>
                    {job.description && (
                      <p className="text-sm text-grid/60 truncate">{job.description}</p>
                    )}
                    <div className="flex gap-3 mt-1 font-mono text-[10px] text-grid/40 uppercase tracking-wide">
                      {job.lastRunTime && (
                        <span>Last: {formatLastRun(job.lastRunTime)}</span>
                      )}
                      <span>{job.runCount} runs</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => toggleCron(job.id)}
                      className="text-forest hover:opacity-80 transition-opacity"
                      title={job.enabled ? "Disable" : "Enable"}
                    >
                      {job.enabled ? (
                        <ToggleRight size={28} />
                      ) : (
                        <ToggleLeft size={28} className="text-grid/40" />
                      )}
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-coral hover:bg-coral hover:text-white hover:border-coral"
                      onClick={() => setDeletingCron(job)}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Modals ────────────────────────────────────────── */}

      {/* New Workflow Modal */}
      <Modal
        isOpen={showNewWorkflow}
        onClose={() => {
          setShowNewWorkflow(false);
          resetForm();
        }}
        title="New Workflow"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            placeholder="Morning Briefing"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <Input
            label="Description"
            placeholder="What does this workflow do?"
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
              Prompt
            </label>
            <textarea
              className="w-full bg-white border border-[rgba(58,58,56,0.2)] rounded-none px-3 py-2 font-body text-sm text-forest placeholder:text-grid/30 outline-none focus:border-forest transition-colors min-h-[120px] resize-y"
              placeholder="Check my calendar for today, summarize unread emails..."
              value={formPrompt}
              onChange={(e) => setFormPrompt(e.target.value)}
            />
          </div>
          <Input
            label="Trigger Phrases (comma-separated)"
            placeholder="morning brief, daily update, start my day"
            value={formTriggers}
            onChange={(e) => setFormTriggers(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowNewWorkflow(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              onClick={handleCreateWorkflow}
              disabled={!formName.trim() || !formDesc.trim() || formSaving}
            >
              {formSaving ? "Creating..." : "Create Workflow"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Workflow Modal */}
      <Modal
        isOpen={!!editingWorkflow}
        onClose={() => {
          setEditingWorkflow(null);
          resetForm();
        }}
        title="Edit Workflow"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <Input
            label="Description"
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
              Prompt
            </label>
            <textarea
              className="w-full bg-white border border-[rgba(58,58,56,0.2)] rounded-none px-3 py-2 font-body text-sm text-forest placeholder:text-grid/30 outline-none focus:border-forest transition-colors min-h-[120px] resize-y"
              value={formPrompt}
              onChange={(e) => setFormPrompt(e.target.value)}
            />
          </div>
          <Input
            label="Trigger Phrases (comma-separated)"
            value={formTriggers}
            onChange={(e) => setFormTriggers(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setEditingWorkflow(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              onClick={handleUpdateWorkflow}
              disabled={!formName.trim() || !formDesc.trim() || formSaving}
            >
              {formSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Run Workflow Modal */}
      <Modal
        isOpen={!!runningWorkflow}
        onClose={() => setRunningWorkflow(null)}
        title={runningWorkflow ? `Starting: ${runningWorkflow.name}` : "Run Workflow"}
      >
        {runningWorkflow && (
          <div className="space-y-4">
            <p className="text-sm text-grid/60">{runningWorkflow.description}</p>
            {(runningWorkflow.prompt || runningWorkflow.description) && (
              <div className="bg-white border border-[rgba(58,58,56,0.1)] p-3">
                <p className="font-mono text-[10px] uppercase tracking-wide text-grid/40 mb-1.5">
                  Prompt
                </p>
                <p className="text-sm text-forest leading-relaxed font-mono">
                  {runningWorkflow.prompt || runningWorkflow.description}
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setRunningWorkflow(null)}>
                Cancel
              </Button>
              <Button variant="solid" onClick={handleStartChat}>
                <Play size={12} className="mr-1" /> Start Chat
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Workflow Confirm */}
      <Modal
        isOpen={!!deletingWorkflow}
        onClose={() => setDeletingWorkflow(null)}
        title="Delete Workflow"
      >
        {deletingWorkflow && (
          <div className="space-y-4">
            <p className="text-sm text-grid/60">
              Are you sure you want to delete{" "}
              <strong className="text-forest">{deletingWorkflow.name}</strong>? This
              action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setDeletingWorkflow(null)}>
                Cancel
              </Button>
              <Button
                variant="solid"
                className="bg-coral border-coral hover:bg-coral/90"
                onClick={handleDeleteWorkflow}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* New Cron Job Modal */}
      <Modal
        isOpen={showNewCron}
        onClose={() => {
          setShowNewCron(false);
          resetForm();
        }}
        title="New Cron Job"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            placeholder="Daily Morning Briefing"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <Input
            label="Description"
            placeholder="Optional description"
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
              Schedule
            </label>
            <select
              className="w-full bg-white border border-[rgba(58,58,56,0.2)] rounded-none px-3 py-2 font-body text-sm text-forest outline-none focus:border-forest transition-colors"
              value={formSchedulePreset}
              onChange={(e) => {
                setFormSchedulePreset(e.target.value);
                if (e.target.value !== "custom") setFormSchedule(e.target.value);
              }}
            >
              {SCHEDULE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {formSchedulePreset === "custom" && (
              <Input
                placeholder="*/15 * * * *"
                value={formCustomCron}
                onChange={(e) => setFormCustomCron(e.target.value)}
              />
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
              Prompt
            </label>
            <textarea
              className="w-full bg-white border border-[rgba(58,58,56,0.2)] rounded-none px-3 py-2 font-body text-sm text-forest placeholder:text-grid/30 outline-none focus:border-forest transition-colors min-h-[100px] resize-y"
              placeholder="What should this job do when it runs?"
              value={formPrompt}
              onChange={(e) => setFormPrompt(e.target.value)}
            />
          </div>
          {workflows.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
                Link to Workflow (optional)
              </label>
              <select
                className="w-full bg-white border border-[rgba(58,58,56,0.2)] rounded-none px-3 py-2 font-body text-sm text-forest outline-none focus:border-forest transition-colors"
                value={formCronWorkflow}
                onChange={(e) => setFormCronWorkflow(e.target.value)}
              >
                <option value="">None</option>
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowNewCron(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              onClick={handleCreateCron}
              disabled={!formName.trim()}
            >
              Create Cron Job
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Cron Confirm */}
      <Modal
        isOpen={!!deletingCron}
        onClose={() => setDeletingCron(null)}
        title="Delete Cron Job"
      >
        {deletingCron && (
          <div className="space-y-4">
            <p className="text-sm text-grid/60">
              Are you sure you want to delete{" "}
              <strong className="text-forest">{deletingCron.name}</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setDeletingCron(null)}>
                Cancel
              </Button>
              <Button
                variant="solid"
                className="bg-coral border-coral hover:bg-coral/90"
                onClick={handleDeleteCron}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
