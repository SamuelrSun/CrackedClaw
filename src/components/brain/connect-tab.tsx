'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  last_used_at: string | null;
  request_count: number;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function isActiveWithin24h(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000;
}

// ─── Setup Guides ────────────────────────────────────────────────────────────

const SETUP_GUIDES: { key: string; emoji: string; name: string; code: string }[] = [
  {
    key: 'claude-code',
    emoji: '🤖',
    name: 'Claude Code',
    code: `claude mcp add dopl-brain \\
  --transport http \\
  https://usedopl.com/api/brain/mcp \\
  -- --header "Authorization:Bearer YOUR_API_KEY"`,
  },
  {
    key: 'cursor',
    emoji: '⚡',
    name: 'Cursor',
    code: `// Add to .cursor/mcp.json
{
  "mcpServers": {
    "dopl-brain": {
      "url": "https://usedopl.com/api/brain/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`,
  },
  {
    key: 'vscode',
    emoji: '💻',
    name: 'VS Code (Copilot)',
    code: `// Add to .vscode/mcp.json
{
  "servers": {
    "dopl-brain": {
      "type": "http",
      "url": "https://usedopl.com/api/brain/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`,
  },
  {
    key: 'chatgpt',
    emoji: '💬',
    name: 'ChatGPT (Custom GPT)',
    code: `1. Go to chat.openai.com → Explore GPTs → Create
2. In "Configure" → Actions → Add Action
3. Import the OpenAPI spec from:
   https://usedopl.com/api/brain/v1/openapi.json
4. Set Authentication: API Key, Header "Authorization", Value "Bearer YOUR_API_KEY"`,
  },
  {
    key: 'openclaw',
    emoji: '🦞',
    name: 'OpenClaw',
    code: `// Add to openclaw.json
{
  "plugins": {
    "config": {
      "dopl-brain": {
        "apiKey": "YOUR_API_KEY",
        "endpoint": "https://usedopl.com/api/brain/v1"
      }
    }
  }
}`,
  },
];

// ─── Copy Button ─────────────────────────────────────────────────────────────

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.1] text-white/70 text-[10px] font-mono px-2 py-1 rounded-[2px] transition-colors',
        className,
      )}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

// ─── Chevron Icon ────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={cn('w-3 h-3 text-white/40 transition-transform duration-200', open && 'rotate-90')}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ─── Connect Tab ─────────────────────────────────────────────────────────────

