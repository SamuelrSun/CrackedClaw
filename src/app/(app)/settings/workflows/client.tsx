"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Trash2, ToggleLeft, ToggleRight, RefreshCw, AlertCircle } from "lucide-react";
import {
  listGatewayCronJobs,
  createGatewayCronJob,
  toggleGatewayCronJob,
  deleteGatewayCronJob,
  type GatewayCronJob,
} from "@/lib/gateway/cron-client";

function parseCronHuman(schedule: string): string {
  const presets: Record<string, string> = {
    "* * * * *": "Every minute",
    "*/5 * * * *": "Every 5 minutes",
    "*/15 * * * *": "Every 15 minutes",
    "*/30 * * * *": "Every 30 minutes",
    "0 * * * *": "Every hour",
    "0 */6 * * *": "Every 6 hours",
    "0 */12 * * *": "Every 12 hours",
    "0 0 * * *": "Daily at midnight",
    "0 9 * * *": "Daily at 9 AM",
    "0 9 * * 1": "Every Monday at 9 AM",
    "0 9 * * 1-5": "Weekdays at 9 AM",
  };
  return presets[schedule] || schedule;
}

const SCHEDULE_PRESETS = [
  { label: "Every 5 min", value: "*/5 * * * *" },
  { label: "Every 15 min", value: "*/15 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Daily 9 AM", value: "0 9 * * *" },
  { label: "Weekdays 9 AM", value: "0 9 * * 1-5" },
  { label: "Weekly Mon", value: "0 9 * * 1" },
];

