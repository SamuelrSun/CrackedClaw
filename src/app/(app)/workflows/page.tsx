"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface Workflow {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'pending';
  trigger_type: 'manual' | 'scheduled' | 'webhook';
  icon?: string;
  last_run?: string;
  schedule?: { human_readable?: string };
  metadata?: {
    steps?: Array<{ id: string; description: string; integrationSlug?: string }>;
    requiredIntegrations?: string[];
    estimatedDuration?: string;
  };
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdWorkflow, setCreatedWorkflow] = useState<Workflow | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/workflows')
      .then(r => r.json())
      .then(d => setWorkflows(d.workflows || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const createFromPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || creating) return;
    setCreating(true);
    setCreatedWorkflow(null);
    try {
      const res = await fetch('/api/workflows/create-from-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.workflow) {
        setCreatedWorkflow(data.workflow);
        setWorkflows(prev => [data.workflow, ...prev]);
        setPrompt("");
      }
    } finally {
      setCreating(false);
    }
  };

  const runWorkflow = async (id: string) => {
    setRunningId(id);
    try {
      await fetch(`/api/workflows/${id}/run`, { method: 'POST' });
      // Update last_run in UI
      setWorkflows(prev => prev.map(w => w.id === id ? { ...w, last_run: 'Just now' } : w));
    } finally {
      setRunningId(null);
    }
  };

  const activateWorkflow = async (id: string) => {
    try {
      await fetch(`/api/workflows/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      setWorkflows(prev => prev.map(w => w.id === id ? { ...w, status: 'active' } : w));
      setCreatedWorkflow(null);
    } catch {}
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-header text-3xl font-bold tracking-tight mb-1">Workflows</h1>
          <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
            Automate anything — just describe it
          </p>
        </div>
        <Link href="/workflows/builder">
          <button className="px-4 py-2 font-mono text-[10px] uppercase tracking-wide bg-white/[0.12] text-white hover:bg-white/[0.12]/80 transition-colors flex items-center gap-2">
            <span>✨</span> Create with AI
          </button>
        </Link>
      </div>

      {/* Prompt-driven creation */}
      <form onSubmit={createFromPrompt} className="mb-6">
        <div className="border border-white/[0.12] bg-paper p-4">
          <p className="font-mono text-[10px] uppercase tracking-wide text-grid/40 mb-2">Create a workflow</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder='Describe what to automate... e.g. "Every morning, check Gmail for urgent emails, summarize them, post to #standup on Slack"'
              className="flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-grid/30 text-grid border-b border-white/[0.08] pb-2"
            />
            <button
              type="submit"
              disabled={creating || !prompt.trim()}
              className="px-4 py-1.5 font-mono text-[10px] uppercase tracking-wide bg-grid text-paper hover:bg-grid/80 transition-colors disabled:opacity-40 self-end"
            >
              {creating ? "Building..." : "Create →"}
            </button>
          </div>
          <p className="font-mono text-[9px] text-grid/30 mt-2">
            Describe triggers (every morning, on webhook, manually), actions, and which integrations to use
          </p>
        </div>
      </form>

      {/* Just-created workflow card */}
      {createdWorkflow && (
        <div className="mb-6 border border-forest/30 bg-forest/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span>✨</span>
            <p className="font-mono text-[10px] uppercase tracking-wide text-forest">Workflow created!</p>
          </div>
          <p className="font-header font-bold text-lg mb-1">{createdWorkflow.name}</p>
          <p className="font-mono text-[11px] text-grid/60 mb-3">{createdWorkflow.description}</p>
          <div className="flex gap-2">
            <button
              onClick={() => activateWorkflow(createdWorkflow.id)}
              className="px-4 py-1.5 font-mono text-[10px] uppercase tracking-wide bg-forest text-white hover:bg-forest/80 transition-colors"
            >
              Activate
            </button>
            <Link href={`/workflows/${createdWorkflow.id}`}>
              <button className="px-4 py-1.5 font-mono text-[10px] uppercase tracking-wide border border-grid/30 hover:bg-grid/5 transition-colors">
                Edit / Refine
              </button>
            </Link>
          </div>
        </div>
      )}

      {/* Workflows list */}
      {loading ? (
        <p className="font-mono text-xs text-grid/40">Loading workflows...</p>
      ) : workflows.length === 0 ? (
        <div className="border border-white/[0.1] bg-paper p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 border border-white/[0.1] flex items-center justify-center">
            <span className="text-2xl">⚡</span>
          </div>
          <h2 className="font-header text-xl font-bold mb-2">No workflows yet</h2>
          <p className="text-sm text-grid/50 max-w-md mx-auto">
            Describe what you want automated above — like &quot;every morning check my email and summarize urgent ones.&quot;
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {workflows.map(workflow => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              onRun={runWorkflow}
              isRunning={runningId === workflow.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowCard({ workflow, onRun, isRunning }: { workflow: Workflow; onRun: (id: string) => void; isRunning: boolean }) {
  const steps = workflow.metadata?.steps || [];
  const integrations = workflow.metadata?.requiredIntegrations || [];

  return (
    <div className={`border p-4 transition-colors ${workflow.status === 'active' ? 'border-forest/30 bg-forest/5' : 'border-white/[0.1] bg-paper'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{workflow.icon || '⚡'}</span>
          <div>
            <Link href={`/workflows/${workflow.id}`} className="font-header font-bold text-sm hover:underline">{workflow.name}</Link>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge status={workflow.status === 'active' ? 'active' : 'inactive'}>
                {workflow.status}
              </Badge>
              <span className="font-mono text-[9px] text-grid/40 uppercase">
                {workflow.trigger_type}{workflow.schedule?.human_readable ? ` · ${workflow.schedule.human_readable}` : ''}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => onRun(workflow.id)}
          disabled={isRunning}
          className="px-3 py-1 font-mono text-[10px] uppercase tracking-wide border border-grid/30 hover:bg-grid hover:text-paper transition-colors disabled:opacity-50"
        >
          {isRunning ? '▶ Running...' : '▶ Run'}
        </button>
      </div>
      <p className="font-mono text-[10px] text-grid/50 mb-3">{workflow.description}</p>
      
      {/* Steps preview */}
      {steps.length > 0 && (
        <div className="flex items-center gap-1 mb-2 overflow-x-auto">
          {steps.slice(0, 4).map((step, i) => (
            <div key={step.id} className="flex items-center gap-1 flex-shrink-0">
              <span className="font-mono text-[9px] bg-grid/5 px-2 py-0.5 border border-white/[0.08] text-grid/60 max-w-[120px] truncate">
                {step.description.slice(0, 30)}
              </span>
              {i < steps.length - 1 && i < 3 && <span className="text-grid/30">→</span>}
            </div>
          ))}
          {steps.length > 4 && <span className="font-mono text-[9px] text-grid/40">+{steps.length - 4} more</span>}
        </div>
      )}

      {/* Integrations */}
      {integrations.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {integrations.map(slug => (
            <span key={slug} className="font-mono text-[8px] uppercase bg-grid/5 px-2 py-0.5 border border-white/[0.08] text-grid/50">
              {slug}
            </span>
          ))}
        </div>
      )}

      {workflow.last_run && (
        <p className="font-mono text-[9px] text-grid/40 mt-2">Last run: {workflow.last_run}</p>
      )}
    </div>
  );
}
