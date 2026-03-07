import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInvitationByToken } from "@/lib/supabase/data";
import { InviteAcceptClient } from "./client";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { invitation, inviterName, expired } = await getInvitationByToken(token);

  // If no valid invitation found
  if (!invitation) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-coral/10 mx-auto mb-6 flex items-center justify-center">
            <span className="text-2xl">❌</span>
          </div>
          <h1 className="font-header text-2xl font-bold text-forest mb-2">
            Invalid Invitation
          </h1>
          <p className="font-mono text-sm text-grid/60 mb-6">
            This invitation link is invalid or has already been used.
          </p>
          <a
            href="/login"
            className="inline-flex items-center justify-center px-6 py-2 bg-forest text-white font-mono text-[11px] uppercase tracking-wide hover:bg-forest/90 transition-colors"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  // If invitation is expired
  if (expired) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-gold/10 mx-auto mb-6 flex items-center justify-center">
            <span className="text-2xl">⏰</span>
          </div>
          <h1 className="font-header text-2xl font-bold text-forest mb-2">
            Invitation Expired
          </h1>
          <p className="font-mono text-sm text-grid/60 mb-6">
            This invitation has expired. Please ask the team owner to send a new invitation.
          </p>
          <a
            href="/login"
            className="inline-flex items-center justify-center px-6 py-2 bg-forest text-white font-mono text-[11px] uppercase tracking-wide hover:bg-forest/90 transition-colors"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <InviteAcceptClient
      token={token}
      invitation={invitation}
      inviterName={inviterName || "Someone"}
      currentUser={user ? { id: user.id, email: user.email || "" } : null}
    />
  );
}
