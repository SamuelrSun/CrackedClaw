"use client";

import { useState, useEffect, useRef } from "react";
import { Check, Phone, Mail, X, Loader2, Trash2 } from "lucide-react";

interface ContactMethodsPopupProps {
  onClose: () => void;
  userEmail: string | null;
}

type PhoneState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "pending"; phone: string; twilioNumber: string }
  | { status: "verified"; phone: string }
  | { status: "error"; message: string };

export function ContactMethodsPopup({ onClose, userEmail }: ContactMethodsPopupProps) {
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneState, setPhoneState] = useState<PhoneState>({ status: "loading" });
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load current phone status on mount
  useEffect(() => {
    loadPhoneStatus();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  async function loadPhoneStatus() {
    try {
      const res = await fetch("/api/contact-methods/phone");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();

      if (data.phone_number && data.phone_verified) {
        setPhoneState({ status: "verified", phone: data.phone_number });
      } else if (data.phone_number && !data.phone_verified) {
        setPhoneState({
          status: "pending",
          phone: data.phone_number,
          twilioNumber: data.twilio_number ?? "+1 (800) XXX-XXXX",
        });
        startPolling();
      } else {
        setPhoneState({ status: "idle" });
      }
    } catch {
      setPhoneState({ status: "idle" });
    }
  }

  function startPolling() {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/contact-methods/phone");
        if (!res.ok) return;
        const data = await res.json();
        if (data.phone_verified) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setPhoneState({ status: "verified", phone: data.phone_number });
        }
      } catch { /* ignore */ }
    }, 3000);
  }

  async function handleSubmitPhone() {
    if (!phoneInput.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact-methods/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phoneInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhoneState({ status: "error", message: data.error ?? "Failed to register" });
      } else {
        setPhoneState({
          status: "pending",
          phone: data.phone_number,
          twilioNumber: data.twilio_number ?? "+1 (800) XXX-XXXX",
        });
        setPhoneInput("");
        startPolling();
      }
    } catch {
      setPhoneState({ status: "error", message: "Network error — try again" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemovePhone() {
    setRemoving(true);
    if (pollingRef.current) clearInterval(pollingRef.current);
    try {
      await fetch("/api/contact-methods/phone", { method: "DELETE" });
      setPhoneState({ status: "idle" });
      setPhoneInput("");
    } finally {
      setRemoving(false);
    }
  }

  function formatDisplayPhone(phone: string): string {
    // Format +14155551234 → +1 (415) 555-1234
    const match = phone.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
    if (match) return `+1 (${match[1]}) ${match[2]}-${match[3]}`;
    return phone;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative z-10 w-[calc(100%-2rem)] md:w-[400px] rounded-[3px] border border-white/10 bg-black/[0.07] backdrop-blur-[10px] shadow-2xl flex flex-col gap-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <span className="text-[13px] font-semibold text-white">Contact Methods</span>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-1 p-3">
          {/* Email — always shown as verified */}
          <div className="flex items-center gap-3 px-3 py-3 rounded-[4px] bg-white/[0.04] border border-white/[0.06]">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <Mail className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-white/80 truncate">
                {userEmail ?? "Email"}
              </p>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Email</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400">Verified</span>
            </div>
          </div>

          {/* Phone number */}
          <div className="flex flex-col gap-2 px-3 py-3 rounded-[4px] bg-white/[0.04] border border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                <Phone className="w-3.5 h-3.5 text-white/50" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-white/80">Phone Number</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">SMS</p>
              </div>
              {(phoneState.status === "pending" || phoneState.status === "verified") && (
                <button
                  onClick={handleRemovePhone}
                  disabled={removing}
                  className="text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
                  title="Remove phone number"
                >
                  {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            {/* States */}
            {phoneState.status === "loading" && (
              <div className="flex items-center gap-2 pl-11">
                <Loader2 className="w-3.5 h-3.5 text-white/30 animate-spin" />
                <span className="text-[11px] text-white/40">Loading...</span>
              </div>
            )}

            {phoneState.status === "idle" && (
              <div className="pl-11 flex gap-2">
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitPhone()}
                  placeholder="+1 (555) 000-0000"
                  className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white/80 text-[12px] px-3 py-2 outline-none focus:border-white/20 placeholder:text-white/25 rounded-[3px]"
                />
                <button
                  onClick={handleSubmitPhone}
                  disabled={!phoneInput.trim() || submitting}
                  className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-[11px] rounded-[3px] transition-colors disabled:opacity-40"
                >
                  {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                </button>
              </div>
            )}

            {phoneState.status === "pending" && (
              <div className="pl-11 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-white/70">{formatDisplayPhone(phoneState.phone)}</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[10px] text-amber-400 uppercase tracking-wider">Pending</span>
                </div>
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-[4px] px-3 py-2.5">
                  <p className="text-[11px] text-white/60 leading-relaxed">
                    Text <span className="text-white font-mono">{phoneState.twilioNumber}</span> from your phone to verify.
                  </p>
                  <p className="text-[10px] text-white/30 mt-1">Waiting for verification...</p>
                </div>
              </div>
            )}

            {phoneState.status === "verified" && (
              <div className="pl-11 flex items-center gap-3">
                <span className="text-[12px] text-white/70">{formatDisplayPhone(phoneState.phone)}</span>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400">Verified</span>
                </div>
              </div>
            )}

            {phoneState.status === "error" && (
              <div className="pl-11">
                <p className="text-[11px] text-red-400">{phoneState.message}</p>
                <button
                  onClick={() => setPhoneState({ status: "idle" })}
                  className="text-[10px] text-white/40 hover:text-white/60 mt-1"
                >
                  Try again
                </button>
              </div>
            )}
          </div>

          {/* More channels coming soon */}
          <div className="px-3 py-2.5 rounded-[4px] border border-dashed border-white/[0.06]">
            <p className="text-[10px] text-white/25 text-center uppercase tracking-wider">
              More channels coming soon — WhatsApp, Telegram, Slack
            </p>
          </div>
        </div>

        {/* Footer note */}
        <div className="px-5 py-3 border-t border-white/[0.06]">
          <p className="text-[10px] text-white/30 leading-relaxed">
            Contact methods let your agent reach you — and let you reach your agent — through any channel.
          </p>
        </div>
      </div>
    </div>
  );
}
