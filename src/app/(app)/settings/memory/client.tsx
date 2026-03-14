"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Eye, EyeOff, Search, ChevronDown, ChevronRight, Brain, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type MemoryCategory = "credential" | "preference" | "project" | "contact" | "fact" | "context" | "schedule";
type MemorySource = "chat" | "scan" | "user_input";

interface MemoryEntry {
  id: string;
  user_id: string;
  key: string;
  value: string;
  category: MemoryCategory;
  tags: string[];
  importance: number;
  source: MemorySource;
  summary?: string;
  created_at: string;
  updated_at: string;
}

const CATEGORY_CONFIG: Record<MemoryCategory, { label: string; emoji: string; description: string }> = {
  credential: { label: "Credentials", emoji: "🔑", description: "API keys, tokens, and passwords" },
  preference: { label: "Preferences", emoji: "⚙️", description: "Your style and format preferences" },
  project:    { label: "Projects",    emoji: "🚀", description: "Active projects and startups" },
  contact:    { label: "Contacts",    emoji: "👥", description: "People you work with" },
  fact:       { label: "Facts",       emoji: "📌", description: "Key facts about you" },
  context:    { label: "Context",     emoji: "🧠", description: "Background and goals" },
  schedule:   { label: "Schedule",    emoji: "📅", description: "Time zones and calendar info" },
};

const CATEGORY_ORDER: MemoryCategory[] = ["credential", "preference", "project", "contact", "fact", "context", "schedule"];

function ImportanceDots({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5 items-center" title={`Importance: ${value}/5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i <= value ? "bg-grid/60" : "bg-grid/15"}`}
        />
      ))}
    </span>
  );
}

function SourceBadge({ source }: { source: MemorySource }) {
  const labels: Record<MemorySource, string> = { chat: "chat", scan: "scan", user_input: "manual" };
  return (
    <span className="font-mono text-[9px] uppercase tracking-wide text-grid/30 border border-grid/10 px-1 py-0.5">
      {labels[source] || source}
    </span>
  );
}

