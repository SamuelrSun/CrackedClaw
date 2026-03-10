'use client';

import { useState, useMemo, useRef } from 'react';

// ─── Category config ────────────────────────────────────────────────────────

const CATEGORIES = {
  personal:   { label: 'Personal',    icon: '🧑', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  preference: { label: 'Preference',  icon: '⚙️',  color: 'bg-purple-100 text-purple-700 border-purple-200' },
  project:    { label: 'Project',     icon: '📋', color: 'bg-green-100 text-green-700 border-green-200' },
  contact:    { label: 'Contact',     icon: '👤', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  fact:       { label: 'Fact',        icon: '📌', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  schedule:   { label: 'Schedule',    icon: '🗓', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  credential: { label: 'Credential',  icon: '🔑', color: 'bg-red-100 text-red-700 border-red-200' },
  context:    { label: 'Context',     icon: '🧠', color: 'bg-gray-100 text-gray-600 border-gray-200' },
} as const;

type Category = keyof typeof CATEGORIES;

const ALL_CATS = Object.keys(CATEGORIES) as Category[];

function catInfo(cat: string) {
  return (CATEGORIES as Record<string, { label: string; icon: string; color: string }>)[cat]
    ?? { label: cat, icon: '📌', color: 'bg-gray-100 text-gray-600 border-gray-200' };
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Memory {
  id: string;
  key: string;
  value: string;
  category: string;
  tags: string[];
  importance: number;
  source: string;
  created_at: string;
  updated_at: string;
}

type SortKey = 'category' | 'key' | 'value' | 'source' | 'updated_at';
type ViewMode = 'table' | 'grid';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return diffMin + 'm ago';
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return diffHr + 'h ago';
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return diffDays + 'd ago';
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return '1mo ago';
  return diffMonths + 'mo ago';
}

// ─── Category Badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string }) {
  const info = catInfo(category);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-medium border ${info.color} whitespace-nowrap`}>
      <span>{info.icon}</span>
      <span>{info.label}</span>
    </span>
  );
}

// ─── Sort indicator ───────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span className="text-gray-300 ml-1">↕</span>;
  return <span className="text-[#1A3C2B] ml-1">{dir === 'asc' ? '↑' : '↓'}</span>;
}

// ─── Inline editable value ───────────────────────────────────────────────────

function InlineValue({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const taRef = useRef<HTMLTextAreaElement>(null);

  function startEdit() {
    setDraft(value);
    setEditing(true);
    setTimeout(() => taRef.current?.focus(), 0);
  }

  function commit() {
    setEditing(false);
    if (draft.trim() !== value) onSave(draft.trim());
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { setEditing(false); setDraft(value); }
  }

  if (editing) {
    return (
      <textarea
        ref={taRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
        rows={2}
        className="w-full text-sm text-[#1A3C2B] bg-[#F5F3EF] border border-[#1A3C2B]/30 rounded px-2 py-1 resize-none outline-none focus:border-[#1A3C2B]"
      />
    );
  }

  return (
    <span
      onClick={startEdit}
      className="text-sm text-[rgba(58,58,56,0.85)] cursor-text hover:bg-[#F5F3EF] rounded px-1 -ml-1 block truncate max-w-xs"
      title={value}
    >
      {value || <span className="italic text-gray-400">—</span>}
    </span>
  );
}

// ─── Table Row ───────────────────────────────────────────────────────────────

function TableRow({
  memory,
  onDelete,
  onEdit,
}: {
  memory: Memory;
  onDelete: (id: string) => void;
  onEdit: (id: string, value: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <tr
      className={`border-b border-[rgba(58,58,56,0.08)] transition-colors group ${hovered ? 'bg-[#F5F3EF]' : 'bg-white'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <td className="px-4 py-3 w-36">
        <CategoryBadge category={memory.category} />
      </td>
      <td className="px-4 py-3 w-48">
        <span className="font-mono text-sm font-semibold text-[#1A3C2B] block truncate" title={memory.key}>
          {memory.key}
        </span>
      </td>
      <td className="px-4 py-3">
        <InlineValue value={memory.value} onSave={(v) => onEdit(memory.id, v)} />
      </td>
      <td className="px-4 py-3 w-28">
        <span className="font-mono text-xs text-[rgba(58,58,56,0.45)] uppercase tracking-wide">
          {memory.source || '—'}
        </span>
      </td>
      <td className="px-4 py-3 w-28">
        <span className="font-mono text-xs text-[rgba(58,58,56,0.45)]">
          {relativeTime(memory.updated_at)}
        </span>
      </td>
      <td className="px-3 py-3 w-10 text-right">
        <button
          onClick={() => {
            if (window.confirm('Delete "' + memory.key + '"?')) onDelete(memory.id);
          }}
          className={`text-gray-300 hover:text-red-500 transition-colors ${hovered ? 'opacity-100' : 'opacity-0'}`}
          title="Delete"
        >
          🗑
        </button>
      </td>
    </tr>
  );
}

// ─── Grid Card ───────────────────────────────────────────────────────────────

function MemoryGridCard({
  memory,
  onDelete,
  onEdit,
}: {
  memory: Memory;
  onDelete: (id: string) => void;
  onEdit: (id: string, value: string) => void;
}) {
  return (
    <div className="bg-white border border-[rgba(58,58,56,0.12)] rounded-lg p-4 flex flex-col gap-2 group hover:border-[rgba(58,58,56,0.25)] transition-colors relative">
      <button
        onClick={() => {
          if (window.confirm('Delete "' + memory.key + '"?')) onDelete(memory.id);
        }}
        className="absolute top-3 right-3 text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-sm"
        title="Delete"
      >
        🗑
      </button>
      <span className="font-mono text-sm font-bold text-[#1A3C2B] pr-6 truncate" title={memory.key}>
        {memory.key}
      </span>
      <div className="flex-1">
        <InlineValue value={memory.value} onSave={(v) => onEdit(memory.id, v)} />
      </div>
      <div className="flex items-center justify-between mt-1 pt-2 border-t border-[rgba(58,58,56,0.08)]">
        <span className="font-mono text-[10px] text-[rgba(58,58,56,0.4)] uppercase tracking-wide">
          {memory.source || 'unknown'}
        </span>
        <span className="font-mono text-[10px] text-[rgba(58,58,56,0.4)]">
          {relativeTime(memory.updated_at)}
        </span>
      </div>
    </div>
  );
}

// ─── Add Memory Form ─────────────────────────────────────────────────────────

function AddMemoryForm({
  onAdd,
  onCancel,
}: {
  onAdd: (key: string, value: string, category: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [category, setCategory] = useState<string>('fact');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!key.trim() || !value.trim()) return;
    setSaving(true);
    await onAdd(key.trim(), value.trim(), category);
    setSaving(false);
  }

  return (
    <div className="border border-dashed border-[#1A3C2B]/30 rounded-lg bg-white p-4 mb-4">
      <p className="font-mono text-xs uppercase tracking-wider text-[rgba(58,58,56,0.4)] mb-3">New Memory</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          autoFocus
          type="text"
          placeholder="Key (e.g. startup_name)"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="flex-1 border border-[rgba(58,58,56,0.2)] rounded px-3 py-1.5 text-sm font-mono text-[#1A3C2B] bg-[#F5F3EF] outline-none focus:border-[#1A3C2B]"
        />
        <input
          type="text"
          placeholder="Value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="flex-[2] border border-[rgba(58,58,56,0.2)] rounded px-3 py-1.5 text-sm text-[#1A3C2B] bg-[#F5F3EF] outline-none focus:border-[#1A3C2B]"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border border-[rgba(58,58,56,0.2)] rounded px-3 py-1.5 text-sm font-mono text-[#1A3C2B] bg-[#F5F3EF] outline-none focus:border-[#1A3C2B]"
        >
          {ALL_CATS.map((c) => (
            <option key={c} value={c}>{catInfo(c).icon} {catInfo(c).label}</option>
          ))}
        </select>
        <button
          onClick={submit}
          disabled={saving || !key.trim() || !value.trim()}
          className="bg-[#1A3C2B] text-white px-4 py-1.5 text-sm font-mono rounded hover:bg-[#2a5c3e] disabled:opacity-40 whitespace-nowrap"
        >
          {saving ? 'Saving…' : 'Add'}
        </button>
        <button
          onClick={onCancel}
          className="border border-[rgba(58,58,56,0.2)] text-[rgba(58,58,56,0.6)] px-3 py-1.5 text-sm font-mono rounded hover:bg-[rgba(58,58,56,0.05)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main Client Component ────────────────────────────────────────────────────

export function MemoryClient({ initialMemories }: { initialMemories: Memory[] }) {
  const [memories, setMemories] = useState<Memory[]>(initialMemories);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [view, setView] = useState<ViewMode>('table');
  const [showAdd, setShowAdd] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('updated_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: memories.length };
    for (const cat of ALL_CATS) counts[cat] = memories.filter((m) => m.category === cat).length;
    return counts;
  }, [memories]);

  const presentCategories = ALL_CATS.filter((c) => (categoryCounts[c] ?? 0) > 0);

  const filtered = useMemo(() => {
    let list = memories.filter((m) => {
      const q = search.toLowerCase();
      const matchSearch = !q || m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q);
      const matchCat = activeCategory === 'all' || m.category === activeCategory;
      return matchSearch && matchCat;
    });

    list = [...list].sort((a, b) => {
      let av: string = String(a[sortKey as keyof Memory] ?? '');
      let bv: string = String(b[sortKey as keyof Memory] ?? '');
      if (sortKey === 'updated_at') {
        av = String(new Date(av).getTime()).padStart(20, '0');
        bv = String(new Date(bv).getTime()).padStart(20, '0');
      }
      const cmp = av.localeCompare(bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [memories, search, activeCategory, sortKey, sortDir]);

  const grouped = useMemo(() => {
    const groups: Record<string, Memory[]> = {};
    for (const m of filtered) {
      if (!groups[m.category]) groups[m.category] = [];
      groups[m.category].push(m);
    }
    return groups;
  }, [filtered]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  async function handleDelete(id: string) {
    await fetch('/api/memory', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleEdit(id: string, value: string) {
    await fetch('/api/memory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, value }),
    });
    setMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, value, updated_at: new Date().toISOString() } : m))
    );
  }

  async function handleAdd(key: string, value: string, category: string) {
    const res = await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value, category }),
    });
    if (res.ok) {
      const data = await res.json();
      const now = new Date().toISOString();
      setMemories((prev) => [
        {
          id: data.id || String(Date.now()),
          key,
          value,
          category,
          tags: [],
          importance: 3,
          source: 'manual',
          created_at: now,
          updated_at: now,
        },
        ...prev,
      ]);
      setShowAdd(false);
    }
  }

  async function handleScan() {
    setScanning(true);
    setScanMsg(null);
    try {
      const res = await fetch('/api/memory/scan', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setScanMsg({ type: 'ok', text: 'Found ' + (data.count ?? 0) + ' memories from your Google account' });
        const r2 = await fetch('/api/memory');
        if (r2.ok) {
          const d2 = await r2.json();
          if (Array.isArray(d2.memories)) setMemories(d2.memories);
        }
      } else {
        setScanMsg({ type: 'err', text: data.error || 'Scan failed' });
      }
    } catch {
      setScanMsg({ type: 'err', text: 'Failed to connect' });
    }
    setScanning(false);
  }

  function Th({ label, sk, className = '' }: { label: string; sk: SortKey; className?: string }) {
    return (
      <th
        className={`px-4 py-3 text-left font-mono text-xs uppercase tracking-wider text-[rgba(58,58,56,0.45)] cursor-pointer select-none hover:text-[#1A3C2B] transition-colors ${className}`}
        onClick={() => toggleSort(sk)}
      >
        {label}
        <SortIcon active={sortKey === sk} dir={sortDir} />
      </th>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F3EF] text-[#1A3C2B]">
      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* Page header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-header text-4xl font-bold tracking-tight text-[#1A3C2B] mb-1">Memory</h1>
            <p className="text-sm text-[rgba(58,58,56,0.5)]">
              Everything I know about you — collected from our conversations.
            </p>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap justify-end">
            {/* View toggle */}
            <div className="flex border border-[rgba(58,58,56,0.18)] rounded overflow-hidden">
              <button
                onClick={() => setView('table')}
                title="Table view"
                className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                  view === 'table'
                    ? 'bg-[#1A3C2B] text-white'
                    : 'text-[rgba(58,58,56,0.5)] hover:bg-[rgba(58,58,56,0.06)]'
                }`}
              >
                ≡ Table
              </button>
              <button
                onClick={() => setView('grid')}
                title="Grid view"
                className={`px-3 py-1.5 text-xs font-mono border-l border-[rgba(58,58,56,0.18)] transition-colors ${
                  view === 'grid'
                    ? 'bg-[#1A3C2B] text-white'
                    : 'text-[rgba(58,58,56,0.5)] hover:bg-[rgba(58,58,56,0.06)]'
                }`}
              >
                ⊞ Grid
              </button>
            </div>

            <button
              onClick={() => setShowAdd((v) => !v)}
              className="bg-[#1A3C2B] text-white px-4 py-1.5 text-sm font-mono rounded hover:bg-[#2a5c3e] transition-colors"
            >
              + Add Memory
            </button>

            <button
              onClick={handleScan}
              disabled={scanning}
              className="border border-[rgba(58,58,56,0.2)] text-[#1A3C2B] px-3 py-1.5 text-sm font-mono rounded hover:bg-[rgba(58,58,56,0.05)] disabled:opacity-40 transition-colors"
            >
              {scanning ? 'Scanning…' : 'Scan Google'}
            </button>
          </div>
        </div>

        {/* Scan banner */}
        {scanMsg && (
          <div className={`mb-4 px-4 py-3 rounded-lg flex items-center justify-between text-sm font-mono ${
            scanMsg.type === 'ok'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-600'
          }`}>
            <span>{scanMsg.text}</span>
            <button onClick={() => setScanMsg(null)} className="opacity-50 hover:opacity-100 ml-4">✕</button>
          </div>
        )}

        {/* Add form */}
        {showAdd && (
          <AddMemoryForm onAdd={handleAdd} onCancel={() => setShowAdd(false)} />
        )}

        {/* Search */}
        <div className="relative mb-4">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgba(58,58,56,0.35)] pointer-events-none">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by key or value…"
            className="w-full bg-white border border-[rgba(58,58,56,0.15)] rounded-lg pl-10 pr-4 py-2 text-sm font-mono text-[#1A3C2B] placeholder:text-[rgba(58,58,56,0.3)] outline-none focus:border-[#1A3C2B]/40 transition-colors"
          />
        </div>

        {/* Category filter pills */}
        <div className="flex gap-2 flex-wrap mb-6">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1 rounded-full text-xs font-mono border transition-colors ${
              activeCategory === 'all'
                ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                : 'border-[rgba(58,58,56,0.18)] text-[rgba(58,58,56,0.6)] hover:border-[#1A3C2B]/40 hover:text-[#1A3C2B]'
            }`}
          >
            All {categoryCounts.all}
          </button>
          {presentCategories.map((cat) => {
            const info = catInfo(cat);
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-mono border transition-colors ${
                  activeCategory === cat
                    ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                    : 'border-[rgba(58,58,56,0.18)] text-[rgba(58,58,56,0.6)] hover:border-[#1A3C2B]/40 hover:text-[#1A3C2B]'
                }`}
              >
                {info.icon} {info.label} {categoryCounts[cat]}
              </button>
            );
          })}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="py-24 text-center">
            <div className="text-5xl mb-4">🧠</div>
            {search || activeCategory !== 'all' ? (
              <>
                <p className="font-mono text-sm text-[rgba(58,58,56,0.5)] mb-2">No memories match your filter.</p>
                <button
                  onClick={() => { setSearch(''); setActiveCategory('all'); }}
                  className="font-mono text-xs text-[#1A3C2B] underline underline-offset-2"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <p className="text-[rgba(58,58,56,0.55)] text-base mb-1">No memories yet.</p>
                <p className="font-mono text-sm text-[rgba(58,58,56,0.35)]">
                  Start chatting and I&apos;ll remember the important stuff.
                </p>
              </>
            )}
          </div>
        )}

        {/* TABLE VIEW */}
        {view === 'table' && filtered.length > 0 && (
          <div className="rounded-xl border border-[rgba(58,58,56,0.12)] overflow-hidden bg-white">
            <table className="w-full border-collapse">
              <thead className="border-b border-[rgba(58,58,56,0.1)] bg-[#F5F3EF]">
                <tr>
                  <Th label="Category" sk="category" className="w-36" />
                  <Th label="Key" sk="key" className="w-48" />
                  <Th label="Value" sk="value" />
                  <Th label="Source" sk="source" className="w-28" />
                  <Th label="Updated" sk="updated_at" className="w-28" />
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <TableRow
                    key={m.id}
                    memory={m}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* GRID VIEW */}
        {view === 'grid' && filtered.length > 0 && (
          <div className="space-y-8">
            {Object.entries(grouped).map(([cat, items]) => {
              const info = catInfo(cat);
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{info.icon}</span>
                    <span className="font-mono text-sm font-semibold text-[#1A3C2B]">{info.label}</span>
                    <span className="font-mono text-xs text-[rgba(58,58,56,0.4)]">({items.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map((m) => (
                      <MemoryGridCard
                        key={m.id}
                        memory={m}
                        onDelete={handleDelete}
                        onEdit={handleEdit}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer count */}
        {filtered.length > 0 && (
          <p className="font-mono text-xs text-[rgba(58,58,56,0.3)] text-right mt-6">
            {filtered.length} {filtered.length === 1 ? 'memory' : 'memories'}
          </p>
        )}
      </div>
    </div>
  );
}
