"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ConversationOption {
  id: string;
  title: string;
  lastMessage?: string;
  timestamp?: string;
}

interface ConversationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConversationId: string;
  onLink: (selectedIds: string[], linkType: string) => Promise<void>;
  alreadyLinkedIds?: string[];
}

export function ConversationPickerModal({
  isOpen,
  onClose,
  currentConversationId,
  onLink,
  alreadyLinkedIds = [],
}: ConversationPickerModalProps) {
  const [conversations, setConversations] = useState<ConversationOption[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [linkType, setLinkType] = useState("context");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        const convos: ConversationOption[] = (data.conversations || [])
          .filter((c: ConversationOption) => c.id !== currentConversationId)
          .map((c: ConversationOption) => ({
            id: c.id,
            title: c.title || "Untitled",
            lastMessage: c.lastMessage || "",
            timestamp: c.timestamp,
          }));
        setConversations(convos);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [currentConversationId]);

  useEffect(() => {
    if (isOpen) {
      loadConversations();
      setSelected(new Set());
      setSearch("");
    }
  }, [isOpen, loadConversations]);

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c.lastMessage || "").toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLink = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await onLink(Array.from(selected), linkType);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (ts?: string) => {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
    } catch {
      return ts;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-paper border border-white/[0.1] w-full max-w-md mx-4 shadow-lg flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-header text-sm font-bold text-forest">Link Conversation</h3>
            <p className="font-mono text-[10px] text-grid/50 mt-0.5">
              Selected conversation will share context with this one
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-grid/40 hover:text-grid/60 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-white border border-white/[0.1] px-3 py-2 text-sm outline-none focus:border-forest transition-colors placeholder:text-grid/30"
            autoFocus
          />
        </div>

        {/* Link type selector */}
        <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-3 flex-shrink-0">
          <span className="font-mono text-[10px] text-grid/50 uppercase tracking-wide flex-shrink-0">Type:</span>
          {(["context", "continuation", "reference"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setLinkType(type)}
              className={cn(
                "font-mono text-[9px] uppercase tracking-wide px-2 py-0.5 transition-colors",
                linkType === type
                  ? "bg-forest text-white"
                  : "text-grid/50 hover:text-forest border border-white/[0.1]"
              )}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-8 text-center">
              <p className="font-mono text-[10px] text-grid/40 uppercase tracking-wide animate-pulse">
                Loading...
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-grid/50">No conversations found</p>
            </div>
          ) : (
            filtered.map((convo) => {
              const isLinked = alreadyLinkedIds.includes(convo.id);
              const isSelected = selected.has(convo.id);
              return (
                <button
                  key={convo.id}
                  onClick={() => !isLinked && toggleSelect(convo.id)}
                  disabled={isLinked}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-white/[0.06] transition-colors flex items-start gap-3",
                    isLinked
                      ? "opacity-50 cursor-not-allowed bg-grid/5"
                      : isSelected
                      ? "bg-forest/5 border-l-2 border-l-forest"
                      : "hover:bg-forest/[0.02]"
                  )}
                >
                  {/* Checkbox */}
                  <div
                    className={cn(
                      "mt-0.5 w-4 h-4 border flex-shrink-0 flex items-center justify-center transition-colors",
                      isSelected
                        ? "bg-forest border-forest"
                        : "border-white/[0.15]"
                    )}
                  >
                    {isSelected && (
                      <span className="text-white text-[8px] leading-none">✓</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-forest truncate">
                        {convo.title}
                        {isLinked && (
                          <span className="ml-1.5 font-mono text-[9px] text-grid/40 normal-case tracking-normal">
                            (already linked)
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-[9px] text-grid/30 flex-shrink-0">
                        {formatDate(convo.timestamp)}
                      </span>
                    </div>
                    {convo.lastMessage && (
                      <p className="text-xs text-grid/50 truncate mt-0.5">
                        {convo.lastMessage}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/[0.08] flex items-center justify-between flex-shrink-0">
          <span className="font-mono text-[10px] text-grid/40">
            {selected.size > 0 ? `${selected.size} selected` : "Select conversations to link"}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="solid"
              size="sm"
              onClick={handleLink}
              disabled={selected.size === 0 || saving}
            >
              {saving ? "Linking..." : "Link Selected"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