export default function WorkflowsSettingsClient() {
  const [jobs, setJobs] = useState<GatewayCronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gatewayUrl, setGatewayUrl] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSchedule, setNewSchedule] = useState("0 * * * *");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Per-job action state
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load gateway config
  useEffect(() => {
    async function loadGateway() {
      try {
        const res = await fetch("/api/gateway/connect");
        if (res.ok) {
          const data = await res.json();
          if (data.gateway) {
            setGatewayUrl(data.gateway.gateway_url);
            setAuthToken(data.gateway.auth_token);
          }
        }
      } catch {
        // ignore
      }
    }
    loadGateway();
  }, []);

  const fetchJobs = useCallback(async () => {
    if (!gatewayUrl || !authToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await listGatewayCronJobs(gatewayUrl, authToken);
    if (result.error) setError(result.error);
    setJobs(result.jobs);
    setLoading(false);
  }, [gatewayUrl, authToken]);

  useEffect(() => {
    if (gatewayUrl && authToken) fetchJobs();
  }, [fetchJobs, gatewayUrl, authToken]);

  async function handleToggle(job: GatewayCronJob) {
    if (!gatewayUrl || !authToken) return;
    setTogglingId(job.id);
    const result = await toggleGatewayCronJob(gatewayUrl, authToken, job.id, !job.enabled);
    if (result.ok) {
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, enabled: !j.enabled } : j));
    }
    setTogglingId(null);
  }

  async function handleDelete(jobId: string) {
    if (!gatewayUrl || !authToken) return;
    if (!window.confirm("Delete this cron job?")) return;
    setDeletingId(jobId);
    const result = await deleteGatewayCronJob(gatewayUrl, authToken, jobId);
    if (result.ok) {
      setJobs(prev => prev.filter(j => j.id !== jobId));
    }
    setDeletingId(null);
  }

  async function handleCreate() {
    if (!gatewayUrl || !authToken) return;
    if (!newName.trim()) { setCreateError("Name is required"); return; }
    if (!newSchedule.trim()) { setCreateError("Schedule is required"); return; }
    setCreating(true);
    setCreateError(null);
    const result = await createGatewayCronJob(gatewayUrl, authToken, {
      name: newName.trim(),
      schedule: newSchedule.trim(),
      description: newDescription.trim() || undefined,
      enabled: true,
    });
    if (result.error) {
      setCreateError(result.error);
    } else {
      setShowCreate(false);
      setNewName("");
      setNewSchedule("0 * * * *");
      setNewDescription("");
      await fetchJobs();
    }
    setCreating(false);
  }

  const noGateway = !gatewayUrl || !authToken;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-header text-3xl font-bold tracking-tight leading-tight">Workflows</h1>
        <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mt-1">
          Scheduled cron jobs via your gateway
        </p>
      </div>

      {noGateway && (
        <Card label="No Gateway Connected" accentColor="#F4D35E" bordered={false}>
          <div className="mt-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#F4D35E]" />
            <p className="font-mono text-[11px] text-grid/60">
              Connect a gateway in{" "}
              <a href="/settings" className="underline text-forest">Settings</a> to manage cron jobs.
            </p>
          </div>
        </Card>
      )}

      {!noGateway && (
        <>
          {/* Header row */}
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
              {jobs.length} job{jobs.length !== 1 ? "s" : ""}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={fetchJobs} disabled={loading}>
                <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button variant="solid" size="sm" onClick={() => setShowCreate(v => !v)}>
                <Plus className="w-3 h-3 mr-1" />
                New Job
              </Button>
            </div>
          </div>

          {/* Create form */}
          {showCreate && (
            <Card label="New Cron Job" accentColor="#9EFFBF" bordered={false} className="mb-4">
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Job Name"
                    placeholder="e.g. Daily digest"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                  />
                  <div>
                    <Input
                      label="Cron Schedule"
                      placeholder="0 * * * *"
                      value={newSchedule}
                      onChange={e => setNewSchedule(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-1 mt-1">
                      {SCHEDULE_PRESETS.map(p => (
                        <button
                          key={p.value}
                          onClick={() => setNewSchedule(p.value)}
                          className={`font-mono text-[9px] uppercase tracking-wide px-2 py-0.5 border transition-colors ${
                            newSchedule === p.value
                              ? "border-forest bg-forest/10 text-forest"
                              : "border-[rgba(58,58,56,0.2)] text-grid/50 hover:border-forest/50"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <Input
                  label="Description (optional)"
                  placeholder="What does this job do?"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                />
                {createError && (
                  <p className="font-mono text-[10px] text-coral">{createError}</p>
                )}
                <div className="flex gap-2">
                  <Button variant="solid" size="sm" onClick={handleCreate} disabled={creating}>
                    {creating ? "Creating..." : "Create Job"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setShowCreate(false); setCreateError(null); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 border border-coral bg-coral/10 mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-coral flex-shrink-0" />
              <span className="font-mono text-[11px] text-coral">{error}</span>
            </div>
          )}

          {/* Jobs list */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-forest/5 animate-pulse" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <Card label="No Jobs Yet" accentColor="#9EFFBF" bordered={false}>
              <div className="mt-2 flex items-center gap-3">
                <Clock className="w-5 h-5 text-grid/30" />
                <p className="font-mono text-[11px] text-grid/50">
                  No cron jobs yet. Create one above or ask your agent to schedule something.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-px bg-[rgba(58,58,56,0.1)]">
              {jobs.map(job => (
                <div
                  key={job.id}
                  className="bg-white p-4 flex items-start gap-3"
                >
                  <Clock className="w-4 h-4 text-grid/40 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-header text-sm font-bold text-forest truncate">{job.name}</span>
                      <Badge status={job.enabled ? "active" : "error"}>
                        {job.enabled ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    <div className="font-mono text-[10px] text-grid/50 mt-0.5">
                      <span className="bg-forest/5 px-1.5 py-0.5 border border-forest/10">{job.schedule}</span>
                      <span className="ml-2 text-grid/40">{parseCronHuman(job.schedule)}</span>
                    </div>
                    {job.description && (
                      <p className="font-mono text-[10px] text-grid/50 mt-1">{job.description}</p>
                    )}
                    {(job.lastRun || job.nextRun) && (
                      <div className="flex gap-3 mt-1">
                        {job.lastRun && (
                          <span className="font-mono text-[9px] text-grid/40">
                            Last: {new Date(job.lastRun).toLocaleString()}
                          </span>
                        )}
                        {job.nextRun && (
                          <span className="font-mono text-[9px] text-grid/40">
                            Next: {new Date(job.nextRun).toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(job)}
                      disabled={togglingId === job.id}
                      title={job.enabled ? "Pause" : "Resume"}
                      className="p-1.5 hover:bg-forest/5 transition-colors disabled:opacity-50"
                    >
                      {job.enabled
                        ? <ToggleRight className="w-4 h-4 text-forest" />
                        : <ToggleLeft className="w-4 h-4 text-grid/40" />
                      }
                    </button>
                    <button
                      onClick={() => handleDelete(job.id)}
                      disabled={deletingId === job.id}
                      title="Delete"
                      className="p-1.5 hover:bg-coral/10 transition-colors disabled:opacity-50 text-grid/40 hover:text-coral"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
