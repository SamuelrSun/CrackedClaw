"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import type { TeamInvitation } from "./team-section";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string, role: string) => Promise<void>;
  pendingInvitations: TeamInvitation[];
}

const roles = [
  { value: "admin", label: "Admin", description: "Can manage team and settings" },
  { value: "member", label: "Member", description: "Can view and use integrations" },
];

function validateEmail(email: string): string | null {
  if (!email) return "Email is required";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return "Please enter a valid email address";
  return null;
}

export function InviteModal({
  isOpen,
  onClose,
  onInvite,
  pendingInvitations,
}: InviteModalProps) {
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("member");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = useCallback(async () => {
    setTouched(true);
    
    const validationError = validateEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Check if already invited
    if (pendingInvitations.some((inv) => inv.email.toLowerCase() === email.toLowerCase())) {
      setError("This email has already been invited");
      return;
    }

    setSending(true);
    setError(null);

    try {
      await onInvite(email, selectedRole);
      setEmail("");
      setSelectedRole("member");
      setTouched(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setSending(false);
    }
  }, [email, selectedRole, onInvite, onClose, pendingInvitations]);

  const handleEmailChange = useCallback((value: string) => {
    setEmail(value);
    if (touched) {
      setError(validateEmail(value));
    }
  }, [touched]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-forest/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-paper border border-white/[0.1] w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <div className="w-0.5 h-4 bg-mint" />
            <h2 className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
              Invite Team Member
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-grid/40 hover:text-forest transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Email Input */}
          <Input
            label="Email Address"
            type="email"
            placeholder="colleague@company.com"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            onBlur={() => setTouched(true)}
            error={error || undefined}
            touched={touched}
          />

          {/* Role Selector */}
          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
              Role
            </label>
            <div className="grid grid-cols-2 gap-2">
              {roles.map((role) => (
                <button
                  key={role.value}
                  onClick={() => setSelectedRole(role.value)}
                  className={`text-left px-4 py-3 border transition-colors ${
                    selectedRole === role.value
                      ? "bg-forest text-white border-forest"
                      : "bg-white text-forest border-white/[0.1] hover:border-forest"
                  }`}
                >
                  <p className="font-mono text-[11px] uppercase tracking-wide font-bold">
                    {role.label}
                  </p>
                  <p className={`font-mono text-[9px] mt-1 ${
                    selectedRole === role.value ? "text-white/70" : "text-grid/50"
                  }`}>
                    {role.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Pending Invitations Preview */}
          {pendingInvitations.length > 0 && (
            <div className="pt-4 border-t border-white/[0.08]">
              <p className="font-mono text-[9px] uppercase tracking-wide text-grid/40 mb-2">
                {pendingInvitations.length} pending invitation{pendingInvitations.length > 1 ? "s" : ""}
              </p>
              <div className="flex flex-wrap gap-1">
                {pendingInvitations.slice(0, 3).map((inv) => (
                  <span
                    key={inv.id}
                    className="inline-flex items-center gap-1 bg-gold/10 px-2 py-0.5 font-mono text-[9px] text-gold"
                  >
                    <span className="w-1.5 h-1.5 bg-gold rounded-none" />
                    {inv.email}
                  </span>
                ))}
                {pendingInvitations.length > 3 && (
                  <span className="font-mono text-[9px] text-grid/40">
                    +{pendingInvitations.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-white/[0.08]">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="solid"
            size="sm"
            onClick={handleSubmit}
            disabled={sending || !email}
          >
            {sending ? "Sending..." : "Send Invitation"}
          </Button>
        </div>
      </div>
    </div>
  );
}