export function ConnectTab() {
  // API Keys state
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  // Setup guides state
  const [expandedGuides, setExpandedGuides] = useState<Set<string>>(new Set());

  // ─── Fetch keys ──────────────────────────────────────────────────────────

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/brain/keys');
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys ?? data ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // ─── Generate key ────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!newKeyName.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/brain/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedKey(data.key);
        await fetchKeys();
      }
    } catch {
      // silently fail
    } finally {
      setGenerating(false);
    }
  }, [newKeyName, fetchKeys]);

  const handleDismissGenerated = useCallback(() => {
    setGeneratedKey(null);
    setNewKeyName('');
    setCreating(false);
  }, []);

  // ─── Revoke key ──────────────────────────────────────────────────────────

  const handleRevoke = useCallback(
    async (id: string) => {
      if (!confirm('Revoke this API key? Any integrations using it will stop working.')) return;
      setRevoking(id);
      try {
        const res = await fetch(`/api/brain/keys/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setKeys((prev) => prev.filter((k) => k.id !== id));
        }
      } catch {
        // silently fail
      } finally {
        setRevoking(null);
      }
    },
    [],
  );

  // ─── Toggle guide ────────────────────────────────────────────────────────

  const toggleGuide = useCallback((key: string) => {
    setExpandedGuides((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-2xl">
      {/* ── Section A: API Keys ─────────────────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-[3px]">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wide text-white/40">
            API Keys
          </span>
          {!creating && !generatedKey && (
            <button
              onClick={() => setCreating(true)}
              className="bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.1] text-white/70 text-xs font-mono px-3 py-1.5 rounded-[2px] transition-colors"
            >
              + Create New Key
            </button>
          )}
        </div>

        <div className="p-4 space-y-3">
          {/* Create new key form */}
          {creating && !generatedKey && (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-[2px] p-3 space-y-3">
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. Claude Code, Cursor..."
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-[2px] px-3 py-1.5 text-xs font-mono text-white/70 placeholder:text-white/20 outline-none focus:border-white/[0.15]"
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={generating || !newKeyName.trim()}
                  className={cn(
                    'bg-white/[0.12] hover:bg-white/[0.18] border border-white/[0.1] text-white/80 text-xs font-mono px-3 py-1.5 rounded-[2px] transition-colors',
                    (generating || !newKeyName.trim()) && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  {generating ? 'Generating...' : 'Generate'}
                </button>
                <button
                  onClick={() => {
                    setCreating(false);
                    setNewKeyName('');
                  }}
                  className="bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.1] text-white/70 text-xs font-mono px-3 py-1.5 rounded-[2px] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Generated key display (shown once) */}
          {generatedKey && (
            <div className="space-y-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[2px] p-3 flex items-center gap-2">
                <code className="font-mono text-sm text-emerald-400 flex-1 break-all">
                  {generatedKey}
                </code>
                <CopyButton text={generatedKey} />
              </div>
              <p className="text-[11px] text-amber-400/70 font-mono">
                ⚠ Copy this key now — you won&apos;t be able to see it again.
              </p>
              <button
                onClick={handleDismissGenerated}
                className="bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.1] text-white/70 text-xs font-mono px-3 py-1.5 rounded-[2px] transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {/* Keys list */}
          {loading ? (
            <p className="text-xs text-white/30 font-mono">Loading keys...</p>
          ) : keys.length === 0 && !creating && !generatedKey ? (
            <p className="text-xs text-white/30 font-mono">
              No API keys yet. Create one to connect your tools.
            </p>
          ) : (
            <div className="space-y-1">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center gap-3 px-3 py-2 bg-white/[0.02] border border-white/[0.05] rounded-[2px] group"
                >
                  {/* Active indicator */}
                  <div
                    className={cn(
                      'w-1.5 h-1.5 rounded-full flex-shrink-0',
                      isActiveWithin24h(k.last_used_at) ? 'bg-emerald-400' : 'bg-white/10',
                    )}
                  />

                  {/* Prefix */}
                  <code className="font-mono text-[11px] text-white/50 w-[90px] flex-shrink-0">
                    {k.prefix}...
                  </code>

                  {/* Name */}
                  <span className="text-xs text-white/60 flex-1 truncate">{k.name}</span>

                  {/* Last used */}
                  <span className="text-[10px] text-white/30 font-mono hidden sm:block">
                    {relativeTime(k.last_used_at)}
                  </span>

                  {/* Request count */}
                  <span className="text-[10px] text-white/30 font-mono hidden sm:block w-[60px] text-right">
                    {k.request_count} req
                  </span>

                  {/* Revoke */}
                  <button
                    onClick={() => handleRevoke(k.id)}
                    disabled={revoking === k.id}
                    className={cn(
                      'bg-white/[0.08] hover:bg-red-500/20 border border-white/[0.1] hover:border-red-500/30 text-white/70 hover:text-red-400 text-[10px] font-mono px-2 py-1 rounded-[2px] transition-colors opacity-0 group-hover:opacity-100',
                      revoking === k.id && 'opacity-40 cursor-not-allowed',
                    )}
                  >
                    {revoking === k.id ? '...' : 'Revoke'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Section B: Quick Setup Guides ───────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-[3px]">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <span className="font-mono text-[10px] uppercase tracking-wide text-white/40">
            Quick Setup Guides
          </span>
        </div>

        <div className="divide-y divide-white/[0.05]">
          {SETUP_GUIDES.map((guide) => {
            const isOpen = expandedGuides.has(guide.key);
            return (
              <div key={guide.key}>
                <button
                  onClick={() => toggleGuide(guide.key)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
                >
                  <ChevronIcon open={isOpen} />
                  <span className="text-base">{guide.emoji}</span>
                  <span className="text-xs text-white/70 font-mono">{guide.name}</span>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pl-12">
                    <div className="relative">
                      <pre className="bg-black/30 border border-white/[0.06] rounded-[2px] p-3 font-mono text-[11px] text-white/60 overflow-x-auto whitespace-pre-wrap">
                        {guide.code}
                      </pre>
                      <div className="absolute top-2 right-2">
                        <CopyButton text={guide.code} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
