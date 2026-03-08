'use client';

import { useState, useMemo } from 'react';

const CATEGORIES = {
  credential: { label: 'Credentials', icon: '🔑' },
  preference: { label: 'Preferences', icon: '⚙️' },
  project: { label: 'Projects', icon: '🚀' },
  contact: { label: 'Contacts', icon: '👤' },
  fact: { label: 'Facts', icon: '📌' },
  context: { label: 'Context', icon: '🧠' },
  schedule: { label: 'Schedule', icon: '📅' },
} as const;

type Category = keyof typeof CATEGORIES;

interface Memory {
  id: string;
  key: string;
  value: string;
  category: Category;
  tags: string[];
  importance: number;
  source: string;
  created_at: string;
  updated_at: string;
}

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return '1 month ago';
  return `${diffMonths} months ago`;
}

function ImportanceDots({ importance }: { importance: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`text-xs ${i <= importance ? 'text-[#1A3C2B]' : 'text-[rgba(58,58,56,0.2)]'}`}
        >
          ●
        </span>
      ))}
    </span>
  );
}

interface MemoryCardProps {
  memory: Memory;
  onDelete: (id: string) => void;
  onEdit: (id: string, value: string) => void;
}

function MemoryCard({ memory, onDelete, onEdit }: MemoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(memory.value);
  const [saving, setSaving] = useState(false);

  const cat = CATEGORIES[memory.category] ?? { label: memory.category, icon: '📌' };

  async function handleSave() {
    setSaving(true);
    await onEdit(memory.id, editValue);
    setEditing(false);
    setSaving(false);
  }

  async function handleDelete() {
    if (!window.confirm(`Delete memory "${memory.key}"?`)) return;
    onDelete(memory.id);
  }

  const isTruncatable = memory.value.length > 120;

  return (
    <div className="border border-[rgba(58,58,56,0.15)] bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Top row: key + category + importance */}
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <span className="font-mono text-sm font-bold text-[#1A3C2B] truncate">
              {memory.key}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 border border-current opacity-50 text-[#1A3C2B]">
              {cat.icon} {cat.label}
            </span>
            <ImportanceDots importance={memory.importance} />
          </div>

          {/* Value */}
          {editing ? (
            <div className="space-y-2">
              <textarea
                className="w-full border border-[rgba(58,58,56,0.3)] px-3 py-2 text-sm font-body text-[#1A3C2B] outline-none focus:border-[#1A3C2B] resize-none min-h-[80px] bg-[#F7F7F5]"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-[#1A3C2B] text-white px-4 py-2 text-sm font-mono hover:bg-[#2a5c3e] disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditing(false); setEditValue(memory.value); }}
                  className="border border-[rgba(58,58,56,0.3)] text-[#1A3C2B] px-3 py-1.5 text-sm font-mono hover:bg-[rgba(58,58,56,0.05)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className={`text-sm text-[rgba(58,58,56,0.8)] ${!expanded && isTruncatable ? 'line-clamp-2' : ''}`}>
                {memory.value}
              </p>
              {isTruncatable && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="font-mono text-[10px] text-[#1A3C2B] opacity-50 hover:opacity-100 mt-0.5"
                >
                  {expanded ? 'show less' : 'show more'}
                </button>
              )}
            </div>
          )}

          {/* Bottom row: source + date */}
          <div className="flex items-center gap-3 mt-2">
            {memory.source && (
              <span className="text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 border border-current opacity-50 text-[#1A3C2B]">
                {memory.source}
              </span>
            )}
            <span className="font-mono text-[10px] text-[rgba(58,58,56,0.4)]">
              {relativeDate(memory.updated_at)}
            </span>
            {memory.tags && memory.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {memory.tags.map((tag) => (
                  <span key={tag} className="font-mono text-[9px] text-[rgba(58,58,56,0.4)]">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {!editing && (
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="border border-[rgba(58,58,56,0.2)] text-[#1A3C2B] px-2 py-1 text-xs font-mono hover:bg-[rgba(58,58,56,0.05)]"
              title="Edit"
            >
              ✏️
            </button>
            <button
              onClick={handleDelete}
              className="border border-[rgba(58,58,56,0.2)] text-[rgba(58,58,56,0.5)] px-2 py-1 text-xs font-mono hover:bg-red-50 hover:text-red-500 hover:border-red-200"
              title="Delete"
            >
              🗑
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function MemoryClient({ initialMemories }: { initialMemories: Memory[] }) {
  const [memories, setMemories] = useState<Memory[]>(initialMemories);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState<Category>('fact');
  const [addSaving, setAddSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return memories.filter((m) => {
      const matchesSearch =
        !search ||
        m.key.toLowerCase().includes(search.toLowerCase()) ||
        m.value.toLowerCase().includes(search.toLowerCase()) ||
        (m.tags && m.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())));
      const matchesCategory = activeCategory === 'all' || m.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [memories, search, activeCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: memories.length };
    for (const cat of Object.keys(CATEGORIES) as Category[]) {
      counts[cat] = memories.filter((m) => m.category === cat).length;
    }
    return counts;
  }, [memories]);

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
    setMemories((prev) => prev.map((m) => m.id === id ? { ...m, value, updated_at: new Date().toISOString() } : m));
  }

  async function handleAdd() {
    if (!newKey.trim() || !newValue.trim()) return;
    setAddSaving(true);
    const res = await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: newKey, value: newValue, category: newCategory }),
    });
    if (res.ok) {
      const data = await res.json();
      const now = new Date().toISOString();
      setMemories((prev) => [{
        id: data.id || String(Date.now()),
        key: newKey,
        value: newValue,
        category: newCategory,
        tags: [],
        importance: 3,
        source: 'manual',
        created_at: now,
        updated_at: now,
      }, ...prev]);
      setNewKey('');
      setNewValue('');
      setNewCategory('fact');
      setShowAddForm(false);
    }
    setAddSaving(false);
  }

  async function handleScan() {
    setScanning(true);
    setScanResult(null);
    setScanError(null);
    try {
      const res = await fetch('/api/memory/scan', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setScanResult(`Found ${data.count ?? 0} memories from your Google account`);
        // Refresh memories
        const refreshRes = await fetch('/api/memory');
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (Array.isArray(refreshData.memories)) {
            setMemories(refreshData.memories);
          }
        }
      } else {
        setScanError(data.error || 'Scan failed');
      }
    } catch {
      setScanError('Failed to connect');
    }
    setScanning(false);
  }

  return (
    <div className="p-6 bg-[#F7F7F5] min-h-screen text-[#1A3C2B]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-baseline gap-3">
          <h1 className="font-header text-3xl font-bold tracking-tight text-[#1A3C2B]">Memory</h1>
          <span className="font-mono text-sm text-[rgba(58,58,56,0.4)]">
            {memories.length} {memories.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-[#1A3C2B] text-white px-4 py-2 text-sm font-mono hover:bg-[#2a5c3e]"
          >
            + Add Memory
          </button>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="border border-[rgba(58,58,56,0.3)] text-[#1A3C2B] px-3 py-1.5 text-sm font-mono hover:bg-[rgba(58,58,56,0.05)] disabled:opacity-50"
          >
            {scanning ? 'Scanning...' : 'Scan Google'}
          </button>
        </div>
      </div>

      {/* Scan result banner */}
      {scanResult && (
        <div className="mb-4 p-3 border border-[#1A3C2B] bg-[#1A3C2B]/5 flex items-center justify-between">
          <span className="font-mono text-sm text-[#1A3C2B]">{scanResult}</span>
          <button onClick={() => setScanResult(null)} className="font-mono text-xs opacity-50 hover:opacity-100">✕</button>
        </div>
      )}
      {scanError && (
        <div className="mb-4 p-3 border border-red-300 bg-red-50 flex items-center justify-between">
          <span className="font-mono text-sm text-red-600">{scanError}</span>
          <button onClick={() => setScanError(null)} className="font-mono text-xs opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="border-t border-[rgba(58,58,56,0.15)] mb-6" />

      {/* Add form */}
      {showAddForm && (
        <div className="mb-6 border border-[rgba(58,58,56,0.2)] bg-white p-4">
          <h3 className="font-mono text-xs uppercase tracking-wide text-[rgba(58,58,56,0.5)] mb-4">New Memory</h3>
          <div className="space-y-3">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-wide text-[rgba(58,58,56,0.5)] block mb-1">Key</label>
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g. startup_name"
                className="w-full border border-[rgba(58,58,56,0.2)] px-3 py-2 text-sm font-mono text-[#1A3C2B] bg-[#F7F7F5] outline-none focus:border-[#1A3C2B]"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-wide text-[rgba(58,58,56,0.5)] block mb-1">Value</label>
              <textarea
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="What to remember..."
                rows={3}
                className="w-full border border-[rgba(58,58,56,0.2)] px-3 py-2 text-sm text-[#1A3C2B] bg-[#F7F7F5] outline-none focus:border-[#1A3C2B] resize-none"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-wide text-[rgba(58,58,56,0.5)] block mb-1">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as Category)}
                className="border border-[rgba(58,58,56,0.2)] px-3 py-2 text-sm font-mono text-[#1A3C2B] bg-[#F7F7F5] outline-none focus:border-[#1A3C2B]"
              >
                {(Object.keys(CATEGORIES) as Category[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORIES[cat].icon} {CATEGORIES[cat].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAdd}
                disabled={addSaving || !newKey.trim() || !newValue.trim()}
                className="bg-[#1A3C2B] text-white px-4 py-2 text-sm font-mono hover:bg-[#2a5c3e] disabled:opacity-50"
              >
                {addSaving ? 'Saving...' : 'Save Memory'}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewKey(''); setNewValue(''); }}
                className="border border-[rgba(58,58,56,0.3)] text-[#1A3C2B] px-3 py-1.5 text-sm font-mono hover:bg-[rgba(58,58,56,0.05)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-4 relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(58,58,56,0.4)] text-sm">🔍</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search memories..."
          className="w-full border border-[rgba(58,58,56,0.15)] px-3 py-2 pl-9 text-sm font-mono text-[#1A3C2B] bg-white outline-none focus:border-[#1A3C2B] placeholder:text-[rgba(58,58,56,0.3)]"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-4 scrollbar-none">
        <button
          onClick={() => setActiveCategory('all')}
          className={`flex-shrink-0 px-3 py-1.5 text-sm font-mono border whitespace-nowrap ${
            activeCategory === 'all'
              ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
              : 'border-[rgba(58,58,56,0.2)] text-[rgba(58,58,56,0.6)] hover:border-[#1A3C2B] hover:text-[#1A3C2B]'
          }`}
        >
          All {categoryCounts.all}
        </button>
        {(Object.keys(CATEGORIES) as Category[]).filter((cat) => categoryCounts[cat] > 0).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex-shrink-0 px-3 py-1.5 text-sm font-mono border whitespace-nowrap ${
              activeCategory === cat
                ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                : 'border-[rgba(58,58,56,0.2)] text-[rgba(58,58,56,0.6)] hover:border-[#1A3C2B] hover:text-[#1A3C2B]'
            }`}
          >
            {CATEGORIES[cat].icon} {CATEGORIES[cat].label} {categoryCounts[cat]}
          </button>
        ))}
      </div>

      <div className="border-t border-[rgba(58,58,56,0.15)] mb-4" />

      {/* Memory cards */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center">
          <div className="w-14 h-14 mx-auto mb-4 border border-[rgba(58,58,56,0.15)] flex items-center justify-center bg-white">
            <span className="text-2xl">🧠</span>
          </div>
          {search || activeCategory !== 'all' ? (
            <>
              <p className="font-mono text-sm text-[rgba(58,58,56,0.5)] mb-1">No memories match your filter</p>
              <button
                onClick={() => { setSearch(''); setActiveCategory('all'); }}
                className="font-mono text-[10px] text-[#1A3C2B] underline"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="font-mono text-sm text-[rgba(58,58,56,0.5)] mb-1">No memories yet</p>
              <p className="font-mono text-[10px] text-[rgba(58,58,56,0.3)] max-w-xs mx-auto">
                Add memories manually or scan your Google account to import them automatically.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
