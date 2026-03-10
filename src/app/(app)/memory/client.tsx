'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Memory {
  id: string;
  content: string;
  domain: string;
  importance: number;
  source: string;
  page_path: string | null;
  temporal?: string;
  created_at: string;
  updated_at: string;
}

interface PageInfo {
  path: string;
  count: number;
  lastUpdated: string;
}

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  count: number;
  lastUpdated: string;
  children: TreeNode[];
}

type SortKey = 'domain' | 'content' | 'importance' | 'source' | 'updated_at';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return min + 'm ago';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + 'h ago';
  const d = Math.floor(hr / 24);
  if (d === 1) return 'yesterday';
  if (d < 30) return d + 'd ago';
  const mo = Math.floor(d / 30);
  return mo + 'mo ago';
}

function importanceIndicator(importance: number): string {
  if (importance >= 0.7) return '\u{1F534}';
  if (importance >= 0.4) return '\u{1F7E1}';
  return '\u26AA';
}

function titleCase(s: string): string {
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getPagePath(m: Memory): string {
  return m.page_path || `${m.domain || 'general'}/uncategorized`;
}

// ─── Tree builder ────────────────────────────────────────────────────────────

function buildTree(pages: PageInfo[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const page of pages) {
    const segments = page.path.split('/');
    let current = root;
    let pathSoFar = '';
    for (let i = 0; i < segments.length; i++) {
      pathSoFar = pathSoFar ? pathSoFar + '/' + segments[i] : segments[i];
      let node = current.find(n => n.name === segments[i]);
      if (!node) {
        node = {
          name: segments[i],
          path: pathSoFar,
          isFolder: i < segments.length - 1,
          count: 0,
          lastUpdated: '',
          children: [],
        };
        current.push(node);
      }
      if (i === segments.length - 1) {
        node.count = page.count;
        node.lastUpdated = page.lastUpdated;
      } else {
        node.isFolder = true;
      }
      current = node.children;
    }
  }
  // Compute folder counts by summing children
  function sumCounts(nodes: TreeNode[]): number {
    let total = 0;
    for (const n of nodes) {
      if (n.children.length > 0) {
        const childSum = sumCounts(n.children);
        if (n.count === 0) n.count = childSum;
        total += childSum;
      } else {
        total += n.count;
      }
    }
    return total;
  }
  sumCounts(root);
  return root;
}

// ─── Sidebar Tree Node ──────────────────────────────────────────────────────

function TreeItem({
  node,
  depth,
  selectedPath,
  expandedFolders,
  onSelect,
  onToggleFolder,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  expandedFolders: Set<string>;
  onSelect: (path: string) => void;
  onToggleFolder: (path: string) => void;
}) {
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = selectedPath === node.path;
  const hasChildren = node.children.length > 0;
  const isFolder = node.isFolder || hasChildren;

  return (
    <>
      <button
        onClick={() => {
          if (isFolder) onToggleFolder(node.path);
          onSelect(node.path);
        }}
        className={`w-full text-left flex items-center gap-1.5 py-1.5 pr-2 rounded-md text-sm transition-colors group ${
          isSelected
            ? 'bg-[#1A3C2B] text-white'
            : 'text-[rgba(58,58,56,0.75)] hover:bg-[rgba(58,58,56,0.06)]'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {isFolder ? (
          <span className={`text-[10px] transition-transform inline-block ${isExpanded ? 'rotate-90' : ''} ${isSelected ? 'text-white/70' : 'text-[rgba(58,58,56,0.35)]'}`}>
            &#9654;
          </span>
        ) : (
          <span className={`text-[10px] ${isSelected ? 'text-white/50' : 'text-[rgba(58,58,56,0.25)]'}`}>
            &#9643;
          </span>
        )}
        <span className="truncate flex-1 font-medium">{titleCase(node.name)}</span>
        <span className={`text-[10px] font-mono ${isSelected ? 'text-white/50' : 'text-[rgba(58,58,56,0.3)]'}`}>
          {node.count}
        </span>
      </button>
      {isFolder && isExpanded && node.children.map(child => (
        <TreeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          selectedPath={selectedPath}
          expandedFolders={expandedFolders}
          onSelect={onSelect}
          onToggleFolder={onToggleFolder}
        />
      ))}
    </>
  );
}

// ─── Inline editable content ────────────────────────────────────────────────

function InlineContent({ content, onSave }: { content: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const taRef = useRef<HTMLTextAreaElement>(null);

  function startEdit() {
    setDraft(content);
    setEditing(true);
    setTimeout(() => taRef.current?.focus(), 0);
  }

  function commit() {
    setEditing(false);
    if (draft.trim() !== content) onSave(draft.trim());
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { setEditing(false); setDraft(content); }
  }

  if (editing) {
    return (
      <textarea
        ref={taRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
        rows={3}
        className="w-full text-sm text-[#1A3C2B] bg-[#F5F3EF] border border-[#1A3C2B]/30 rounded px-3 py-2 resize-none outline-none focus:border-[#1A3C2B]"
      />
    );
  }

  return (
    <span onClick={startEdit} className="text-sm text-[rgba(58,58,56,0.85)] cursor-text block whitespace-pre-wrap">
      {content || <span className="italic text-gray-400">(empty)</span>}
    </span>
  );
}

// ─── Memory Entry (page content view) ───────────────────────────────────────

function MemoryEntry({
  memory,
  onEdit,
  onDelete,
  highlighted,
}: {
  memory: Memory;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  highlighted?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`py-3 px-4 rounded-lg transition-colors group ${
        highlighted ? 'bg-yellow-50 border border-yellow-200' : hovered ? 'bg-[rgba(58,58,56,0.03)]' : ''
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start gap-3">
        <span className="text-[rgba(58,58,56,0.25)] mt-0.5 select-none">&bull;</span>
        <div className="flex-1 min-w-0">
          <InlineContent content={memory.content} onSave={v => onEdit(memory.id, v)} />
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs" title={`Importance: ${(memory.importance * 100).toFixed(0)}%`}>
              {importanceIndicator(memory.importance)}
            </span>
            <span className="font-mono text-[11px] text-[rgba(58,58,56,0.35)]">
              {memory.source || 'chat'}
            </span>
            <span className="text-[rgba(58,58,56,0.2)]">&middot;</span>
            <span className="font-mono text-[11px] text-[rgba(58,58,56,0.35)]">
              {relativeTime(memory.updated_at)}
            </span>
          </div>
        </div>
        <div className={`flex items-center gap-1 transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={() => onDelete(memory.id)}
            className="text-gray-300 hover:text-red-500 text-xs p-1 transition-colors"
            title="Delete"
          >
            &#128465;
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── All Memories Table (fallback) ──────────────────────────────────────────

function AllMemoriesTable({
  memories,
  onEdit,
  onDelete,
}: {
  memories: Memory[];
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('updated_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const sorted = useMemo(() => {
    return [...memories].sort((a, b) => {
      if (sortKey === 'importance') {
        const cmp = a.importance - b.importance;
        return sortDir === 'asc' ? cmp : -cmp;
      }
      if (sortKey === 'updated_at') {
        const cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const av = String(a[sortKey as keyof Memory] ?? '');
      const bv = String(b[sortKey as keyof Memory] ?? '');
      const cmp = av.localeCompare(bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [memories, sortKey, sortDir]);

  function Th({ label, sk, className = '' }: { label: string; sk: SortKey; className?: string }) {
    const active = sortKey === sk;
    return (
      <th
        className={`px-4 py-3 text-left font-mono text-xs uppercase tracking-wider text-[rgba(58,58,56,0.45)] cursor-pointer select-none hover:text-[#1A3C2B] transition-colors ${className}`}
        onClick={() => toggleSort(sk)}
      >
        {label}
        <span className={`ml-1 ${active ? 'text-[#1A3C2B]' : 'text-gray-300'}`}>
          {active ? (sortDir === 'asc' ? '\u2191' : '\u2193') : '\u2195'}
        </span>
      </th>
    );
  }

  return (
    <div className="rounded-xl border border-[rgba(58,58,56,0.12)] overflow-hidden bg-white">
      <table className="w-full border-collapse">
        <thead className="border-b border-[rgba(58,58,56,0.1)] bg-[#F5F3EF]">
          <tr>
            <Th label="Domain" sk="domain" className="w-32" />
            <Th label="Content" sk="content" />
            <Th label="Imp." sk="importance" className="w-16" />
            <Th label="Source" sk="source" className="w-24" />
            <Th label="Updated" sk="updated_at" className="w-24" />
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {sorted.map(m => (
            <tr key={m.id} className="border-b border-[rgba(58,58,56,0.08)] hover:bg-[#F5F3EF] transition-colors group">
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-medium border bg-gray-100 text-gray-600 border-gray-200 whitespace-nowrap">
                  {m.domain}
                </span>
              </td>
              <td className="px-4 py-3">
                <InlineContent content={m.content} onSave={v => onEdit(m.id, v)} />
              </td>
              <td className="px-4 py-3 text-center">{importanceIndicator(m.importance)}</td>
              <td className="px-4 py-3 font-mono text-xs text-[rgba(58,58,56,0.45)]">{m.source}</td>
              <td className="px-4 py-3 font-mono text-xs text-[rgba(58,58,56,0.45)]">{relativeTime(m.updated_at)}</td>
              <td className="px-3 py-3 text-right">
                <button
                  onClick={() => { if (window.confirm('Delete this memory?')) onDelete(m.id); }}
                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  &#128465;
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Add Memory Form (inline in page content) ───────────────────────────────

function AddMemoryInline({
  pagePath,
  onAdd,
  onCancel,
}: {
  pagePath: string | null;
  onAdd: (content: string, domain: string, pagePath: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const domain = pagePath ? pagePath.split('/')[0] : 'general';

  async function submit() {
    if (!content.trim()) return;
    setSaving(true);
    await onAdd(content.trim(), domain, pagePath);
    setSaving(false);
    setContent('');
    onCancel();
  }

  return (
    <div className="border border-dashed border-[#1A3C2B]/30 rounded-lg bg-white p-4 mt-3">
      <textarea
        autoFocus
        placeholder="What should I remember?"
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={2}
        className="w-full border border-[rgba(58,58,56,0.2)] rounded px-3 py-2 text-sm text-[#1A3C2B] bg-[#F5F3EF] outline-none focus:border-[#1A3C2B] resize-none"
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
          if (e.key === 'Escape') onCancel();
        }}
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={submit}
          disabled={saving || !content.trim()}
          className="bg-[#1A3C2B] text-white px-4 py-1.5 text-sm font-mono rounded hover:bg-[#2a5c3e] disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Add'}
        </button>
        <button onClick={onCancel} className="border border-[rgba(58,58,56,0.2)] text-[rgba(58,58,56,0.6)] px-3 py-1.5 text-sm font-mono rounded hover:bg-[rgba(58,58,56,0.05)]">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main Client Component ──────────────────────────────────────────────────

export function MemoryClient({ initialMemories }: { initialMemories: Memory[] }) {
  const [memories, setMemories] = useState<Memory[]>(initialMemories);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null); // null = all memories
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Memory[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build page info from memories
  const computedPages = useMemo(() => {
    const pageMap = new Map<string, { count: number; lastUpdated: string }>();
    for (const m of memories) {
      const path = getPagePath(m);
      const existing = pageMap.get(path);
      if (existing) {
        existing.count++;
        if (m.updated_at > existing.lastUpdated) existing.lastUpdated = m.updated_at;
      } else {
        pageMap.set(path, { count: 1, lastUpdated: m.updated_at });
      }
    }
    return Array.from(pageMap.entries())
      .map(([path, info]) => ({ path, count: info.count, lastUpdated: info.lastUpdated }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [memories]);

  // Use server-fetched pages if available, otherwise computed
  const effectivePages = pages.length > 0 ? pages : computedPages;

  // Fetch pages on mount
  useEffect(() => {
    fetch('/api/memory/pages')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.pages) setPages(d.pages); })
      .catch(() => {});
  }, []);

  // Auto-expand top-level folders on mount
  useEffect(() => {
    const topLevel = new Set(effectivePages.map(p => p.path.split('/')[0]));
    setExpandedFolders(topLevel);
  }, [effectivePages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const tree = useMemo(() => buildTree(effectivePages), [effectivePages]);

  // Memories filtered to selected page
  const pageMemories = useMemo(() => {
    if (!selectedPath) return memories;
    return memories.filter(m => {
      const mPath = getPagePath(m);
      return mPath === selectedPath || mPath.startsWith(selectedPath + '/');
    });
  }, [memories, selectedPath]);

  // Search
  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch('/api/memory/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, limit: 50 }),
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults((data.results || []).map((r: Record<string, unknown>) => ({
            id: r.id as string,
            content: (r.content || r.memory || '') as string,
            domain: (r.domain || 'general') as string,
            importance: (r.importance || 0.5) as number,
            source: String(r.source || 'chat'),
            page_path: (r.page_path as string) || null,
            created_at: (r.created_at || '') as string,
            updated_at: (r.updated_at || '') as string,
          })));
        }
      } catch {
        setSearchResults(null);
      }
      setSearching(false);
    }, 400);
  }, []);

  const displayMemories = searchResults !== null ? searchResults : pageMemories;

  // Page title
  const pageTitle = selectedPath
    ? titleCase(selectedPath.split('/').pop() || '')
    : 'All Memories';

  const pageLastUpdated = selectedPath
    ? effectivePages.find(p => p.path === selectedPath)?.lastUpdated
    : memories.length > 0 ? memories.reduce((a, b) => a.updated_at > b.updated_at ? a : b).updated_at : null;

  // Handlers
  async function handleDelete(id: string) {
    if (!window.confirm('Delete this memory?')) return;
    await fetch('/api/memory', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setMemories(prev => prev.filter(m => m.id !== id));
    if (searchResults) setSearchResults(prev => prev ? prev.filter(m => m.id !== id) : null);
  }

  async function handleEdit(id: string, content: string) {
    await fetch('/api/memory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, content }),
    });
    setMemories(prev => prev.map(m => m.id === id ? { ...m, content, updated_at: new Date().toISOString() } : m));
    if (searchResults) {
      setSearchResults(prev => prev ? prev.map(m => m.id === id ? { ...m, content, updated_at: new Date().toISOString() } : m) : null);
    }
  }

  async function handleAdd(content: string, domain: string, pagePath: string | null) {
    const res = await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, domain, page_path: pagePath }),
    });
    if (res.ok) {
      const now = new Date().toISOString();
      setMemories(prev => [{
        id: String(Date.now()),
        content,
        domain,
        importance: 0.8,
        source: 'user_input',
        page_path: pagePath,
        created_at: now,
        updated_at: now,
      }, ...prev]);
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
          if (Array.isArray(d2.memory)) setMemories(d2.memory);
        }
      } else {
        setScanMsg({ type: 'err', text: data.error || 'Scan failed' });
      }
    } catch {
      setScanMsg({ type: 'err', text: 'Failed to connect' });
    }
    setScanning(false);
  }

  function toggleFolder(path: string) {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function navigateToMemory(memory: Memory) {
    const path = getPagePath(memory);
    // Expand parent folders
    const segments = path.split('/');
    const newExpanded = new Set(expandedFolders);
    let acc = '';
    for (let i = 0; i < segments.length - 1; i++) {
      acc = acc ? acc + '/' + segments[i] : segments[i];
      newExpanded.add(acc);
    }
    setExpandedFolders(newExpanded);
    setSelectedPath(path);
    setHighlightedId(memory.id);
    setSearchQuery('');
    setSearchResults(null);
    setTimeout(() => setHighlightedId(null), 3000);
  }

  return (
    <div className="min-h-screen bg-[#F5F3EF] text-[#1A3C2B]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="sm:hidden text-[rgba(58,58,56,0.5)] hover:text-[#1A3C2B] p-1"
              title="Toggle sidebar"
            >
              &#9776;
            </button>
            <h1 className="font-header text-3xl font-bold tracking-tight text-[#1A3C2B]">Memory</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleScan}
              disabled={scanning}
              className="border border-[rgba(58,58,56,0.2)] text-[#1A3C2B] px-3 py-1.5 text-sm font-mono rounded hover:bg-[rgba(58,58,56,0.05)] disabled:opacity-40 transition-colors"
            >
              {scanning ? 'Scanning...' : 'Scan Google'}
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
            <button onClick={() => setScanMsg(null)} className="opacity-50 hover:opacity-100 ml-4">&#10005;</button>
          </div>
        )}

        {/* Main layout */}
        <div className="flex gap-0 min-h-[calc(100vh-160px)]">
          {/* Sidebar */}
          <div className={`${sidebarOpen ? 'block' : 'hidden'} sm:block w-64 flex-shrink-0 bg-white border border-[rgba(58,58,56,0.12)] rounded-l-xl overflow-hidden`}>
            <div className="p-3">
              {/* Search */}
              <div className="relative mb-3">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[rgba(58,58,56,0.3)] text-xs pointer-events-none">&#128269;</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-[#F5F3EF] border border-[rgba(58,58,56,0.1)] rounded-md pl-8 pr-3 py-1.5 text-xs font-mono text-[#1A3C2B] placeholder:text-[rgba(58,58,56,0.3)] outline-none focus:border-[#1A3C2B]/30 transition-colors"
                />
                {searching && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[rgba(58,58,56,0.4)] font-mono">...</span>
                )}
              </div>

              {/* All Memories button */}
              <button
                onClick={() => { setSelectedPath(null); setSearchQuery(''); setSearchResults(null); }}
                className={`w-full text-left flex items-center gap-2 py-2 px-2 rounded-md text-sm font-medium transition-colors mb-1 ${
                  selectedPath === null && !searchResults
                    ? 'bg-[#1A3C2B] text-white'
                    : 'text-[rgba(58,58,56,0.75)] hover:bg-[rgba(58,58,56,0.06)]'
                }`}
              >
                <span className="text-xs">&#128203;</span>
                <span className="flex-1">All Memories</span>
                <span className={`text-[10px] font-mono ${selectedPath === null && !searchResults ? 'text-white/50' : 'text-[rgba(58,58,56,0.3)]'}`}>
                  {memories.length}
                </span>
              </button>

              <div className="border-t border-[rgba(58,58,56,0.08)] my-2" />

              {/* Tree */}
              <div className="space-y-0.5 overflow-y-auto max-h-[calc(100vh-340px)]">
                {tree.map(node => (
                  <TreeItem
                    key={node.path}
                    node={node}
                    depth={0}
                    selectedPath={selectedPath}
                    expandedFolders={expandedFolders}
                    onSelect={setSelectedPath}
                    onToggleFolder={toggleFolder}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 bg-white border-y border-r border-[rgba(58,58,56,0.12)] rounded-r-xl sm:rounded-r-xl sm:rounded-l-none rounded-xl sm:rounded-xl overflow-hidden">
            <div className="p-6">
              {/* Search results view */}
              {searchResults !== null ? (
                <>
                  <div className="mb-4">
                    <h2 className="font-header text-2xl font-bold text-[#1A3C2B]">
                      Search Results
                    </h2>
                    <p className="text-xs font-mono text-[rgba(58,58,56,0.4)] mt-1">
                      {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'} for &ldquo;{searchQuery}&rdquo;
                    </p>
                  </div>
                  {searchResults.length === 0 ? (
                    <div className="py-16 text-center">
                      <p className="text-[rgba(58,58,56,0.4)] text-sm">No results found.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[rgba(58,58,56,0.06)]">
                      {searchResults.map(m => (
                        <div key={m.id} className="py-2">
                          <button
                            onClick={() => navigateToMemory(m)}
                            className="text-[10px] font-mono text-[#1A3C2B]/50 hover:text-[#1A3C2B] mb-1 block"
                          >
                            {getPagePath(m).split('/').map(s => titleCase(s)).join(' / ')}
                          </button>
                          <MemoryEntry
                            memory={m}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : selectedPath === null ? (
                /* All Memories table view */
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="font-header text-2xl font-bold text-[#1A3C2B]">All Memories</h2>
                      <p className="text-xs font-mono text-[rgba(58,58,56,0.4)] mt-1">
                        {memories.length} {memories.length === 1 ? 'memory' : 'memories'}
                        {pageLastUpdated ? ` \u00B7 Updated ${relativeTime(pageLastUpdated)}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAdd(v => !v)}
                      className="bg-[#1A3C2B] text-white px-3 py-1.5 text-sm font-mono rounded hover:bg-[#2a5c3e] transition-colors"
                    >
                      + Add
                    </button>
                  </div>
                  {showAdd && (
                    <AddMemoryInline pagePath={null} onAdd={handleAdd} onCancel={() => setShowAdd(false)} />
                  )}
                  {memories.length === 0 ? (
                    <div className="py-24 text-center">
                      <div className="text-5xl mb-4">&#129504;</div>
                      <p className="text-[rgba(58,58,56,0.55)] text-base mb-1">No memories yet.</p>
                      <p className="font-mono text-sm text-[rgba(58,58,56,0.35)]">
                        Start chatting and I&apos;ll remember the important stuff.
                      </p>
                    </div>
                  ) : (
                    <AllMemoriesTable memories={memories} onEdit={handleEdit} onDelete={handleDelete} />
                  )}
                </>
              ) : (
                /* Page content view */
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[10px] font-mono text-[rgba(58,58,56,0.35)] mb-1">
                        {selectedPath.split('/').slice(0, -1).map(s => titleCase(s)).join(' / ')}
                      </p>
                      <h2 className="font-header text-2xl font-bold text-[#1A3C2B]">{pageTitle}</h2>
                      <p className="text-xs font-mono text-[rgba(58,58,56,0.4)] mt-1">
                        {pageMemories.length} {pageMemories.length === 1 ? 'memory' : 'memories'}
                        {pageLastUpdated ? ` \u00B7 Updated ${relativeTime(pageLastUpdated)}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAdd(v => !v)}
                      className="bg-[#1A3C2B] text-white px-3 py-1.5 text-sm font-mono rounded hover:bg-[#2a5c3e] transition-colors"
                    >
                      + Add
                    </button>
                  </div>

                  {showAdd && (
                    <AddMemoryInline pagePath={selectedPath} onAdd={handleAdd} onCancel={() => setShowAdd(false)} />
                  )}

                  <div className="border-t border-[rgba(58,58,56,0.08)] mt-2" />

                  {pageMemories.length === 0 ? (
                    <div className="py-16 text-center">
                      <p className="text-[rgba(58,58,56,0.4)] text-sm">No memories in this page yet.</p>
                      <button
                        onClick={() => setShowAdd(true)}
                        className="font-mono text-xs text-[#1A3C2B] underline underline-offset-2 mt-2"
                      >
                        Add one
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-[rgba(58,58,56,0.06)] mt-2">
                      {pageMemories.map(m => (
                        <MemoryEntry
                          key={m.id}
                          memory={m}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          highlighted={highlightedId === m.id}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 px-1">
          <button
            onClick={handleScan}
            disabled={scanning}
            className="font-mono text-xs text-[rgba(58,58,56,0.4)] hover:text-[#1A3C2B] transition-colors disabled:opacity-40"
          >
            {scanning ? 'Scanning...' : 'Scan Google'}
          </button>
          <span className="font-mono text-[10px] text-[rgba(58,58,56,0.3)]">
            {memories.length} total memories
          </span>
        </div>
      </div>
    </div>
  );
}
