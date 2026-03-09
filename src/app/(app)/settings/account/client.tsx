"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, AlertTriangle, Trash2, User, Mail, Calendar } from "lucide-react";

interface UserInfo {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  created_at: string;
}

interface DeletionInfo {
  requiresConfirmation: boolean;
  has_organization: boolean;
  organization_id?: string;
  organization_name?: string;
  is_owner: boolean;
  has_other_members: boolean;
  member_count?: number;
  dataToDelete: string[];
}

interface AccountSettingsClientProps {
  user: UserInfo;
}

export default function AccountSettingsClient({ user }: AccountSettingsClientProps) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletionInfo, setDeletionInfo] = useState<DeletionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (showDeleteModal) {
      fetchDeletionInfo();
    }
  }, [showDeleteModal]);

  async function fetchDeletionInfo() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete");
      if (!res.ok) throw new Error("Failed to fetch account info");
      const data = await res.json();
      setDeletionInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load deletion info");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (confirmText !== "DELETE") {
      setError("Please type DELETE to confirm");
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete account");

      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
      setDeleting(false);
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link 
          href="/settings"
          className="inline-flex items-center gap-2 text-grid/60 hover:text-forest mb-4 font-mono text-xs"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to Settings
        </Link>
        <h1 className="font-header text-3xl font-bold tracking-tight leading-tight">
          Account Settings
        </h1>
        <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mt-1">
          Manage your account
        </p>
      </div>

      <div className="space-y-6">
        {/* Account Info Card */}
        <Card label="Account Information" accentColor="#9EFFBF" bordered={false}>
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-4">
              {user.avatar_url ? (
                <img 
                  src={user.avatar_url} 
                  alt={user.full_name} 
                  className="w-16 h-16 rounded-none border border-grid/20"
                />
              ) : (
                <div className="w-16 h-16 bg-forest/10 flex items-center justify-center border border-grid/20">
                  <User className="w-8 h-8 text-forest/40" />
                </div>
              )}
              <div>
                <h3 className="font-header text-xl font-bold text-forest">
                  {user.full_name || "No name set"}
                </h3>
                <p className="font-mono text-[11px] text-grid/60">{user.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-grid/10 bg-forest/5">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-grid/40" />
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50 block">Email</span>
                  <span className="font-mono text-xs text-forest">{user.email}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-grid/40" />
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50 block">Member Since</span>
                  <span className="font-mono text-xs text-forest">{formatDate(user.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Danger Zone */}
        <Card label="Danger Zone" accentColor="#FF8C69" bordered={false}>
          <div className="mt-4 space-y-4">
            <div className="p-4 border border-coral/30 bg-coral/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-coral flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-header font-bold text-coral mb-1">Delete Account</h4>
                  <p className="font-mono text-[11px] text-grid/60 mb-4">
                    Once you delete your account, there is no going back. This will permanently delete
                    all your data including conversations, memory entries, workflows, and integrations.
                  </p>
                  <Button 
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteModal(true)}
                    className="text-coral border-coral hover:bg-coral/10"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete My Account
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white w-full max-w-lg mx-4 border border-grid/20 shadow-xl">
            <div className="p-4 border-b border-grid/10 bg-coral/5">
              <div className="flex items-center gap-2 text-coral">
                <AlertTriangle className="w-5 h-5" />
                <h2 className="font-header font-bold text-lg">Delete Account</h2>
              </div>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-forest border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="font-mono text-[11px] text-grid/60">Loading account info...</p>
                </div>
              ) : error && !deletionInfo ? (
                <div className="p-4 bg-coral/10 border border-coral/30 text-coral font-mono text-[11px]">
                  {error}
                </div>
              ) : deletionInfo ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-header font-bold text-sm mb-2">
                      The following will be permanently deleted:
                    </h3>
                    <ul className="space-y-1">
                      {deletionInfo.dataToDelete.map((item, i) => (
                        <li key={i} className="font-mono text-[11px] text-grid/70 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-coral rounded-none" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {deletionInfo.has_other_members && (
                    <div className="p-3 bg-amber-50 border border-amber-300">
                      <p className="font-mono text-[11px] text-amber-800">
                        <strong>Note:</strong> Your organization has {deletionInfo.member_count} other
                        member(s). Ownership will be transferred to another team member.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="font-mono text-[11px] text-grid/70 block mb-2">
                      Type <strong className="text-coral">DELETE</strong> to confirm:
                    </label>
                    <Input
                      value={confirmText}
                      onChange={(e) => {
                        setConfirmText(e.target.value.toUpperCase());
                        setError(null);
                      }}
                      placeholder="DELETE"
                      className="font-mono"
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-coral/10 border border-coral/30 text-coral font-mono text-[11px]">
                      {error}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="p-4 border-t border-grid/10 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowDeleteModal(false);
                  setConfirmText("");
                  setError(null);
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="solid"
                size="sm"
                onClick={handleDelete}
                disabled={deleting || confirmText !== "DELETE" || loading}
                className="bg-coral hover:bg-coral/90 text-white"
              >
                {deleting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account Forever
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
