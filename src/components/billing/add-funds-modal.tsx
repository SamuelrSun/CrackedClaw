"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { X, Lock, Check, Loader2, Wallet } from "lucide-react";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

const stripeAppearance: import("@stripe/stripe-js").Appearance = {
  theme: "night",
  variables: {
    colorPrimary: "#34d399",
    colorBackground: "rgba(0, 0, 0, 0.3)",
    colorText: "rgba(255, 255, 255, 0.8)",
    colorTextSecondary: "rgba(255, 255, 255, 0.5)",
    colorTextPlaceholder: "rgba(255, 255, 255, 0.3)",
    colorDanger: "#f87171",
    fontFamily:
      "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    fontSizeBase: "13px",
    borderRadius: "3px",
    spacingUnit: "4px",
    colorInputBackground: "rgba(255, 255, 255, 0.05)",
    colorInputText: "rgba(255, 255, 255, 0.85)",
  },
  rules: {
    ".Input": {
      border: "1px solid rgba(255, 255, 255, 0.1)",
      boxShadow: "none",
    },
    ".Input:focus": {
      border: "1px solid rgba(255, 255, 255, 0.2)",
      boxShadow: "none",
    },
    ".Label": {
      fontSize: "11px",
      fontWeight: "500",
      letterSpacing: "0.3px",
      textTransform: "uppercase",
      color: "rgba(255, 255, 255, 0.4)",
    },
    ".Tab": {
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      border: "1px solid rgba(255, 255, 255, 0.08)",
    },
    ".Tab--selected": {
      backgroundColor: "rgba(255, 255, 255, 0.08)",
      borderColor: "rgba(255, 255, 255, 0.15)",
    },
  },
};

interface AddFundsFormProps {
  amount: number;
  onSuccess: () => void;
}

function AddFundsForm({ amount, onSuccess }: AddFundsFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/settings?funded=true&amount=${amount}`,
      },
      redirect: "if_required",
    });

    if (submitError) {
      setError(submitError.message || "Payment failed. Please try again.");
      setLoading(false);
    } else {
      setSucceeded(true);
      setTimeout(() => onSuccess(), 1500);
    }
  }

  if (succeeded) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6">
        <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mb-4">
          <Check className="w-6 h-6 text-emerald-400" />
        </div>
        <p className="text-[15px] text-white font-medium mb-1">
          ${amount.toFixed(2)} added!
        </p>
        <p className="text-[12px] text-white/50">
          Your balance has been updated.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Amount summary */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-[3px]">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-white/50" />
          <div>
            <p className="text-[13px] text-white/80 font-medium">
              Wallet Top-Up
            </p>
            <p className="text-[11px] text-white/40">
              Added to your Dopl balance
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[22px] text-white font-bold font-mono">
            ${amount.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Stripe Payment Element */}
      <div className="rounded-[3px] overflow-hidden">
        <PaymentElement
          options={{
            layout: "tabs",
          }}
        />
      </div>

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-[2px]">
          <p className="text-[12px] text-red-400">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full py-3 px-4 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-[13px] font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 rounded-[3px]"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Lock className="w-3.5 h-3.5" />
            Add ${amount.toFixed(2)} to Wallet
          </>
        )}
      </button>

      {/* Security note */}
      <div className="flex items-center justify-center gap-1.5">
        <Lock className="w-3 h-3 text-white/25" />
        <p className="text-[10px] text-white/25">
          Secured by Stripe. We never see your card details.
        </p>
      </div>
    </form>
  );
}

interface AddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  onSuccess: () => void;
}

export function AddFundsModal({
  isOpen,
  onClose,
  amount,
  onSuccess,
}: AddFundsModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !amount) return;

    setLoading(true);
    setClientSecret(null);
    setError(null);

    async function createIntent() {
      try {
        const res = await fetch("/api/billing/add-funds-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Failed to start checkout");
          return;
        }

        setClientSecret(data.clientSecret);
      } catch {
        setError("Failed to connect to payment service");
      } finally {
        setLoading(false);
      }
    }

    createIntent();
  }, [isOpen, amount]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-[460px] rounded-[3px] border border-white/10 bg-black/[0.07] backdrop-blur-[20px] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <h2 className="text-[14px] font-semibold text-white">Add Funds</h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-white/40 animate-spin mb-3" />
              <p className="text-[12px] text-white/50">Preparing checkout...</p>
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <p className="text-[13px] text-red-400 mb-3">{error}</p>
              <button
                onClick={onClose}
                className="text-[12px] text-white/50 underline"
              >
                Close
              </button>
            </div>
          ) : clientSecret ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: stripeAppearance,
              }}
            >
              <AddFundsForm
                amount={amount}
                onSuccess={onSuccess}
              />
            </Elements>
          ) : null}
        </div>
      </div>
    </div>
  );
}
