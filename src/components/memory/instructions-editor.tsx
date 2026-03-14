"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface InstructionsEditorProps {
  initialContent?: string;
  onSave?: (content: string) => void;
}

const DEFAULT_PLACEHOLDER = `Add instructions to customize your agent's behavior...

Example instructions:
- Keep responses concise and actionable
- Use bullet points for lists
- Match a professional but friendly tone`;

export function InstructionsEditor({ initialContent, onSave }: InstructionsEditorProps) {
  const [content, setContent] = useState(initialContent || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  // Sync with initial content when it changes
  useEffect(() => {
    if (initialContent !== undefined) {
      setContent(initialContent);
    }
  }, [initialContent]);

  const handleEdit = useCallback(() => {
    setEditContent(content);
    setIsEditing(true);
    setError(null);
  }, [content]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditContent("");
    setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save instructions");
      }

      setContent(editContent);
      setIsEditing(false);
      setShowSaved(true);
      onSave?.(editContent);

      // Hide "Saved!" after 2 seconds
      setTimeout(() => setShowSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }, [editContent, onSave]);

  const hasContent = content.trim().length > 0;

  if (isEditing) {
    return (
      <div className="mt-2 space-y-3">
        <p className="text-sm text-grid/70">
          Custom instructions that guide how your agent behaves.
        </p>
        <div className="relative">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder={DEFAULT_PLACEHOLDER}
            className="w-full min-h-[200px] p-4 bg-white border border-white/[0.1] rounded-none font-mono text-sm leading-relaxed resize-y focus:outline-none focus:border-forest/50 transition-colors"
            autoFocus
          />
          <div className="absolute bottom-2 right-2 font-mono text-[9px] text-grid/40">
            {editContent.length} chars
          </div>
        </div>
        {error && (
          <p className="font-mono text-[10px] text-coral">{error}</p>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="solid"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-3">
      <p className="text-sm text-grid/70">
        Custom instructions that guide how your agent behaves. Edit these to
        fine-tune responses.
      </p>
      <div className="border border-white/[0.1] bg-white p-4 rounded-none">
        {hasContent ? (
          <p className="text-sm leading-relaxed font-mono whitespace-pre-wrap">
            {content}
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-grid/50 italic">
            No custom instructions set. Add instructions to personalize how your agent responds.
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={handleEdit}>
          {hasContent ? "Edit Instructions" : "Add Instructions"}
        </Button>
        {showSaved && (
          <span className="font-mono text-[10px] text-white/80 bg-mint/30 px-2 py-1">
            Saved!
          </span>
        )}
      </div>
    </div>
  );
}
