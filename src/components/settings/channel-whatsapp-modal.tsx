"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Loader2,
  QrCode,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Wifi,
} from "lucide-react";

interface WhatsAppSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type SetupStep = 1 | 2 | 3 | 4;

export function WhatsAppSetupModal({
  isOpen,
  onClose,
  onComplete,
}: WhatsAppSetupModalProps) {
  const [step, setStep] = useState<SetupStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartSetup = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/settings/channels/whatsapp/setup", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to initialize WhatsApp setup");
        setLoading(false);
        return;
      }

      setStep(3);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmConnected = () => {
    setStep(4);
    onComplete();
  };

  const handleClose = () => {
    setStep(1);
    setError(null);
    onClose();
  };

  const stepIndicator = (
    <div className="flex items-center gap-1.5 mb-6">
      {[1, 2, 3, 4].map((s) => (
        <div
          key={s}
          className={`h-1 flex-1 transition-colors duration-300 ${
            s <= step ? "bg-[#25D366]" : "bg-grid/10"
          }`}
        />
      ))}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Connect WhatsApp">
      <div className="space-y-6">
        {stepIndicator}

        {/* Step 1: Explain */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[rgba(58,58,56,0.1)]">
              <div className="w-12 h-12 flex items-center justify-center bg-[#25D366] text-white">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-header text-base font-bold text-forest">
                  WhatsApp Web Linking
                </h3>
                <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
                  Step 1 of 4 — Overview
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-forest leading-relaxed">
                Link your WhatsApp account to CrackedClaw using the same QR code
                pairing method as WhatsApp Web.
              </p>
              <div className="bg-forest/5 border border-[rgba(58,58,56,0.1)] p-4">
                <h4 className="font-mono text-[10px] uppercase tracking-wide text-grid/60 mb-2">
                  How it works
                </h4>
                <ul className="space-y-2">
                  {[
                    "We provision a secure WhatsApp bridge on your instance",
                    "You scan a QR code with your phone's WhatsApp app",
                    "Messages are routed through your personal OpenClaw gateway",
                    "All data stays on your infrastructure — zero third-party access",
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-[13px] text-forest/80"
                    >
                      <span className="font-mono text-[10px] text-[#25D366] mt-0.5">
                        {i + 1}.
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
                onClick={() => setStep(2)}
                className="bg-[#25D366] hover:bg-[#25D366]/90 border-[#25D366]"
              >
                <span className="flex items-center gap-1.5">
                  Begin Setup
                  <ArrowRight className="w-3 h-3" />
                </span>
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Configuring */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[rgba(58,58,56,0.1)]">
              <div className="w-12 h-12 flex items-center justify-center bg-forest/10 text-forest">
                <Wifi className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-header text-base font-bold text-forest">
                  Configure Bridge
                </h3>
                <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
                  Step 2 of 4 — Provisioning
                </p>
              </div>
            </div>

            {!loading && !error && (
              <div className="space-y-3">
                <p className="text-sm text-forest leading-relaxed">
                  We&apos;ll now configure your OpenClaw instance to enable the
                  WhatsApp bridge. This updates your gateway configuration.
                </p>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep(1)}
                  >
                    <span className="flex items-center gap-1.5">
                      <ArrowLeft className="w-3 h-3" />
                      Back
                    </span>
                  </Button>
                  <Button
                    variant="solid"
                    size="sm"
                    onClick={handleStartSetup}
                  >
                    Configure Now
                  </Button>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center py-8 gap-4">
                <Loader2 className="w-8 h-8 text-[#25D366] animate-spin" />
                <div className="text-center">
                  <p className="text-sm font-bold text-forest">
                    Configuring WhatsApp Bridge
                  </p>
                  <p className="font-mono text-[10px] text-grid/50 mt-1">
                    Updating your OpenClaw gateway configuration...
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="space-y-3">
                <div className="p-3 border border-coral bg-coral/10">
                  <span className="font-mono text-[11px] text-coral">
                    {error}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                  <Button
                    variant="solid"
                    size="sm"
                    onClick={handleStartSetup}
                  >
                    Retry
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: QR Code */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[rgba(58,58,56,0.1)]">
              <div className="w-12 h-12 flex items-center justify-center bg-forest/10 text-forest">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-header text-base font-bold text-forest">
                  Scan QR Code
                </h3>
                <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
                  Step 3 of 4 — Pair Device
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center py-4">
              {/* QR Code Placeholder */}
              <div className="w-48 h-48 border-2 border-dashed border-forest/20 bg-forest/5 flex flex-col items-center justify-center gap-2">
                <QrCode className="w-16 h-16 text-forest/30" />
                <span className="font-mono text-[9px] uppercase tracking-wider text-grid/40">
                  QR Code Area
                </span>
              </div>
              <p className="text-[13px] text-forest/80 text-center mt-4 max-w-[300px]">
                Open WhatsApp on your phone, go to{" "}
                <span className="font-bold">Settings &rarr; Linked Devices</span>
                , then scan this code.
              </p>
            </div>

            <div className="bg-gold/10 border border-gold/30 p-3">
              <p className="font-mono text-[10px] text-grid/60">
                Keep this window open while scanning. The QR code refreshes
                every 60 seconds. Your phone must be connected to the internet.
              </p>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                <span className="flex items-center gap-1.5">
                  <ArrowLeft className="w-3 h-3" />
                  Back
                </span>
              </Button>
              <Button
                variant="solid"
                size="sm"
                onClick={handleConfirmConnected}
                className="bg-[#25D366] hover:bg-[#25D366]/90 border-[#25D366]"
              >
                <span className="flex items-center gap-1.5">
                  I&apos;ve Scanned It
                  <ArrowRight className="w-3 h-3" />
                </span>
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Connected */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="flex flex-col items-center py-6 gap-4">
              <div className="w-16 h-16 flex items-center justify-center bg-[#25D366]/10 text-[#25D366]">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="text-center">
                <h3 className="font-header text-lg font-bold text-forest">
                  WhatsApp Connected
                </h3>
                <p className="text-[13px] text-grid/60 mt-1 max-w-[280px]">
                  Your WhatsApp account is now linked. Messages will be routed
                  through your OpenClaw gateway.
                </p>
              </div>
            </div>

            <div className="bg-mint/10 border border-mint/30 p-4">
              <h4 className="font-mono text-[10px] uppercase tracking-wide text-grid/60 mb-2">
                What happens next
              </h4>
              <ul className="space-y-1.5">
                {[
                  "Incoming messages are processed by your AI assistant",
                  "Responses are sent back through your WhatsApp",
                  "You can manage contacts and groups in channel settings",
                ].map((item, i) => (
                  <li
                    key={i}
                    className="font-mono text-[11px] text-forest/70 flex items-start gap-2"
                  >
                    <span className="text-mint mt-0.5">&#x2713;</span>
                    {item}
                  </li>
                ))}
              </ul>
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
