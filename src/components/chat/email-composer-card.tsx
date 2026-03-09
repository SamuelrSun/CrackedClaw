"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { EmailDraft } from "@/lib/email/gmail-client";

export interface EmailComposerCardProps {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  from?: string;
  integration: 'google' | 'microsoft';
  onSend: (email: EmailDraft) => Promise<void>;
  onSaveDraft: (email: EmailDraft) => Promise<void>;
}

type CardState = 'preview' | 'edit' | 'sending' | 'sent';

export function EmailComposerCard({
  to: initialTo,
  cc: initialCc,
  bcc: initialBcc,
  subject: initialSubject,
  body: initialBody,
  from,
  integration,
  onSend,
  onSaveDraft,
}: EmailComposerCardProps) {
  const [state, setState] = useState<CardState>('preview');
  const [draft, setDraft] = useState<EmailDraft>({
    to: initialTo,
    cc: initialCc,
    bcc: initialBcc,
    subject: initialSubject,
    body: initialBody,
    from,
    integration,
  });
  const [editDraft, setEditDraft] = useState<EmailDraft>(draft);
  const [showCc, setShowCc] = useState(!!(initialCc?.length || initialBcc?.length));
  const [savingDraft, setSavingDraft] = useState(false);

  const handleSend = async () => {
    setState('sending');
    try {
      await onSend(draft);
      setState('sent');
    } catch {
      setState('preview');
    }
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      await onSaveDraft(draft);
    } finally {
      setSavingDraft(false);
    }
  };

  const handleEditDone = () => {
    setDraft(editDraft);
    setState('preview');
  };

  const handleEditCancel = () => {
    setEditDraft(draft);
    setState('preview');
  };

  const isSent = state === 'sent';
  const isSending = state === 'sending';
  const isEditing = state === 'edit';

  return (
    <div
      className={cn(
        "rounded-xl border bg-white shadow-sm overflow-hidden transition-all",
        isSent ? "border-l-4 border-l-green-500 border-green-200" : "border-zinc-200"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <span className="text-base">📧</span>
          <span className="text-sm font-semibold text-zinc-700">Draft Email</span>
          {isSent && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              Sent ✓
            </span>
          )}
        </div>
        {!isSent && !isEditing && (
          <button
            onClick={() => { setEditDraft(draft); setState('edit'); }}
            className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      {/* To / Subject fields */}
      <div className="border-b border-zinc-100 bg-zinc-50/50">
        <div className="flex items-center px-4 py-2 gap-2 border-b border-zinc-100">
          <span className="text-xs font-medium text-zinc-400 w-14 shrink-0">To</span>
          {isEditing ? (
            <input
              className="flex-1 text-sm text-zinc-800 bg-transparent outline-none"
              value={editDraft.to.join(', ')}
              onChange={e => setEditDraft(d => ({ ...d, to: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
              placeholder="recipient@example.com"
            />
          ) : (
            <span className="flex-1 text-sm text-zinc-800 truncate">{draft.to.join(', ')}</span>
          )}
          {!isEditing && (
            <button
              onClick={() => setShowCc(v => !v)}
              className="text-xs text-zinc-400 hover:text-zinc-600 ml-2"
            >
              Cc
            </button>
          )}
        </div>

        {showCc && (
          <>
            <div className="flex items-center px-4 py-2 gap-2 border-b border-zinc-100">
              <span className="text-xs font-medium text-zinc-400 w-14 shrink-0">Cc</span>
              {isEditing ? (
                <input
                  className="flex-1 text-sm text-zinc-800 bg-transparent outline-none"
                  value={(editDraft.cc || []).join(', ')}
                  onChange={e => setEditDraft(d => ({ ...d, cc: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                  placeholder="cc@example.com"
                />
              ) : (
                <span className="flex-1 text-sm text-zinc-600">{(draft.cc || []).join(', ')}</span>
              )}
            </div>
            <div className="flex items-center px-4 py-2 gap-2 border-b border-zinc-100">
              <span className="text-xs font-medium text-zinc-400 w-14 shrink-0">Bcc</span>
              {isEditing ? (
                <input
                  className="flex-1 text-sm text-zinc-800 bg-transparent outline-none"
                  value={(editDraft.bcc || []).join(', ')}
                  onChange={e => setEditDraft(d => ({ ...d, bcc: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                  placeholder="bcc@example.com"
                />
              ) : (
                <span className="flex-1 text-sm text-zinc-600">{(draft.bcc || []).join(', ')}</span>
              )}
            </div>
          </>
        )}

        <div className="flex items-center px-4 py-2 gap-2">
          <span className="text-xs font-medium text-zinc-400 w-14 shrink-0">Subject</span>
          {isEditing ? (
            <input
              className="flex-1 text-sm font-medium text-zinc-800 bg-transparent outline-none"
              value={editDraft.subject}
              onChange={e => setEditDraft(d => ({ ...d, subject: e.target.value }))}
              placeholder="Subject"
            />
          ) : (
            <span className="flex-1 text-sm font-medium text-zinc-800 truncate">{draft.subject}</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 min-h-[120px] max-h-[300px] overflow-y-auto">
        {isEditing ? (
          <textarea
            className="w-full text-sm text-zinc-700 bg-transparent outline-none resize-none min-h-[120px] leading-relaxed"
            value={editDraft.body}
            onChange={e => setEditDraft(d => ({ ...d, body: e.target.value }))}
            placeholder="Email body..."
          />
        ) : (
          <div
            className="text-sm text-zinc-700 leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: draft.body }}
          />
        )}
      </div>

      {/* Actions */}
      {!isSent && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-zinc-100 bg-zinc-50/50">
          {isEditing ? (
            <>
              <button
                onClick={handleEditDone}
                className="text-sm px-3 py-1.5 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
              >
                Done
              </button>
              <button
                onClick={handleEditCancel}
                className="text-sm px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setEditDraft(draft); setState('edit'); }}
                className="text-sm px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-colors flex items-center gap-1.5"
              >
                ✏️ Edit Draft
              </button>
              <button
                onClick={handleSend}
                disabled={isSending}
                className={cn(
                  "text-sm px-4 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5",
                  isSending
                    ? "bg-green-400 text-white cursor-not-allowed"
                    : "bg-[#2d6a4f] hover:bg-[#245a42] text-white"
                )}
              >
                {isSending ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>📤 Send Now</>
                )}
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={savingDraft}
                className="text-sm px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-colors flex items-center gap-1.5 ml-auto"
              >
                {savingDraft ? (
                  <span className="inline-block w-3 h-3 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                ) : '💾'} Save Draft
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