function MemoryCard({
  memory,
  onDelete,
  isCredential,
}: {
  memory: MemoryEntry;
  onDelete: (id: string) => void;
  isCredential: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`/api/memory/${memory.id}`, { method: "DELETE" });
      onDelete(memory.id);
    } finally {
      setDeleting(false);
    }
  };

  const displayValue = isCredential && !revealed
    ? "•".repeat(Math.min(memory.value.length, 20))
    : memory.value;

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 border border-white/[0.06] bg-paper hover:border-white/[0.1] transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono text-[11px] font-semibold text-grid/80 truncate">{memory.key}</span>
          <ImportanceDots value={memory.importance} />
        </div>
        <p className="font-mono text-[11px] text-grid/60 break-all leading-relaxed">
          {displayValue}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <SourceBadge source={memory.source} />
          <span className="font-mono text-[9px] text-grid/25">
            {new Date(memory.updated_at).toLocaleDateString()}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isCredential && (
          <button
            onClick={() => setRevealed(r => !r)}
            className="p-1 text-grid/40 hover:text-grid/70 transition-colors"
            title={revealed ? "Hide" : "Show"}
          >
            {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-1 text-grid/40 hover:text-red-500 transition-colors disabled:opacity-40"
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function CategorySection({
  category,
  memories,
  onDelete,
}: {
  category: MemoryCategory;
  memories: MemoryEntry[];
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const cfg = CATEGORY_CONFIG[category];
  const isCredential = category === "credential";

  return (
    <div className="border border-[rgba(58,58,56,0.12)]">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[rgba(58,58,56,0.02)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{cfg.emoji}</span>
          <span className="font-mono text-xs font-semibold uppercase tracking-wide text-grid/70">{cfg.label}</span>
          <span className="font-mono text-[10px] text-grid/30">({memories.length})</span>
        </div>
        {open ? <ChevronDown size={14} className="text-grid/40" /> : <ChevronRight size={14} className="text-grid/40" />}
      </button>
      {open && (
        <div className="border-t border-white/[0.06] divide-y divide-[rgba(58,58,56,0.05)]">
          {memories.length === 0 ? (
            <p className="px-4 py-3 font-mono text-[11px] text-grid/30">No {cfg.label.toLowerCase()} yet.</p>
          ) : (
            memories.map(m => (
              <MemoryCard key={m.id} memory={m} onDelete={onDelete} isCredential={isCredential} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AddMemoryForm({ onAdd }: { onAdd: (m: MemoryEntry) => void }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [category, setCategory] = useState<MemoryCategory>("fact");
  const [importance, setImportance] = useState(3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !value.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim(), value: value.trim(), category, importance, source: "user_input" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onAdd(data.memory || { id: data.id, key: key.trim(), value: value.trim(), category, importance, source: "user_input", tags: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      setKey(""); setValue(""); setCategory("fact"); setImportance(3);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 font-mono text-[11px] text-grid/50 hover:text-grid/80 transition-colors px-1"
      >
        <Plus size={12} /> Add memory manually
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-white/[0.1] p-4 space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50">Add Memory</p>
      {error && <p className="font-mono text-[11px] text-red-500">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-mono text-[10px] text-grid/40 uppercase tracking-wide block mb-1">Key</label>
          <Input value={key} onChange={e => setKey(e.target.value)} placeholder="e.g. user_name" className="font-mono text-xs h-8" required />
        </div>
        <div>
          <label className="font-mono text-[10px] text-grid/40 uppercase tracking-wide block mb-1">Value</label>
          <Input value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. Sam" className="font-mono text-xs h-8" required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-mono text-[10px] text-grid/40 uppercase tracking-wide block mb-1">Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value as MemoryCategory)}
            className="w-full border border-white/[0.1] bg-paper px-2 py-1.5 font-mono text-[11px] outline-none h-8"
          >
            {CATEGORY_ORDER.map(c => (
              <option key={c} value={c}>{CATEGORY_CONFIG[c].emoji} {CATEGORY_CONFIG[c].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-mono text-[10px] text-grid/40 uppercase tracking-wide block mb-1">
            Importance ({importance}/5)
          </label>
          <input
            type="range" min={1} max={5} value={importance}
            onChange={e => setImportance(Number(e.target.value))}
            className="w-full h-8"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving} size="sm" className="font-mono text-xs">
          {saving ? "Saving..." : "Save"}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="font-mono text-xs text-grid/40 hover:text-grid/60">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function MemorySettingsClient({ userId }: { userId: string }) {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  const loadMemories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/memory");
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMemories(); }, [loadMemories]);

  const handleDelete = (id: string) => {
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  const handleAdd = (m: MemoryEntry) => {
    setMemories(prev => [m, ...prev]);
  };

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/memory/scan", { method: "POST" });
      const data = await res.json();
      setScanResult(data.summary || data.message || "Scan complete");
      await loadMemories();
    } catch {
      setScanResult("Scan failed — check console");
    } finally {
      setScanning(false);
    }
  };

  const filtered = query
    ? memories.filter(m =>
        m.key.toLowerCase().includes(query.toLowerCase()) ||
        m.value.toLowerCase().includes(query.toLowerCase()) ||
        (m.summary || "").toLowerCase().includes(query.toLowerCase())
      )
    : memories;

  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = filtered.filter(m => m.category === cat);
    return acc;
  }, {} as Record<MemoryCategory, MemoryEntry[]>);

  const totalCount = memories.length;

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Link href="/settings" className="text-grid/40 hover:text-grid/70 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <Brain size={20} className="text-grid/60" />
        <h1 className="font-header text-3xl font-bold tracking-tight">Memory</h1>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mb-1 ml-9">
        {totalCount} {totalCount === 1 ? "memory" : "memories"} stored
      </p>
      <p className="font-mono text-[11px] text-grid/40 mb-6 ml-9 max-w-xl">
        Your AI remembers these things about you. Memories are injected into every conversation so the AI stays personalized. Use <code className="bg-grid/5 px-1">[[REMEMBER: key=value]]</code> in chat to save things.
      </p>

      {/* Actions */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-grid/30" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search memories..."
            className="font-mono text-xs pl-8 h-8"
          />
        </div>
        <Button
          onClick={handleScan}
          disabled={scanning}
          variant="ghost"
          size="sm"
          className="font-mono text-xs flex items-center gap-1.5"
        >
          <RefreshCw size={12} className={scanning ? "animate-spin" : ""} />
          {scanning ? "Scanning..." : "Scan integrations"}
        </Button>
      </div>

      {scanResult && (
        <div className="mb-4 px-3 py-2 border border-[rgba(58,58,56,0.12)] bg-[rgba(58,58,56,0.02)]">
          <p className="font-mono text-[11px] text-grid/60">{scanResult}</p>
        </div>
      )}

      {/* Memory list */}
      {loading ? (
        <p className="font-mono text-xs text-grid/40">Loading memories...</p>
      ) : totalCount === 0 ? (
        <Card className="p-8 text-center">
          <Brain size={32} className="mx-auto text-grid/20 mb-3" />
          <p className="font-mono text-sm text-grid/50 mb-1">No memories yet</p>
          <p className="font-mono text-[11px] text-grid/30 max-w-sm mx-auto">
            Start chatting — your AI will automatically save important things using <code>[[REMEMBER: key=value]]</code> markers.
          </p>
        </Card>
      ) : (
        <div className="space-y-2 mb-5">
          {CATEGORY_ORDER.map(cat => {
            const items = grouped[cat];
            if (items.length === 0 && query) return null;
            return (
              <CategorySection
                key={cat}
                category={cat}
                memories={items}
                onDelete={handleDelete}
              />
            );
          })}
          {filtered.length === 0 && query && (
            <p className="font-mono text-xs text-grid/40 text-center py-4">No memories match &quot;{query}&quot;</p>
          )}
        </div>
      )}

      {/* Add memory */}
      {!loading && (
        <AddMemoryForm onAdd={handleAdd} />
      )}
    </div>
  );
}
