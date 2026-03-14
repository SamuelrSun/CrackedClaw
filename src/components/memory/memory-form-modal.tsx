"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MemoryEntry } from "@/lib/mock-data";

const CATEGORIES = [
  "Preferences",
  "Projects",
  "Tools",
  "Schedule",
  "Contacts",
  "Other",
];

interface MemoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { title?: string; content: string; category: string }) => Promise<void>;
  entry?: MemoryEntry | null;
}

export function MemoryFormModal({
  isOpen,
  onClose,
  onSave,
  entry,
}: MemoryFormModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!entry;

  // Reset form when modal opens/closes or entry changes
  useEffect(() => {
    if (isOpen) {
      if (entry) {
        setTitle(""); // No title field in existing entries
        setContent(entry.content);
        setCategory(entry.category || CATEGORIES[0]);
      } else {
        setTitle("");
        setContent("");
        setCategory(CATEGORIES[0]);
      }
      setError(null);
    }
  }, [isOpen, entry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!content.trim()) {
      setError("Content is required");
      return;
    }

    setIsLoading(true);
    try {
      await onSave({
        title: title.trim() || undefined,
        content: content.trim(),
        category,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save memory");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Memory" : "Add Memory"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title (optional) */}
        <Input
          label="Title (optional)"
          placeholder="Brief title for this memory..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {/* Content (required) */}
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
            Content <span className="text-coral">*</span>
          </label>
          <textarea
            className={`
              w-full bg-white border border-white/[0.1] rounded-none px-3 py-2
              font-body text-sm text-forest placeholder:text-grid/30
              outline-none focus:border-forest transition-colors
              min-h-[120px] resize-y
            `}
            placeholder="What should your agent remember?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
        </div>

        {/* Category dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
            Category
          </label>
          <select
            className={`
              w-full bg-white border border-white/[0.1] rounded-none px-3 py-2
              font-body text-sm text-forest
              outline-none focus:border-forest transition-colors
              cursor-pointer
            `}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Error message */}
        {error && (
          <p className="text-sm text-coral">{error}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" variant="solid" disabled={isLoading}>
            {isLoading ? "Saving..." : isEditing ? "Save Changes" : "Add Memory"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
