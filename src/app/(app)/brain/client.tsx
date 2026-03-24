'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { GlassNavbar } from '@/components/layout/glass-navbar';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BrainCriterionView {
  id: string;
  domain: string;
  subdomain: string | null;
  context: string | null;
  description: string;
  weight: number;
  source: string;
  confidence: number;
  correction_count: number;
  preference_type: string;
  examples: string[];
  valid_from: string;
  created_at: string;
  updated_at: string;
}

interface BrainSignalView {
  id: string;
  signal_type: string;
  domain: string;
  subdomain: string | null;
  context: string | null;
  signal_data: Record<string, unknown>;
  session_id: string | null;
  created_at: string;
}

interface BrainPatternView {
  id: string;
  domain: string;
  subdomain: string | null;
  context: string | null;
  pattern_type: string;
  description: string;
  evidence: Array<{ signal_type: string; summary: string; created_at: string }>;
  occurrence_count: number;
  confidence: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface MemoryItem {
  id: string;
  content: string;
  domain: string;
  importance: number;
  source: string;
  created_at: string;
  updated_at: string;
}

interface DomainNode {
  name: string;
  count: number;
  subdomains: Map<string, number>;
}

type PreferenceTypeKey = 'personality' | 'process' | 'style' | 'criteria' | 'knowledge' | 'general';

type BrainTab = 'memories' | 'learned' | 'activity';

const PREFERENCE_TYPE_LABELS: Record<PreferenceTypeKey, string> = {
  personality: 'Personality',
  process: 'Process',
  style: 'Style',
  criteria: 'Decision Criteria',
  knowledge: 'Knowledge',
  general: 'General',
};

const PREFERENCE_TYPE_ORDER: PreferenceTypeKey[] = ['personality', 'process', 'style', 'criteria', 'knowledge', 'general'];

const MEMORY_DOMAINS = ['identity', 'projects', 'contacts', 'preferences', 'work', 'general'] as const;

const DOMAIN_BADGES: Record<string, string> = {
  identity: 'bg-purple-900/30 text-purple-400 border-purple-800/40',
  projects: 'bg-blue-900/30 text-blue-400 border-blue-800/40',
  contacts: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
  preferences: 'bg-amber-900/30 text-amber-400 border-amber-800/40',
  work: 'bg-cyan-900/30 text-cyan-400 border-cyan-800/40',
  general: 'bg-gray-900/30 text-gray-400 border-gray-800/40',
};

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

function formatSessionDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatWeight(w: number): string {
  return (w >= 0 ? '+' : '') + w.toFixed(2);
}

function getWeightBarColor(w: number): string {
  if (w <= -0.5) return 'bg-red-500/40';
  if (w <= -0.1) return 'bg-orange-500/30';
  if (w < 0.1) return 'bg-yellow-500/20';
  if (w < 0.5) return 'bg-emerald-400/30';
  return 'bg-emerald-500/40';
}

function getWeightTextColor(w: number): string {
  if (w <= -0.5) return 'text-red-400';
  if (w <= -0.1) return 'text-orange-400';
  if (w < 0.1) return 'text-yellow-400/70';
  if (w < 0.5) return 'text-emerald-400';
  return 'text-emerald-400';
}

function getSignalIcon(type: string): string {
  switch (type) {
    case 'accept': return '✓';
    case 'reject': return '✗';
    case 'edit_delta': return '✏️';
    case 'correction': return '💬';
    case 'engagement': return '📊';
    case 'ignore': return '—';
    default: return '•';
  }
}

function getSignalDescription(signal: BrainSignalView): string {
  const d = signal.signal_data;
  switch (signal.signal_type) {
    case 'correction':
      return String(d.correction_text || 'Correction applied').slice(0, 80);
    case 'edit_delta':
      return String(d.diff_summary || 'Edit detected').slice(0, 80);
    case 'accept':
    case 'reject':
      return String(d.suggestion_snippet || `${signal.signal_type} signal`).slice(0, 80);
    case 'engagement': {
      const len = d.message_length as number || 0;
      const followup = d.has_followup ? ', follow-up' : '';
      return `${len} chars${followup}`;
    }
    default:
      return signal.signal_type;
  }
}

const SOURCE_BADGE: Record<string, string> = {
  stated: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
  revealed: 'bg-amber-900/30 text-amber-400 border-amber-800/40',
  refined: 'bg-blue-900/30 text-blue-400 border-blue-800/40',
};

const SOURCE_LABEL: Record<string, string> = {
  stated: 'STATED',
  revealed: 'REVEALED',
  refined: 'REFINED',
};

const TYPE_BADGE: Record<string, string> = {
  personality: 'bg-purple-900/30 text-purple-400 border-purple-800/40',
  process: 'bg-cyan-900/30 text-cyan-400 border-cyan-800/40',
  style: 'bg-pink-900/30 text-pink-400 border-pink-800/40',
  criteria: 'bg-indigo-900/30 text-indigo-400 border-indigo-800/40',
  knowledge: 'bg-teal-900/30 text-teal-400 border-teal-800/40',
  general: 'bg-gray-900/30 text-gray-400 border-gray-800/40',
};

// ─── Domain Tree (for Criteria tab) ─────────────────────────────────────────

function buildDomainTree(criteria: BrainCriterionView[]): DomainNode[] {
  const map = new Map<string, DomainNode>();

  for (const c of criteria) {
    const domain = c.domain || 'general';
    let node = map.get(domain);
    if (!node) {
      node = { name: domain, count: 0, subdomains: new Map() };
      map.set(domain, node);
    }
    node.count++;
    if (c.subdomain) {
      node.subdomains.set(c.subdomain, (node.subdomains.get(c.subdomain) || 0) + 1);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function DomainTree({
  domains,
  selected,
  total,
  onSelect,
}: {
  domains: DomainNode[];
  selected: string | null;
  total: number;
  onSelect: (domain: string | null) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  return (
    <div className="space-y-0.5">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'w-full text-left px-3 py-2 flex items-center justify-between transition-colors',
          selected === null
            ? 'bg-white/[0.08] text-white/80'
            : 'text-white/50 hover:text-white/70 hover:bg-white/[0.03]'
        )}
      >
        <span className="font-mono text-[10px] uppercase tracking-wide">All</span>
        <span className="font-mono text-[9px] text-white/30">{total}</span>
      </button>
      {domains.map((d) => (
        <div key={d.name}>
          <button
            onClick={() => {
              onSelect(d.name);
              if (d.subdomains.size > 0) {
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(d.name)) next.delete(d.name);
                  else next.add(d.name);
                  return next;
                });
              }
            }}
            className={cn(
              'w-full text-left px-3 py-2 flex items-center justify-between transition-colors',
              selected === d.name
                ? 'bg-white/[0.08] text-white/80'
                : 'text-white/50 hover:text-white/70 hover:bg-white/[0.03]'
            )}
          >
            <span className="font-mono text-[10px] uppercase tracking-wide flex items-center gap-1.5">
              {d.subdomains.size > 0 && (
                <span className="text-[8px] text-white/30">{expanded.has(d.name) ? '▼' : '▶'}</span>
              )}
              {d.name}
            </span>
            <span className="font-mono text-[9px] text-white/30">{d.count}</span>
          </button>
          {expanded.has(d.name) && d.subdomains.size > 0 && (
            <div className="ml-4">
              {Array.from(d.subdomains.entries()).map(([sub, count]) => (
                <button
                  key={sub}
                  onClick={() => onSelect(`${d.name}/${sub}`)}
                  className={cn(
                    'w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors',
                    selected === `${d.name}/${sub}`
                      ? 'bg-white/[0.06] text-white/70'
                      : 'text-white/40 hover:text-white/60 hover:bg-white/[0.02]'
                  )}
                >
                  <span className="font-mono text-[9px] tracking-wide">{sub}</span>
                  <span className="font-mono text-[8px] text-white/25">{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Weight Bar ──────────────────────────────────────────────────────────────

function WeightBar({ weight }: { weight: number }) {
  const absW = Math.abs(weight);
  const widthPct = absW * 50;
  const isNegative = weight < 0;
  const barColor = getWeightBarColor(weight);

  return (
    <div className="relative h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/[0.12]" />
      <div
        className={cn('absolute top-0 bottom-0 rounded-full', barColor)}
        style={
          isNegative
            ? { right: '50%', width: `${widthPct}%` }
            : { left: '50%', width: `${widthPct}%` }
        }
      />
    </div>
  );
}

// ─── Criterion Card ──────────────────────────────────────────────────────────

function CriterionCard({
  criterion,
  signals,
  onWeightChange,
  onDelete,
}: {
  criterion: BrainCriterionView;
  signals: BrainSignalView[];
  onWeightChange?: (id: string, weight: number) => void;
  onDelete?: (id: string) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [localWeight, setLocalWeight] = useState(criterion.weight);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const weightSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const relevantSignals = useMemo(() => {
    if (!showHistory) return [];
    return signals
      .filter((s) => {
        if (s.domain !== criterion.domain) return false;
        if (criterion.subdomain && s.subdomain && s.subdomain !== criterion.subdomain) return false;
        return true;
      })
      .slice(0, 10);
  }, [showHistory, signals, criterion.domain, criterion.subdomain]);

  function handleWeightSlider(e: React.ChangeEvent<HTMLInputElement>) {
    const w = parseFloat(e.target.value);
    setLocalWeight(w);

    // Debounce the API call
    if (weightSaveTimer.current) clearTimeout(weightSaveTimer.current);
    weightSaveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch(`/api/brain/criteria/${criterion.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weight: w }),
        });
        onWeightChange?.(criterion.id, w);
      } catch {
        // Silently fail — UI stays updated optimistically
      } finally {
        setSaving(false);
      }
    }, 600);
  }

  function handleDelete() {
    if (confirmDelete) {
      fetch(`/api/brain/criteria/${criterion.id}`, { method: 'DELETE' })
        .then(() => onDelete?.(criterion.id))
        .catch(() => {});
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  }

  return (
    <div className="relative bg-white/[0.05] border border-white/[0.09] rounded-[2px] p-3 space-y-2 group">
      {/* Delete button — top right, visible on hover */}
      {onDelete && (
        <button
          onClick={handleDelete}
          title={confirmDelete ? 'Click again to confirm delete' : 'Delete criterion'}
          className={cn(
            'absolute top-2 right-2 text-[10px] p-1 transition-colors opacity-0 group-hover:opacity-100',
            confirmDelete
              ? 'text-red-400 hover:text-red-300 opacity-100'
              : 'text-white/25 hover:text-red-400'
          )}
        >
          {confirmDelete ? '⚠️' : '🗑️'}
        </button>
      )}

      <div className="flex items-center gap-1.5 flex-wrap pr-6">
        <span className="font-mono text-[8px] uppercase tracking-wide px-1.5 py-0.5 bg-white/[0.06] border border-white/[0.08] text-white/40">
          {criterion.domain}
        </span>
        {criterion.subdomain && (
          <span className="font-mono text-[8px] uppercase tracking-wide px-1.5 py-0.5 bg-white/[0.04] border border-white/[0.06] text-white/30">
            {criterion.subdomain}
          </span>
        )}
        {criterion.context && (
          <span className="font-mono text-[8px] uppercase tracking-wide px-1.5 py-0.5 bg-white/[0.04] border border-white/[0.06] text-white/30">
            {criterion.context}
          </span>
        )}
      </div>

      <p className="text-xs text-white/65 leading-relaxed">{criterion.description}</p>

      {/* Weight bar + slider */}
      <div className="space-y-1.5">
        <WeightBar weight={localWeight} />
        <div className="flex items-center justify-between">
          <span className={cn('font-mono text-[10px] font-medium', getWeightTextColor(localWeight))}>
            {formatWeight(localWeight)}
            {saving && <span className="ml-1 text-white/20 text-[8px]">saving…</span>}
          </span>
          <span className="font-mono text-[9px] text-white/25">
            conf {criterion.confidence.toFixed(2)}
          </span>
        </div>
        {/* Weight adjustment slider */}
        {onWeightChange && (
          <input
            type="range"
            min="-1"
            max="1"
            step="0.05"
            value={localWeight}
            onChange={handleWeightSlider}
            className="w-full h-1 accent-emerald-400 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
            title="Adjust weight"
          />
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'font-mono text-[8px] uppercase tracking-wide px-1.5 py-0.5 border',
              SOURCE_BADGE[criterion.source] ?? SOURCE_BADGE.revealed
            )}
          >
            {SOURCE_LABEL[criterion.source] ?? criterion.source}
          </span>
          <span
            className={cn(
              'font-mono text-[8px] uppercase tracking-wide px-1.5 py-0.5 border',
              TYPE_BADGE[criterion.preference_type] ?? TYPE_BADGE.general
            )}
          >
            {criterion.preference_type}
          </span>
          {criterion.correction_count > 0 && (
            <span className="font-mono text-[8px] text-white/30">
              {criterion.correction_count}× corrected
            </span>
          )}
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="font-mono text-[8px] uppercase tracking-wide text-white/30 hover:text-white/50 transition-colors"
        >
          {showHistory ? 'Hide history' : 'View history'}
        </button>
      </div>

      {showHistory && (
        <div className="border-t border-white/[0.05] pt-2 mt-1 space-y-1">
          {relevantSignals.length === 0 ? (
            <p className="font-mono text-[9px] text-white/20">No matching signals found.</p>
          ) : (
            relevantSignals.map((signal) => (
              <div
                key={signal.id}
                className="flex items-start gap-2 py-1 border-b border-white/[0.03] last:border-0"
              >
                <span className="text-[10px] mt-0.5 w-4 text-center flex-shrink-0">
                  {getSignalIcon(signal.signal_type)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[9px] text-white/50 truncate">
                    {getSignalDescription(signal)}
                  </p>
                </div>
                <span className="font-mono text-[8px] text-white/20 flex-shrink-0">
                  {relativeTime(signal.created_at)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Memory Item Component ───────────────────────────────────────────────────

function MemoryItemCard({
  memory,
  onEdit,
  onDelete,
}: {
  memory: MemoryItem;
  onEdit: (id: string, content: string, domain: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(memory.content);
  const [editDomain, setEditDomain] = useState(memory.domain);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editing]);

  function handleSave() {
    if (editContent.trim()) {
      onEdit(memory.id, editContent.trim(), editDomain);
    }
    setEditing(false);
  }

  function handleCancel() {
    setEditContent(memory.content);
    setEditDomain(memory.domain);
    setEditing(false);
  }

  function handleDelete() {
    if (confirmDelete) {
      onDelete(memory.id);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  }

  if (editing) {
    return (
      <div className="bg-white/[0.05] border border-white/[0.15] rounded-[2px] p-3 space-y-2">
        <textarea
          ref={textareaRef}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
            if (e.key === 'Escape') handleCancel();
          }}
          rows={2}
          className="w-full bg-white/[0.05] border border-white/[0.1] rounded px-3 py-2 text-xs text-white/80 resize-none outline-none focus:border-white/[0.2]"
        />
        <div className="flex items-center gap-2">
          <select
            value={editDomain}
            onChange={(e) => setEditDomain(e.target.value)}
            className="bg-white/[0.05] border border-white/[0.1] text-white/60 text-[10px] px-2 py-1 font-mono rounded"
          >
            {MEMORY_DOMAINS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <div className="flex-1" />
          <button
            onClick={handleCancel}
            className="font-mono text-[10px] text-white/40 hover:text-white/60 px-2 py-1"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="font-mono text-[10px] text-emerald-400 hover:text-emerald-300 px-2 py-1 bg-emerald-900/20 border border-emerald-800/30 rounded"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-3 py-2 px-3 hover:bg-white/[0.03] rounded-[2px] transition-colors">
      <span className="text-white/20 mt-0.5 select-none text-xs">•</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/65 leading-relaxed">{memory.content}</p>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={cn(
              'font-mono text-[8px] uppercase tracking-wide px-1.5 py-0.5 border rounded-sm',
              DOMAIN_BADGES[memory.domain] || DOMAIN_BADGES.general
            )}
          >
            {memory.domain}
          </span>
          <span className="font-mono text-[9px] text-white/20">
            {relativeTime(memory.updated_at)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setEditing(true)}
          className="text-white/30 hover:text-white/60 text-[10px] p-1 transition-colors"
          title="Edit"
        >
          ✏️
        </button>
        <button
          onClick={handleDelete}
          className={cn(
            'text-[10px] p-1 transition-colors',
            confirmDelete
              ? 'text-red-400 hover:text-red-300'
              : 'text-white/30 hover:text-red-400'
          )}
          title={confirmDelete ? 'Click again to confirm' : 'Delete'}
        >
          {confirmDelete ? '⚠️' : '🗑️'}
        </button>
      </div>
    </div>
  );
}

// ─── Add Memory Form ─────────────────────────────────────────────────────────

function AddMemoryForm({
  onAdd,
  onCancel,
}: {
  onAdd: (content: string, domain: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [content, setContent] = useState('');
  const [domain, setDomain] = useState('general');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!content.trim()) return;
    setSaving(true);
    await onAdd(content.trim(), domain);
    setSaving(false);
    setContent('');
    setDomain('general');
    onCancel();
  }

  return (
    <div className="bg-white/[0.05] border border-dashed border-white/[0.15] rounded-[2px] p-3 space-y-2">
      <textarea
        autoFocus
        placeholder="What should I remember?"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
          if (e.key === 'Escape') onCancel();
        }}
        rows={2}
        className="w-full bg-white/[0.05] border border-white/[0.1] rounded px-3 py-2 text-xs text-white/80 resize-none outline-none focus:border-white/[0.2] placeholder:text-white/20"
      />
      <div className="flex items-center gap-2">
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="bg-white/[0.05] border border-white/[0.1] text-white/60 text-[10px] px-2 py-1 font-mono rounded"
        >
          {MEMORY_DOMAINS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <div className="flex-1" />
        <button
          onClick={onCancel}
          className="font-mono text-[10px] text-white/40 hover:text-white/60 px-2 py-1"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !content.trim()}
          className="font-mono text-[10px] text-emerald-400 hover:text-emerald-300 px-2 py-1 bg-emerald-900/20 border border-emerald-800/30 rounded disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Add Memory'}
        </button>
      </div>
    </div>
  );
}

// ─── Recent Sessions Section ──────────────────────────────────────────────────

function RecentSessionsSection({ sessions }: { sessions: MemoryItem[] }) {
  const recent = sessions.slice(0, 7);

  return (
    <div className="bg-white/[0.04] border border-white/[0.09] rounded-[2px] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-white/40">🕐</span>
        <h3 className="font-mono text-[10px] uppercase tracking-wide text-white/50">Recent Sessions</h3>
        <span className="font-mono text-[8px] text-white/20">{sessions.length}</span>
        <div className="flex-1 h-px bg-white/[0.05]" />
      </div>

      {recent.length === 0 ? (
        <p className="text-xs text-white/30 italic pl-1">No session history yet.</p>
      ) : (
        <div className="space-y-0 divide-y divide-white/[0.05]">
          {recent.map((session) => (
            <div key={session.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              {/* Timeline marker + date */}
              <div className="flex-shrink-0 w-[90px] pt-0.5">
                <span className="font-mono text-[9px] text-white/30 leading-tight block">
                  {formatSessionDate(session.created_at)}
                </span>
              </div>
              {/* Vertical line marker */}
              <div className="flex-shrink-0 flex flex-col items-center mt-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white/20 flex-shrink-0" />
                <span className="w-px flex-1 bg-white/[0.06] min-h-[12px] mt-1" />
              </div>
              {/* Summary text */}
              <p className="flex-1 text-xs text-white/55 leading-relaxed min-w-0">
                {session.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── What I Know Tab ─────────────────────────────────────────────────────────

function WhatIKnowTab() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [filterDomain, setFilterDomain] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMemories = useCallback(async (search?: string) => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/brain/memories?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setMemories(data.memories || []);
      setError(null);
    } catch {
      setError('Failed to load memories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  function handleSearchChange(q: string) {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetchMemories(q || undefined);
    }, 400);
  }

  async function handleAdd(content: string, domain: string) {
    const res = await fetch('/api/brain/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, domain }),
    });
    if (!res.ok) {
      setError('Failed to add memory');
      return;
    }
    // Optimistic add
    const now = new Date().toISOString();
    setMemories((prev) => [{
      id: `temp-${Date.now()}`,
      content,
      domain,
      importance: 0.8,
      source: 'user_input',
      created_at: now,
      updated_at: now,
    }, ...prev]);
    // Refresh to get real ID
    setTimeout(() => fetchMemories(searchQuery || undefined), 500);
  }

  async function handleEdit(id: string, content: string, domain: string) {
    const res = await fetch(`/api/brain/memories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, domain }),
    });
    if (!res.ok) {
      setError('Failed to update memory');
      return;
    }
    setMemories((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, content, domain, updated_at: new Date().toISOString() } : m
      )
    );
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/brain/memories/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError('Failed to delete memory');
      return;
    }
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  // Separate session summaries from regular memories
  const sessionMemories = useMemo(() =>
    memories.filter((m) => m.domain === 'session' || m.source === 'session_summary'),
    [memories]
  );

  const nonSessionMemories = useMemo(() =>
    memories.filter((m) => m.domain !== 'session' && m.source !== 'session_summary'),
    [memories]
  );

  // Filter and group (regular memories only, not session summaries)
  const filteredMemories = useMemo(() => {
    if (!filterDomain) return nonSessionMemories;
    return nonSessionMemories.filter((m) => m.domain === filterDomain);
  }, [nonSessionMemories, filterDomain]);

  const groupedMemories = useMemo(() => {
    const groups: Record<string, MemoryItem[]> = {};
    for (const m of filteredMemories) {
      const d = m.domain || 'general';
      if (!groups[d]) groups[d] = [];
      groups[d].push(m);
    }
    // Sort groups: identity first, then alphabetically
    const order = ['identity', 'projects', 'contacts', 'preferences', 'work', 'general'];
    return Object.entries(groups).sort(([a], [b]) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [filteredMemories]);

  const availableDomains = useMemo(() => {
    const domains = new Set(nonSessionMemories.map((m) => m.domain || 'general'));
    return Array.from(domains).sort();
  }, [nonSessionMemories]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="font-mono text-[10px] text-white/30 animate-pulse">Loading memories...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-[2px] px-3 py-2 flex items-center justify-between">
          <span className="font-mono text-[10px] text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400/50 hover:text-red-400 text-xs">✕</button>
        </div>
      )}

      {/* Search + Add + Domain filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20 text-xs pointer-events-none">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search memories..."
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-[2px] pl-8 pr-3 py-1.5 text-xs font-mono text-white/70 placeholder:text-white/20 outline-none focus:border-white/[0.15] transition-colors"
          />
        </div>
        {availableDomains.length > 1 && (
          <select
            value={filterDomain || ''}
            onChange={(e) => setFilterDomain(e.target.value || null)}
            className="bg-white/[0.05] border border-white/[0.08] text-white/50 text-[10px] px-2 py-1.5 font-mono rounded-[2px]"
          >
            <option value="">All domains</option>
            {availableDomains.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="font-mono text-[10px] text-emerald-400 hover:text-emerald-300 px-3 py-1.5 bg-emerald-900/20 border border-emerald-800/30 rounded-[2px] transition-colors"
        >
          + Add memory
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <AddMemoryForm onAdd={handleAdd} onCancel={() => setShowAdd(false)} />
      )}

      {/* Recent Sessions */}
      <RecentSessionsSection sessions={sessionMemories} />

      {/* Memories list */}
      {filteredMemories.length === 0 ? (
        <div className="bg-white/[0.05] border border-white/[0.09] rounded-[2px] p-8 text-center">
          <p className="text-sm text-white/40">
            {searchQuery ? 'No memories match your search.' : 'No memories yet.'}
          </p>
          <p className="text-xs text-white/25 mt-2">
            As you chat with Dopl, things you tell it will appear here. You can also add memories manually.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedMemories.map(([domain, items]) => (
            <div key={domain}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-mono text-[10px] uppercase tracking-wide text-white/50">
                  {domain}
                </h3>
                <span className="font-mono text-[8px] text-white/20">{items.length}</span>
                <div className="flex-1 h-px bg-white/[0.05]" />
              </div>
              <div className="space-y-0.5">
                {items.map((memory) => (
                  <MemoryItemCard
                    key={memory.id}
                    memory={memory}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Activity Tab ────────────────────────────────────────────────────────────

function ActivityTab({
  signals,
  patterns,
}: {
  signals: BrainSignalView[];
  patterns: BrainPatternView[];
}) {
  return (
    <div className="space-y-6">
      {/* Patterns */}
      {patterns.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-mono text-[10px] uppercase tracking-wide text-white/50">Patterns</h3>
            <span className="font-mono text-[8px] text-white/20">{patterns.length}</span>
            <div className="flex-1 h-px bg-white/[0.05]" />
          </div>
          <div className="space-y-2">
            {patterns.map((p) => (
              <div key={p.id} className="bg-white/[0.05] border border-white/[0.09] rounded-[2px] p-3 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[8px] uppercase tracking-wide px-1.5 py-0.5 bg-white/[0.06] border border-white/[0.08] text-white/40">
                    {p.domain}
                  </span>
                  <span className="font-mono text-[8px] uppercase tracking-wide px-1.5 py-0.5 bg-white/[0.04] border border-white/[0.06] text-white/30">
                    {p.pattern_type}
                  </span>
                  <span className="font-mono text-[8px] text-white/20 ml-auto">
                    {p.occurrence_count}× · conf {p.confidence.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-white/65 leading-relaxed">{p.description}</p>
                <span className="font-mono text-[8px] text-white/20">{relativeTime(p.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Signals */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-mono text-[10px] uppercase tracking-wide text-white/50">Recent Signals</h3>
          <span className="font-mono text-[8px] text-white/20">{signals.length}</span>
          <div className="flex-1 h-px bg-white/[0.05]" />
        </div>
        {signals.length === 0 ? (
          <div className="bg-white/[0.05] border border-white/[0.09] rounded-[2px] p-8 text-center">
            <p className="text-sm text-white/40">No signals yet.</p>
            <p className="text-xs text-white/25 mt-2">Signals are collected from your chat interactions.</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {signals.map((signal) => (
              <div
                key={signal.id}
                className="flex items-start gap-2 py-1.5 px-3 hover:bg-white/[0.03] rounded-[2px] transition-colors"
              >
                <span className="text-[10px] mt-0.5 w-4 text-center flex-shrink-0">
                  {getSignalIcon(signal.signal_type)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[9px] text-white/50 truncate">
                    {getSignalDescription(signal)}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono text-[8px] text-white/25">{signal.domain}</span>
                    {signal.subdomain && (
                      <span className="font-mono text-[8px] text-white/20">/ {signal.subdomain}</span>
                    )}
                  </div>
                </div>
                <span className="font-mono text-[8px] text-white/20 flex-shrink-0">
                  {relativeTime(signal.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function BrainClient({
  initialCriteria,
  initialSignals,
  initialPatterns,
  initialMemoryCount,
}: {
  initialCriteria: BrainCriterionView[];
  initialSignals: BrainSignalView[];
  initialPatterns: BrainPatternView[];
  initialMemoryCount?: number;
}) {
  const [activeTab, setActiveTab] = useState<BrainTab>('memories');
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [criteriaSearch, setCriteriaSearch] = useState('');
  // Mutable criteria state so deletes/weight changes reflect immediately
  const [criteria, setCriteria] = useState<BrainCriterionView[]>(initialCriteria);

  const domainTree = useMemo(() => buildDomainTree(criteria), [criteria]);

  function handleCriterionWeightChange(id: string, weight: number) {
    setCriteria((prev) =>
      prev.map((c) => (c.id === id ? { ...c, weight } : c))
    );
  }

  function handleCriterionDelete(id: string) {
    setCriteria((prev) => prev.filter((c) => c.id !== id));
  }

  // Filter criteria by selected domain and search query
  const filteredCriteria = useMemo(() => {
    let result = criteria;
    if (selectedDomain) {
      if (selectedDomain.includes('/')) {
        const [domain, subdomain] = selectedDomain.split('/');
        result = result.filter(
          (c) => c.domain === domain && c.subdomain === subdomain
        );
      } else {
        result = result.filter((c) => c.domain === selectedDomain);
      }
    }
    if (criteriaSearch.trim()) {
      const q = criteriaSearch.toLowerCase();
      result = result.filter(
        (c) =>
          c.description.toLowerCase().includes(q) ||
          c.domain.toLowerCase().includes(q) ||
          (c.subdomain && c.subdomain.toLowerCase().includes(q)) ||
          c.preference_type.toLowerCase().includes(q)
      );
    }
    return result;
  }, [criteria, selectedDomain, criteriaSearch]);

  // Group by preference type
  const groupedByType = useMemo(() => {
    const groups = new Map<string, BrainCriterionView[]>();
    for (const c of filteredCriteria) {
      const type = c.preference_type || 'general';
      const list = groups.get(type) || [];
      list.push(c);
      groups.set(type, list);
    }
    return groups;
  }, [filteredCriteria]);

  const orderedTypes = useMemo(() => {
    return PREFERENCE_TYPE_ORDER.filter((t) => groupedByType.has(t));
  }, [groupedByType]);

  const TAB_ITEMS: { key: BrainTab; label: string }[] = [
    { key: 'memories', label: 'What I Know' },
    { key: 'learned', label: "What I've Learned" },
    { key: 'activity', label: 'Activity' },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col p-1 gap-1 md:p-[7px] md:gap-[7px] overflow-hidden"
      style={{
        backgroundImage: "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url('/img/landing_background.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <GlassNavbar />

      {/* Main content */}
      <div className="flex-1 min-h-0 flex gap-1 md:gap-[7px] overflow-hidden">

        {/* Left sidebar: Domain tree — glass panel, desktop only, only for "learned" tab */}
        {activeTab === 'learned' && (
          <div className="hidden md:flex flex-col w-[220px] flex-shrink-0 bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 overflow-hidden">
            <div className="px-3 py-2 border-b border-white/[0.06] flex-shrink-0">
              <span className="font-mono text-[9px] uppercase tracking-wide text-white/40">
                Domains
              </span>
            </div>
            <div className="overflow-y-auto flex-1">
              <DomainTree
                domains={domainTree}
                selected={selectedDomain}
                total={initialCriteria.length}
                onSelect={setSelectedDomain}
              />
            </div>
          </div>
        )}

        {/* Center: main content — glass panel, scrollable */}
        <div className="flex-1 min-w-0 bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 overflow-y-auto p-4 md:p-6">
          {/* Page header */}
          <div className="mb-4">
            <h1 className="text-lg font-medium text-white/90 tracking-tight">Brain</h1>
            <p className="font-mono text-[10px] text-white/30 uppercase tracking-wide mt-1">
              {initialMemoryCount ?? '–'} memories · {criteria.length} preferences · {initialSignals.length} signals
            </p>
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-0 mb-6 border-b border-white/[0.06]">
            {TAB_ITEMS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'font-mono text-[10px] uppercase tracking-wide px-4 py-2.5 transition-colors border-b-2 -mb-px',
                  activeTab === tab.key
                    ? 'text-white/80 border-white/40'
                    : 'text-white/35 border-transparent hover:text-white/55 hover:border-white/15'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'memories' && <WhatIKnowTab />}

          {activeTab === 'learned' && (
            <>
              {/* Search bar for learned preferences */}
              <div className="mb-4">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20 text-xs pointer-events-none">🔍</span>
                  <input
                    type="text"
                    value={criteriaSearch}
                    onChange={(e) => setCriteriaSearch(e.target.value)}
                    placeholder="Search preferences..."
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-[2px] pl-8 pr-3 py-1.5 text-xs font-mono text-white/70 placeholder:text-white/20 outline-none focus:border-white/[0.15] transition-colors"
                  />
                  {criteriaSearch && (
                    <button
                      onClick={() => setCriteriaSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Mobile domain filter */}
              <div className="md:hidden mb-4">
                <select
                  value={selectedDomain || ''}
                  onChange={(e) => setSelectedDomain(e.target.value || null)}
                  className="w-full bg-white/[0.05] border border-white/[0.1] text-white/70 text-xs px-3 py-2 font-mono"
                >
                  <option value="">All domains ({criteria.length})</option>
                  {domainTree.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name} ({d.count})
                    </option>
                  ))}
                </select>
              </div>

              {filteredCriteria.length === 0 ? (
                <div className="bg-white/[0.05] border border-white/[0.09] rounded-[2px] p-8 text-center">
                  <p className="text-sm text-white/40">
                    No preferences learned yet.
                  </p>
                  <p className="text-xs text-white/25 mt-2">
                    Keep chatting — the Brain learns from your interactions.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {orderedTypes.map((type) => {
                    const criteria = groupedByType.get(type) || [];
                    return (
                      <div key={type}>
                        <div className="flex items-center gap-2 mb-3">
                          <h2 className="font-mono text-[10px] uppercase tracking-wide text-white/50">
                            {PREFERENCE_TYPE_LABELS[type]}
                          </h2>
                          <span className="font-mono text-[8px] text-white/20">
                            {criteria.length}
                          </span>
                          <div className="flex-1 h-px bg-white/[0.05]" />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {criteria.map((criterion) => (
                            <CriterionCard
                              key={criterion.id}
                              criterion={criterion}
                              signals={initialSignals}
                              onWeightChange={handleCriterionWeightChange}
                              onDelete={handleCriterionDelete}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'activity' && (
            <ActivityTab signals={initialSignals} patterns={initialPatterns} />
          )}
        </div>
      </div>
    </div>
  );
}
