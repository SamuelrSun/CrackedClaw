"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, Plus, Users, Check, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
  openclaw_status: string;
  openclaw_gateway_url: string | null;
  openclaw_instance_id: string | null;
  created_at: string;
}

const ACTIVE_WORKSPACE_KEY = "crackedclaw_active_workspace_id";

export function getActiveWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_WORKSPACE_KEY);
}

export function setActiveWorkspaceId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
}

function isRunning(ws: Workspace) {
  return (
    ws.openclaw_status === "running" ||
    ws.openclaw_status === "connected" ||
    (!!ws.openclaw_gateway_url && !!ws.openclaw_instance_id)
  );
}

export function WorkspaceSwitcher() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/organizations/list");
      if (!res.ok) return;
      const data = await res.json();
      const orgs: Workspace[] = data.organizations || [];
      setWorkspaces(orgs);

      // Determine active workspace
      const storedId = getActiveWorkspaceId();
      if (storedId && orgs.some((o) => o.id === storedId)) {
        setActiveId(storedId);
      } else if (orgs.length > 0) {
        setActiveId(orgs[0].id);
        setActiveWorkspaceId(orgs[0].id);
      }
    } catch (e) {
      console.error("Failed to fetch workspaces:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const activeWorkspace = workspaces.find((w) => w.id === activeId);

  function switchWorkspace(ws: Workspace) {
    setActiveWorkspaceId(ws.id);
    setActiveId(ws.id);
    setIsOpen(false);
    // Reload to use the new workspace's gateway
    window.location.reload();
  }

  async function handleCreateWorkspace() {
    if (!newWorkspaceName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/organizations/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_name: newWorkspaceName.trim(),
          force_new: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCreateError(data.error || "Failed to create workspace");
        return;
      }
      // Switch to new workspace
      setActiveWorkspaceId(data.organization_id);
      setActiveId(data.organization_id);
      setCreateModalOpen(false);
      setNewWorkspaceName("");
      // Reload to pick up the new workspace
      window.location.reload();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 py-1">
        <div className="w-6 h-6 bg-forest/10 animate-pulse rounded-none" />
        <div className="w-24 h-3 bg-forest/10 animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen((v) => !v)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 transition-colors hover:bg-forest/5 group",
            isOpen && "bg-forest/5"
          )}
        >
          {/* Workspace icon */}
          <div className="w-7 h-7 bg-forest rounded-none flex items-center justify-center flex-shrink-0">
            <span className="text-white font-header text-xs font-bold">
              {activeWorkspace ? activeWorkspace.name.slice(0, 2).toUpperCase() : "CC"}
            </span>
          </div>
          <div className="flex flex-col items-start min-w-0">
            <span className="font-header text-sm font-bold tracking-tight text-forest leading-tight truncate max-w-[120px]">
              {activeWorkspace?.name || "CrackedClaw"}
            </span>
            {activeWorkspace && (
              <span className="font-mono text-[9px] uppercase tracking-wide text-grid/40 leading-tight">
                {isRunning(activeWorkspace) ? "● running" : "○ offline"}
              </span>
            )}
          </div>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-grid/40 group-hover:text-forest transition-transform flex-shrink-0",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen && (
          <div className="absolute left-0 top-full mt-1 w-64 bg-paper border border-[rgba(58,58,56,0.2)] shadow-lg z-50">
            {/* Header */}
            <div className="px-3 py-2 border-b border-[rgba(58,58,56,0.1)]">
              <span className="font-mono text-[9px] uppercase tracking-wider text-grid/40">
                Workspaces
              </span>
            </div>

            {/* Workspace list */}
            <div className="max-h-64 overflow-y-auto">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => switchWorkspace(ws)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 hover:bg-forest/5 transition-colors text-left",
                    ws.id === activeId && "bg-forest/5"
                  )}
                >
                  {/* Mini icon */}
                  <div className="w-7 h-7 bg-forest/10 rounded-none flex items-center justify-center flex-shrink-0">
                    <span className="text-forest font-header text-xs font-bold">
                      {ws.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex flex-col items-start min-w-0 flex-1">
                    <span className="font-header text-sm font-semibold text-forest truncate w-full">
                      {ws.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          isRunning(ws) ? "bg-mint" : "bg-grid/30"
                        )}
                      />
                      <span className="font-mono text-[9px] uppercase tracking-wide text-grid/40">
                        {isRunning(ws) ? "running" : "offline"}
                      </span>
                    </div>
                  </div>

                  {ws.id === activeId && (
                    <Check className="w-3.5 h-3.5 text-forest flex-shrink-0" />
                  )}
                </button>
              ))}

              {workspaces.length === 0 && (
                <div className="px-3 py-4 text-center">
                  <span className="font-mono text-[10px] text-grid/40">No workspaces yet</span>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="border-t border-[rgba(58,58,56,0.1)]">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setCreateModalOpen(true);
                  setCreateError(null);
                  setNewWorkspaceName("");
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-forest/5 transition-colors text-left"
              >
                <Plus className="w-4 h-4 text-forest" />
                <span className="font-mono text-[10px] uppercase tracking-wide text-forest">
                  Create New Workspace
                </span>
              </button>
              <button
                disabled
                className="w-full flex items-center gap-2 px-3 py-2.5 opacity-40 cursor-not-allowed text-left"
                title="Coming soon"
              >
                <Users className="w-4 h-4 text-grid/50" />
                <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
                  Join Workspace
                </span>
                <span className="ml-auto font-mono text-[8px] uppercase tracking-wide text-grid/30 border border-grid/20 px-1">
                  soon
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Workspace Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => !creating && setCreateModalOpen(false)}
        title="Create New Workspace"
      >
        <div className="space-y-4">
          <p className="font-mono text-xs text-grid/60">
            A new OpenClaw instance will be provisioned for this workspace.
          </p>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wide text-grid/60 mb-1.5">
              Workspace Name
            </label>
            <input
              type="text"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !creating && handleCreateWorkspace()}
              placeholder="e.g. My Team, Project Alpha..."
              disabled={creating}
              className={cn(
                "w-full px-3 py-2 font-mono text-sm bg-paper border border-[rgba(58,58,56,0.2)]",
                "focus:outline-none focus:border-forest transition-colors",
                "placeholder:text-grid/30 disabled:opacity-50"
              )}
              autoFocus
            />
          </div>

          {createError && (
            <p className="font-mono text-xs text-red-500">{createError}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setCreateModalOpen(false)}
              disabled={creating}
              className="flex-1 px-4 py-2 font-mono text-[10px] uppercase tracking-wide border border-[rgba(58,58,56,0.2)] text-grid/60 hover:border-forest hover:text-forest transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateWorkspace}
              disabled={creating || !newWorkspaceName.trim()}
              className={cn(
                "flex-1 px-4 py-2 font-mono text-[10px] uppercase tracking-wide",
                "bg-forest text-white hover:bg-forest/90 transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "flex items-center justify-center gap-2"
              )}
            >
              {creating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Provisioning...
                </>
              ) : (
                "Create Workspace"
              )}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
