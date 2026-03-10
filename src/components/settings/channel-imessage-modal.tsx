"use client";

import { useState, useEffect, useCallback } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  Smartphone,
  Download,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Monitor,
  Loader2,
  Users,
} from "lucide-react";

interface IMessageSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type SetupStep = 1 | 2 | 3 | 4;

export function IMessageSetupModal({
  isOpen,
  onClose,
  onComplete,
}: IMessageSetupModalProps) {
  const [step, setStep] = useState<SetupStep>(1);
  const [polling, setPolling] = useState(false);
  const [companionConnected, setCompanionConnected] = useState(false);

  const checkCompanionStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/channels/status");
      if (res.ok) {
        const data = await res.json();
        if (data.channels?.imessage?.connected) {
          setCompanionConnected(true);
          setPolling(false);
          setStep(3);
        }
      }
    } catch {
      // Silently retry on next poll
    }
  }, []);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(checkCompanionStatus, 3000);
    return () => clearInterval(interval);
  }, [polling, checkCompanionStatus]);

  const handleStartPolling = () => {
    setStep(2);
    setPolling(true);
  };

  const handleConfirmSetup = () => {
    setStep(4);
    onComplete();
  };

  const handleClose = () => {
    setStep(1);
    setPolling(false);
    setCompanionConnected(false);
    onClose();
  };

  const stepIndicator = (
    <div className="flex items-center gap-1.5 mb-6">
      {[1, 2, 3, 4].map((s) => (
        <div
          key={s}
          className={`h-1 flex-1 transition-colors duration-300 ${
            s <= step ? "bg-[#007AFF]" : "bg-grid/10"
          }`}
        />
      ))}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Connect iMessage">
      <div className="space-y-6">
        {stepIndicator}

        {/* Step 1: Requirements */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[rgba(58,58,56,0.1)]">
              <div className="w-12 h-12 flex items-center justify-center bg-[#007AFF] text-white">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-header text-base font-bold text-forest">
                  iMessage Integration
                </h3>
                <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
                  Step 1 of 4 — Requirements
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-forest leading-relaxed">
                iMessage integration requires the{" "}
                <span className="font-bold">CrackedClaw Connect</span> desktop
                companion app running on a Mac with an active iMessage account.
              </p>

              <div className="bg-forest/5 border border-[rgba(58,58,56,0.1)] p-4">
                <h4 className="font-mono text-[10px] uppercase tracking-wide text-grid/60 mb-2">
                  Requirements
                </h4>
                <ul className="space-y-2">
                  {[
                    "macOS 13 (Ventura) or later",
                    "Signed into iMessage on your Mac",
                    "CrackedClaw Connect companion app installed",
                    "Your Mac must stay powered on and connected",
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-[13px] text-forest/80"
                    >
                      <span className="font-mono text-[10px] text-[#007AFF] mt-0.5">
                        &#x2022;
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="solid"
                size="sm"
                onClick={handleStartPolling}
                className="bg-[#007AFF] hover:bg-[#007AFF]/90 border-[#007AFF]"
              >
                <span className="flex items-center gap-1.5">
                  Continue
                  <ArrowRight className="w-3 h-3" />
                </span>
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Download & Wait */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[rgba(58,58,56,0.1)]">
              <div className="w-12 h-12 flex items-center justify-center bg-forest/10 text-forest">
                <Monitor className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-header text-base font-bold text-forest">
                  Install Companion App
                </h3>
                <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
                  Step 2 of 4 — Download
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-forest leading-relaxed">
                Download and install the CrackedClaw Connect companion app on
                your Mac, then sign in with your account.
              </p>

              <button
                className="w-full flex items-center gap-4 p-4 border border-[rgba(58,58,56,0.2)] bg-forest/5 hover:bg-forest/10 transition-colors text-left"
              >
                <div className="w-10 h-10 flex items-center justify-center bg-forest text-white">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-header text-sm font-bold text-forest">
                    CrackedClaw Connect for macOS
                  </p>
                  <p className="font-mono text-[10px] text-grid/50">
                    Version 1.0.0 — Universal Binary (Apple Silicon + Intel)
                  </p>
                </div>
              </button>

              <div className="flex items-center gap-3 py-4">
                <div className="h-px flex-1 bg-grid/10" />
                <span className="font-mono text-[9px] uppercase tracking-wider text-grid/40">
                  Waiting for connection
                </span>
                <div className="h-px flex-1 bg-grid/10" />
              </div>

              <div className="flex flex-col items-center py-4 gap-3">
                {companionConnected ? (
                  <>
                    <CheckCircle2 className="w-8 h-8 text-mint" />
                    <p className="font-mono text-[11px] text-mint font-bold">
                      Companion app detected
                    </p>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-8 h-8 text-[#007AFF] animate-spin" />
                    <p className="font-mono text-[11px] text-grid/50">
                      Listening for companion app connection...
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep(1);
                  setPolling(false);
                }}
              >
                <span className="flex items-center gap-1.5">
                  <ArrowLeft className="w-3 h-3" />
                  Back
                </span>
              </Button>
              <Button
                variant="solid"
                size="sm"
                onClick={() => {
                  setCompanionConnected(true);
                  setPolling(false);
                  setStep(3);
                }}
                className="bg-[#007AFF] hover:bg-[#007AFF]/90 border-[#007AFF]"
              >
                <span className="flex items-center gap-1.5">
                  Skip — Already Installed
                  <ArrowRight className="w-3 h-3" />
                </span>
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Connected / Ready */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[rgba(58,58,56,0.1)]">
              <div className="w-12 h-12 flex items-center justify-center bg-mint/20 text-forest">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-header text-base font-bold text-forest">
                  Companion Ready
                </h3>
                <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
                  Step 3 of 4 — Connection Verified
                </p>
              </div>
            </div>

            <div className="bg-mint/10 border border-mint/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 block bg-mint" />
                <span className="font-mono text-[11px] font-bold text-forest">
                  CrackedClaw Connect is active
                </span>
              </div>
              <p className="font-mono text-[10px] text-grid/60">
                Your companion app is connected and iMessage bridge is ready.
                Proceed to configure which contacts and groups to monitor.
              </p>
            </div>

            <div className="flex justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(2)}
              >
                <span className="flex items-center gap-1.5">
                  <ArrowLeft className="w-3 h-3" />
                  Back
                </span>
              </Button>
              <Button
                variant="solid"
                size="sm"
                onClick={handleConfirmSetup}
                className="bg-[#007AFF] hover:bg-[#007AFF]/90 border-[#007AFF]"
              >
                <span className="flex items-center gap-1.5">
                  Configure Contacts
                  <ArrowRight className="w-3 h-3" />
                </span>
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Configure Contacts */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="flex flex-col items-center py-6 gap-4">
              <div className="w-16 h-16 flex items-center justify-center bg-[#007AFF]/10 text-[#007AFF]">
                <Users className="w-10 h-10" />
              </div>
              <div className="text-center">
                <h3 className="font-header text-lg font-bold text-forest">
                  iMessage Connected
                </h3>
                <p className="text-[13px] text-grid/60 mt-1 max-w-[280px]">
                  Your iMessage account is now linked through CrackedClaw
                  Connect. Contact and group configuration is available in
                  channel settings.
                </p>
              </div>
            </div>

            <div className="bg-forest/5 border border-[rgba(58,58,56,0.1)] p-4">
              <h4 className="font-mono text-[10px] uppercase tracking-wide text-grid/60 mb-2">
                Contact &amp; Group Settings
              </h4>
              <div className="space-y-2">
                {[
                  "All contacts are monitored by default",
                  "You can allowlist or blocklist specific contacts",
                  "Group chats can be individually enabled or disabled",
                ].map((item, i) => (
                  <p
                    key={i}
                    className="font-mono text-[11px] text-forest/70 flex items-start gap-2"
                  >
                    <span className="text-[#007AFF] mt-0.5">&#x2713;</span>
                    {item}
                  </p>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="solid" size="sm" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
