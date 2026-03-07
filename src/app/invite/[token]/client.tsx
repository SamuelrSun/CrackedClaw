"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import type { TeamInvitationRecord } from "@/lib/supabase/data";

interface InviteAcceptClientProps {
  token: string;
  invitation: TeamInvitationRecord;
  inviterName: string;
  currentUser: { id: string; email: string } | null;
}

const roleBadgeStyles: Record<string, string> = {
  admin: "bg-gold/10 border-gold text-gold",
  member: "bg-grid/10 border-grid/30 text-grid",
};

export function InviteAcceptClient({
  token,
  invitation,
  inviterName,
  currentUser,
}: InviteAcceptClientProps) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!currentUser) {
      // Redirect to login with return URL
      router.push(`/login?redirect=/invite/${token}`);
      return;
    }

    setAccepting(true);
    setError(null);

    try {
      const res = await fetch(`/api/invite/${token}/accept`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to accept invitation");
      }

      // Redirect to dashboard
      router.push("/?joined=true");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invitation");
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    setError(null);

    try {
      const res = await fetch(`/api/invite/${token}/decline`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to decline invitation");
      }

      // Redirect to home
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to decline invitation");
      setDeclining(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Breadcrumbs at top of card area */}
        <div className="mb-4">
          <Breadcrumbs 
            items={[
              { label: "Dashboard", href: "/" },
              { label: "Team Invitation" },
            ]} 
          />
        </div>

        {/* Card */}
        <div className="border border-[rgba(58,58,56,0.2)] bg-white p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-mint/10 mx-auto mb-6 flex items-center justify-center">
              <span className="text-2xl">✉️</span>
            </div>
            <h1 className="font-header text-2xl font-bold text-forest mb-2">
              You&apos;re Invited!
            </h1>
            <p className="font-mono text-sm text-grid/60">
              <span className="font-bold text-forest">{inviterName}</span> has invited you to join their team
            </p>
          </div>

          {/* Invitation Details */}
          <div className="space-y-4 mb-8">
            <div className="flex justify-between items-center py-3 border-b border-[rgba(58,58,56,0.1)]">
              <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
                Email
              </span>
              <span className="font-mono text-sm text-forest">
                {invitation.email}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-[rgba(58,58,56,0.1)]">
              <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
                Role
              </span>
              <span className={`inline-flex items-center gap-2 border rounded-none px-3 py-1 font-mono text-[10px] uppercase tracking-wide ${roleBadgeStyles[invitation.role] || roleBadgeStyles.member}`}>
                <span className={`w-2 h-2 block rounded-none ${invitation.role === "admin" ? "bg-gold" : "bg-grid/30"}`} />
                {invitation.role}
              </span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
                Expires
              </span>
              <span className="font-mono text-sm text-grid/60">
                {new Date(invitation.expires_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Login Notice */}
          {!currentUser && (
            <div className="bg-gold/5 border border-gold/20 px-4 py-3 mb-6">
              <p className="font-mono text-[11px] text-grid/70">
                You&apos;ll need to sign in or create an account to accept this invitation.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-coral/5 border border-coral/20 px-4 py-3 mb-6">
              <p className="font-mono text-[11px] text-coral">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDecline}
              disabled={declining || accepting}
              className="flex-1"
            >
              {declining ? "Declining..." : "Decline"}
            </Button>
            <Button
              variant="solid"
              size="sm"
              onClick={handleAccept}
              disabled={accepting || declining}
              className="flex-1"
            >
              {accepting ? "Accepting..." : currentUser ? "Accept Invitation" : "Sign in to Accept"}
            </Button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center mt-6 font-mono text-[10px] text-grid/40">
          By accepting, you agree to join the team as a {invitation.role}
        </p>
      </div>
    </div>
  );
}
