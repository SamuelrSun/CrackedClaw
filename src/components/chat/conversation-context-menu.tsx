"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ConversationPickerModal } from "./conversation-picker-modal";

interface LinkedConvo {
  id: string;
  title: string;
  link_type: string;
  link_id: string;
}

interface ConversationContextMenuProps {
  conversationId: string;
  conversationTitle?: string;
  /** Called when the menu requests the linked list to refresh */
  onLinksChanged?: () => void;
  className?: string;
}

export function ConversationContextMenu({
  conversationId,
  conversationTitle,
  onLinksChanged,
  className,
}: ConversationContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [linkedConvos, setLinkedConvos] = useState<LinkedConvo[]>([]);
  const [showLinked, setShowLinked] = useState(false);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const loadLinked = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/context`);
      if (res.ok) {
        const data = await res.json();
        setLinkedConvos(data.linked_conversations || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleOpen = async () => {
    setOpen(true);
    await loadLinked();
  };

  const handleUnlink = async (targetId: string) => {
    await fetch(`/api/conversations/${conversationId}/context`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_id: targetId }),
    });
    await loadLinked();
    onLinksChanged?.();
  };

  const handleLink = async (selectedIds: string[], linkType: string) => {
    await Promise.all(
      selectedIds.map((targetId) =>
        fetch(`/api/conversations/${conversationId}/context`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_id: targetId, link_type: linkType }),
        })
      )
    );
    await loadLinked();
    onLinksChanged?.();
  };

  return (
    <div ref={menuRef} className={cn("relative", className)}>
      <button
        onClick={handleOpen}
        className="p-1 text-grid/30 hover:text-grid/60 transition-colors leading-none text-sm"
        title="Conversation options"
      >
        •••
      </button>

      {open && (
        <div className="absolute right-0 top-6 z-30 w-52 bg-paper border border-[rgba(58,58,56,0.2)] shadow-lg">
          {/* Link option */}
          <button
            className="w-full text-left px-4 py-2.5 text-xs hover:bg-forest/5 transition-colors flex items-center gap-2"
            onClick={() => {
              setOpen(false);
              setPickerOpen(true);
            }}
          >
            <span>🔗</span>
            <span>Link to conversation...</span>
          </button>

          {/* View linked */}
          <button
            className="w-full text-left px-4 py-2.5 text-xs hover:bg-forest/5 transition-colors flex items-center gap-2"
            onClick={() => setShowLinked((v) => !v)}
          >
            <span>📋</span>
            <span>
              {loading
                ? "Loading..."
                : linkedConvos.length > 0
                ? `Linked (${linkedConvos.length})`
                : "View linked conversations"}
            </span>
            {linkedConvos.length > 0 && (
              <span className="ml-auto font-mono text-[9px]">
                {showLinked ? "▲" : "▼"}
              </span>
            )}
          </button>

          {/* Linked list */}
          {showLinked && linkedConvos.length > 0 && (
            <div className="border-t border-[rgba(58,58,56,0.1)] bg-grid/5">
              {linkedConvos.map((lc) => (
                <div
                  key={lc.id}
                  className="px-4 py-2 flex items-center justify-between gap-2"
                >
                  <span className="text-xs text-forest truncate">{lc.title}</span>
                  <button
                    onClick={() => handleUnlink(lc.id)}
                    className="font-mono text-[9px] text-grid/40 hover:text-red-500 transition-colors flex-shrink-0 uppercase tracking-wide"
                  >
                    Unlink
                  </button>
                </div>
              ))}
            </div>
          )}

          {showLinked && linkedConvos.length === 0 && !loading && (
            <div className="px-4 py-2 border-t border-[rgba(58,58,56,0.1)] bg-grid/5">
              <p className="text-xs text-grid/40">No linked conversations</p>
            </div>
          )}
        </div>
      )}

      {/* Picker Modal */}
      <ConversationPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentConversationId={conversationId}
        onLink={handleLink}
        alreadyLinkedIds={linkedConvos.map((l) => l.id)}
      />
    </div>
  );
}
