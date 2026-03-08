"use client";

import { useState, useEffect } from "react";
import { Check, Loader2 } from "lucide-react";
import type { ResolvedIntegration } from "@/lib/integrations/resolver";

interface DynamicIntegrationsCardProps {
  services: string[];
}

interface CardState {
  resolved: ResolvedIntegration;
  status: "idle" | "adding" | "added" | "error";
}

export function DynamicIntegrationsCard({ services }: DynamicIntegrationsCardProps) {
  const [cards, setCards] = useState<CardState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function resolve() {
      try {
        const res = await fetch("/api/integrations/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: services.join(", ") }),
        });
        const data = await res.json();
        const resolved: ResolvedIntegration[] = data.resolved || [];
        setCards(resolved.map(r => ({ resolved: r, status: "idle" })));
      } catch {
        setCards(services.map(name => ({
          resolved: {
            name,
            slug: name.toLowerCase().replace(/\s+/g, '-'),
            icon: "🔌",
            authType: "oauth" as const,
            needsNode: false,
            category: "other",
            description: `Connect to ${name}`,
            capabilities: [],
            knownService: false,
          },
          status: "idle" as const,
        })));
      } finally {
        setLoading(false);
      }
    }
    resolve();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async (index: number) => {
    const card = cards[index];
    if (!card || card.status !== "idle") return;
    setCards(prev => prev.map((c, i) => i === index ? { ...c, status: "adding" } : c));
    try {
      const res = await fetch("/api/integrations/create-dynamic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: card.resolved }),
      });
      const data = await res.json();
      setCards(prev => prev.map((c, i) =>
        i === index ? { ...c, status: (data.created || data.existed) ? "added" : "error" } : c
      ));
    } catch {
      setCards(prev => prev.map((c, i) => i === index ? { ...c, status: "error" } : c));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="w-3 h-3 animate-spin text-grid/40" />
        <span className="font-mono text-[10px] text-grid/40">Resolving integrations...</span>
      </div>
    );
  }

  if (!cards.length) return null;

  return (
    <div className="flex flex-col gap-2 my-2">
      {cards.map((card, i) => (
        <div key={card.resolved.slug} className="border border-[rgba(58,58,56,0.2)] bg-paper p-3 max-w-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg flex-shrink-0">{card.resolved.icon}</span>
              <div className="min-w-0">
                <p className="font-header font-bold text-sm truncate">{card.resolved.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {card.resolved.needsNode ? (
                    <span className="font-mono text-[8px] uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 border border-amber-200">
                      Node required
                    </span>
                  ) : (
                    <span className="font-mono text-[8px] uppercase tracking-wide text-grid/40">
                      {card.resolved.authType === "api_key" ? "API Key" : "OAuth"}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {card.status === "idle" && (
              <button
                onClick={() => handleAdd(i)}
                className="flex-shrink-0 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide bg-grid text-paper hover:bg-grid/80 transition-colors"
              >
                Connect
              </button>
            )}
            {card.status === "adding" && <Loader2 className="flex-shrink-0 w-4 h-4 animate-spin text-grid/40" />}
            {card.status === "added" && (
              <span className="flex-shrink-0 flex items-center gap-1 font-mono text-[10px] text-forest">
                <Check className="w-3 h-3" /> Added
              </span>
            )}
            {card.status === "error" && (
              <span className="flex-shrink-0 font-mono text-[10px] text-coral">Try again</span>
            )}
          </div>
          {card.resolved.needsNode && card.status === "idle" && (
            <p className="font-mono text-[9px] text-amber-600 mt-2 pl-8">
              Uses browser automation — requires your node to be connected
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
