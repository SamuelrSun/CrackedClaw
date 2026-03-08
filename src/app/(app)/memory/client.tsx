"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MemoryEntrySkeleton } from "@/components/skeletons/list-skeleton";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import { useFormValidation } from "@/hooks/use-form-validation";
import { validateRequired, validateMaxLength, composeValidators } from "@/lib/validation";
import { MemoryEntry } from "@/lib/mock-data";
import type { GatewayMemoryResponse, GatewayMemoryEntry } from "@/types/gateway";
import Link from "next/link";
import { X } from "lucide-react";

interface MemoryPageClientProps {
  initialEntries: MemoryEntry[];
}

// Convert gateway entries to display format
function toDisplayEntry(entry: GatewayMemoryEntry): MemoryEntry {
  return {
    id: entry.id,
    content: entry.content,
    category: entry.category || entry.source || 'Memory',
    createdAt: entry.createdAt || entry.date || 'Unknown',
  };
}

export default function MemoryPageClient({ initialEntries }: MemoryPageClientProps) {
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<MemoryEntry[]>(initialEntries);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingMemory, setAddingMemory] = useState(false);

  // Form validation for adding memory
  const addMemoryForm = useFormValidation({
    fields: {
      title: (v) => validateMaxLength(v, 100, "Title"),
      content: composeValidators(
        (v) => validateRequired(v, "Content"),
      ),
    },
    onSubmit: handleAddMemory,
  });

  async function handleAddMemory(values: { title: string; content: string }) {
    setAddingMemory(true);
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.title || undefined,
          content: values.content,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        // Add new entry to list
        setEntries(prev => [{
          id: data.id || Date.now().toString(),
          content: values.content,
          category: values.title || 'Memory',
          createdAt: new Date().toLocaleDateString(),
        }, ...prev]);
        setShowAddForm(false);
        addMemoryForm.reset();
      }
    } catch (err) {
      console.error('Failed to add memory:', err);
    } finally {
      setAddingMemory(false);
    }
  }

  // Fetch live memory from gateway on mount
  useEffect(() => {
    async function fetchMemory() {
      try {
        const res = await fetch('/api/gateway/memory');
        const data: GatewayMemoryResponse = await res.json();
        
        if (data.source === 'live' && data.entries.length > 0) {
          setEntries(data.entries.map(toDisplayEntry));
          setIsLive(true);
        } else {
          // Keep initial entries, show warning if there was an error
          if (data.error) {
            setError(data.error);
          }
          setIsLive(false);
        }
      } catch (err) {
        console.error('Failed to fetch memory:', err);
        setError('Failed to connect to gateway');
      } finally {
        setIsLoading(false);
      }
    }
    fetchMemory();
  }, []);

  const filtered = entries.filter(
    (e) =>
      e.content.toLowerCase().includes(search.toLowerCase()) ||
      e.category.toLowerCase().includes(search.toLowerCase())
  );

  const hasEntries = entries.length > 0;
  const entriesLabel = hasEntries ? "Entries (" + filtered.length + ")" : "Entries";

  return (
    <div className="p-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-header text-3xl font-bold tracking-tight leading-tight">
              Memory
            </h1>
            {isLoading ? (
              <span className="font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 bg-[#F4D35E]/20 text-[#8B7000] border border-[#F4D35E]/30 animate-pulse">
                Syncing...
              </span>
            ) : isLive ? (
              <span className="font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 bg-[#9EFFBF]/20 text-[#1A3C2B] border border-[#9EFFBF]/30">
                Live
              </span>
            ) : null}
          </div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mt-1">
            Agent knowledge base {isLive ? '• Connected to OpenClaw' : ''}
          </p>
        </div>
        <Button variant="solid" onClick={() => setShowAddForm(true)}>Add Memory</Button>
      </div>

      {error && !isLive && (
        <div className="mb-4 p-3 bg-[#F4D35E]/10 border border-[#F4D35E]/30 rounded-none">
          <p className="font-mono text-[10px] text-grid/70">
            <span className="font-bold">Note:</span> {error}
          </p>
        </div>
      )}

      {/* Add Memory Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[rgba(58,58,56,0.2)] w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-[rgba(58,58,56,0.1)]">
              <h2 className="font-header text-lg font-bold">Add Memory</h2>
              <button 
                onClick={() => {
                  setShowAddForm(false);
                  addMemoryForm.reset();
                }}
                className="text-grid/50 hover:text-forest transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={addMemoryForm.handleSubmit} className="p-4 space-y-4">
              {/* Form Error Summary */}
              {addMemoryForm.formErrors.length > 0 && (
                <FormErrorSummary 
                  errors={addMemoryForm.formErrors}
                  onScrollToFirst={addMemoryForm.scrollToFirstError}
                />
              )}
              
              <Input
                label="Title (optional)"
                placeholder="Give this memory a title..."
                value={addMemoryForm.values.title}
                onChange={addMemoryForm.handleChange("title")}
                onBlur={addMemoryForm.handleBlur("title")}
                error={addMemoryForm.errors.title}
                touched={addMemoryForm.touched.title}
              />
              
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
                  Content
                </label>
                <textarea
                  className={`w-full bg-white border rounded-none px-3 py-2 font-body text-sm text-forest placeholder:text-grid/30 outline-none transition-colors min-h-[120px] resize-none ${
                    addMemoryForm.errors.content && addMemoryForm.touched.content
                      ? "border-coral focus:border-coral"
                      : "border-[rgba(58,58,56,0.2)] focus:border-forest"
                  }`}
                  placeholder="What do you want to remember..."
                  value={addMemoryForm.values.content}
                  onChange={addMemoryForm.handleChange("content")}
                  onBlur={addMemoryForm.handleBlur("content")}
                />
                {addMemoryForm.errors.content && addMemoryForm.touched.content && (
                  <span className="font-mono text-[11px] text-coral">
                    {addMemoryForm.errors.content}
                  </span>
                )}
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    addMemoryForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="solid" 
                  size="sm"
                  disabled={addingMemory || !addMemoryForm.isValid}
                >
                  {addingMemory ? "Saving..." : "Save Memory"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {hasEntries && !isLoading && (
        <div className="mb-6 max-w-md">
          <Input
            label="Search memories"
            placeholder="Filter by content or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {isLoading && (
        <div className="mb-6 max-w-md">
          <Skeleton className="h-2.5 w-24 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-[rgba(58,58,56,0.2)]">
        {/* Memory Entries */}
        <div className="col-span-1">
          <Card label={isLoading ? "Entries" : entriesLabel} accentColor="#1A3C2B" bordered={false}>
            {isLoading ? (
              <div className="mt-2">
                <MemoryEntrySkeleton rows={5} />
              </div>
            ) : hasEntries ? (
              <div className="space-y-4 mt-2 max-h-[600px] overflow-y-auto">
                {filtered.map((entry) => (
                  <div
                    key={entry.id}
                    className="border-b border-[rgba(58,58,56,0.1)] pb-3 last:border-0"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] uppercase tracking-wide bg-forest/5 px-2 py-0.5 border border-[rgba(58,58,56,0.1)]">
                        {entry.category}
                      </span>
                      <span className="font-mono text-[9px] text-grid/40">
                        {entry.createdAt}
                      </span>
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{entry.content}</p>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <p className="text-sm text-grid/40">No memories match your search.</p>
                )}
              </div>
            ) : (
              <div className="py-12 text-center">
                <div className="w-12 h-12 mx-auto mb-3 border border-[rgba(58,58,56,0.2)] flex items-center justify-center">
                  <span className="text-xl">🧠</span>
                </div>
                <p className="text-sm text-grid/50 mb-2">No memories yet</p>
                <p className="font-mono text-[10px] text-grid/40 max-w-xs mx-auto">
                  Memories will appear here as your agent learns about you, your preferences, and your work.
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Instructions */}
        <div className="col-span-1">
          <Card label="Instructions" accentColor="#FF8C69" bordered={false}>
            {isLoading ? (
              <div className="mt-2 space-y-3">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <div className="border border-[rgba(58,58,56,0.2)] bg-white p-4 mt-3">
                  <Skeleton className="h-3 w-full mb-2" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
                <Skeleton className="h-8 w-32 mt-3" />
              </div>
            ) : (
              <div className="mt-2 space-y-3">
                <p className="text-sm text-grid/70">
                  Custom instructions that guide how your agent behaves. Edit these to
                  fine-tune responses.
                </p>
                <div className="border border-[rgba(58,58,56,0.2)] bg-white p-4 rounded-none">
                  <p className="text-sm leading-relaxed text-grid/50 italic">
                    No custom instructions set. Add instructions to personalize how your agent responds.
                  </p>
                </div>
                <Button variant="ghost" size="sm">Edit Instructions</Button>
              </div>
            )}
          </Card>

          {/* Gateway Connection CTA (shown when not live) */}
          {!isLive && !isLoading && (
            <Card label="Connect Your Agent" accentColor="#9EFFBF" bordered={false} className="mt-px">
              <div className="mt-2 space-y-3">
                <p className="text-sm text-grid/70">
                  Connect your OpenClaw gateway to sync real memory from your agent.
                  Your MEMORY.md and daily notes will appear here.
                </p>
                <Link href="/settings">
                  <Button variant="solid" size="sm">Connect OpenClaw</Button>
                </Link>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
