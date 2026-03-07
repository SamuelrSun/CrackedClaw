"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InviteModal } from "./invite-modal";
import { Trash2, ChevronDown } from "lucide-react";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  accepted_at?: string | null;
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
}

interface TeamSectionProps {
  members: TeamMember[];
  pendingInvitations: TeamInvitation[];
  currentUserRole: "owner" | "admin" | "member";
  onInvite: (email: string, role: string) => Promise<void>;
  onUpdateRole: (memberId: string, role: string) => Promise<void>;
  onRemove: (memberId: string) => Promise<void>;
  onCancelInvitation: (invitationId: string) => Promise<void>;
}

const roleColors: Record<string, "active" | "pending" | "inactive"> = {
  owner: "active",
  admin: "pending",
  member: "inactive",
};

const roleBadgeStyles: Record<string, string> = {
  owner: "bg-forest/10 border-forest",
  admin: "bg-gold/10 border-gold",
  member: "bg-grid/10 border-grid/30",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TeamSection({
  members,
  pendingInvitations,
  currentUserRole,
  onInvite,
  onUpdateRole,
  onRemove,
  onCancelInvitation,
}: TeamSectionProps) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [roleDropdownId, setRoleDropdownId] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  const canManageMembers = currentUserRole === "owner" || currentUserRole === "admin";
  const canChangeRoles = currentUserRole === "owner";

  const handleRemove = useCallback(async (memberId: string) => {
    setRemovingId(memberId);
    try {
      await onRemove(memberId);
    } finally {
      setRemovingId(null);
      setConfirmRemoveId(null);
    }
  }, [onRemove]);

  const handleRoleChange = useCallback(async (memberId: string, newRole: string) => {
    setUpdatingRoleId(memberId);
    try {
      await onUpdateRole(memberId, newRole);
    } finally {
      setUpdatingRoleId(null);
      setRoleDropdownId(null);
    }
  }, [onUpdateRole]);

  return (
    <>
      <Card label="Team" accentColor="#1A3C2B" bordered={false}>
        <div className="mt-2 space-y-4">
          {/* Team Members List */}
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between border-b border-[rgba(58,58,56,0.1)] pb-3 last:border-0"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-forest/10 flex items-center justify-center">
                    <span className="font-mono text-xs font-bold text-forest">
                      {getInitials(member.name || member.email)}
                    </span>
                  </div>
                  
                  {/* Name & Email */}
                  <div>
                    <p className="text-sm font-medium text-forest">
                      {member.name || "Unnamed"}
                    </p>
                    <p className="font-mono text-[10px] text-grid/50">
                      {member.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Role Badge / Dropdown */}
                  {canChangeRoles && member.role !== "owner" ? (
                    <div className="relative">
                      <button
                        onClick={() => setRoleDropdownId(roleDropdownId === member.id ? null : member.id)}
                        className={`inline-flex items-center gap-1 border rounded-none px-3 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors ${roleBadgeStyles[member.role]}`}
                        disabled={updatingRoleId === member.id}
                      >
                        <span className={`w-2 h-2 block rounded-none ${member.role === "admin" ? "bg-gold" : "bg-grid/30"}`} />
                        {updatingRoleId === member.id ? "..." : member.role}
                        <ChevronDown className="w-3 h-3 ml-1" />
                      </button>
                      
                      {roleDropdownId === member.id && (
                        <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-[rgba(58,58,56,0.2)] shadow-lg">
                          {["admin", "member"].map((role) => (
                            <button
                              key={role}
                              onClick={() => handleRoleChange(member.id, role)}
                              className={`block w-full text-left px-4 py-2 font-mono text-[10px] uppercase tracking-wide hover:bg-forest/5 ${
                                member.role === role ? "bg-forest/10" : ""
                              }`}
                            >
                              {role}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Badge status={roleColors[member.role]} className={roleBadgeStyles[member.role]}>
                      {member.role}
                    </Badge>
                  )}

                  {/* Remove Button */}
                  {canManageMembers && member.role !== "owner" && (
                    <>
                      {confirmRemoveId === member.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="solid"
                            size="sm"
                            onClick={() => handleRemove(member.id)}
                            disabled={removingId === member.id}
                            className="bg-coral hover:bg-coral/80 text-white text-[9px] px-2"
                          >
                            {removingId === member.id ? "..." : "Confirm"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmRemoveId(null)}
                            className="text-[9px] px-2"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRemoveId(member.id)}
                          className="p-1.5 text-grid/40 hover:text-coral transition-colors"
                          title="Remove member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {members.length === 0 && (
              <p className="font-mono text-[11px] text-grid/50 text-center py-4">
                No team members yet
              </p>
            )}
          </div>

          {/* Pending Invitations */}
          {pendingInvitations.length > 0 && (
            <div className="pt-4 border-t border-[rgba(58,58,56,0.1)]">
              <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mb-3">
                Pending Invitations
              </p>
              <div className="space-y-2">
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between bg-gold/5 px-3 py-2 border border-gold/20"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-gold rounded-none animate-pulse" />
                      <span className="font-mono text-[11px] text-forest">
                        {invitation.email}
                      </span>
                      <span className="font-mono text-[9px] text-grid/40 uppercase">
                        ({invitation.role})
                      </span>
                    </div>
                    {canManageMembers && (
                      <button
                        onClick={() => onCancelInvitation(invitation.id)}
                        className="font-mono text-[9px] text-coral hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invite Button */}
          {canManageMembers && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInviteModal(true)}
            >
              Invite Member
            </Button>
          )}
        </div>
      </Card>

      {/* Invite Modal */}
      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={onInvite}
        pendingInvitations={pendingInvitations}
      />
    </>
  );
}
