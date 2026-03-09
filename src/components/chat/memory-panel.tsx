"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface MemoryInsights {
  topics?: string[];
  contacts?: { name: string; email?: string; frequency: number }[];
  writingStyle?: {
    tone: string;
    avgLength?: number;
    openingPatterns?: string[];
    closingPatterns?: string[];
  };
  schedulePatterns?: {
    busiestDays?: string[];
    avgMeetingsPerWeek?: number;
    recurringMeetings?: string[];
  };
  automationOpportunities?: string[];
}

export interface MemoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  source?: string;
  insights?: MemoryInsights;
  userId?: string;
}

function SkeletonLine({ width = "full" }: { width?: string }) {
  return (
    <div
      className={cn(
        "h-2.5 bg-forest/10 rounded animate-pulse",
        width === "full" ? "w-full" : width === "3/4" ? "w-3/4" : width === "1/2" ? "w-1/2" : "w-2/3"
      )}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 px-4 py-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <SkeletonLine width="1/2" />
          <SkeletonLine />
          <SkeletonLine width="3/4" />
        </div>
      ))}
    </div>
  );
}

export function MemoryPanel({ isOpen, onClose, source, insights: propInsights }: MemoryPanelProps) {
  const [insights, setInsights] = useState<MemoryInsights | undefined>(propInsights);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setInsights(propInsights);
  }, [propInsights]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchInsights = async () => {
      setLoading(true);
      try {
        const params = source ? `?source=${encodeURIComponent(source.toLowerCase())}` : "";
        const res = await fetch(`/api/memory/insights${params}`);
        if (res.ok) {
          const data = await res.json();
          if (data.insights) {
            setInsights((prev) => ({ ...data.insights, ...prev }));
          }
        }
      } catch { /* silently fail */ }
      finally { setLoading(false); }
    };
    fetchInsights();
  }, [isOpen, source]);

  const hasAnyData =
    insights &&
    (
      (insights.topics && insights.topics.length > 0) ||
      (insights.contacts && insights.contacts.length > 0) ||
      insights.writingStyle ||
      insights.schedulePatterns ||
      (insights.automationOpportunities && insights.automationOpportunities.length > 0)
    );

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 md:hidden"
          onClick={onClose}
        />
      )}
      <div
        className={cn(
          "flex-shrink-0 border-l border-[rgba(58,58,56,0.2)] bg-[#F5F3EF] flex flex-col",
          "transition-all duration-300 ease-in-out overflow-hidden"
        )}
        style={{ width: isOpen ? 380 : 0, minWidth: isOpen ? 380 : 0 }}
      >
        <div className="w-[380px] flex flex-col h-full">
          {/* Header */}
          <div className="bg-[#1A3C2B] text-white px-4 py-3 flex items-start justify-between flex-shrink-0">
            <div>
              <h2 className="font-header text-base font-bold flex items-center gap-2">
                🧠 Memory
              </h2>
              {source && (
                <p className="font-mono text-[10px] text-white/60 mt-0.5 uppercase tracking-wide">
                  Learned from {source}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors mt-0.5 text-lg leading-none"
              aria-label="Close memory panel"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading && !hasAnyData ? (
              <LoadingSkeleton />
            ) : hasAnyData ? (
              <div className="divide-y divide-[rgba(58,58,56,0.1)]">
                {insights?.writingStyle && (
                  <section className="px-4 py-3">
                    <p className="font-mono text-[9px] uppercase tracking-wide text-[#3A3A38]/50 mb-2 flex items-center gap-1.5">
                      <span>📧</span> Writing Style
                    </p>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-[#3A3A38]/60">Tone</span>
                        <span className="text-xs text-[#1A3C2B] font-medium">{insights.writingStyle.tone}</span>
                      </div>
                      {insights.writingStyle.avgLength != null && (
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-[#3A3A38]/60">Avg length</span>
                          <span className="text-xs text-[#1A3C2B]">{insights.writingStyle.avgLength} sentences</span>
                        </div>
                      )}
                      {insights.writingStyle.openingPatterns && insights.writingStyle.openingPatterns.length > 0 && (
                        <div className="mt-1.5">
                          <span className="font-mono text-[10px] text-[#3A3A38]/60">Opens with</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {insights.writingStyle.openingPatterns.slice(0, 3).map((p, i) => (
                              <span key={i} className="text-[10px] bg-[#1A3C2B]/10 text-[#1A3C2B] px-1.5 py-0.5 rounded">
                                &ldquo;{p}&rdquo;
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {insights?.contacts && insights.contacts.length > 0 && (
                  <section className="px-4 py-3">
                    <p className="font-mono text-[9px] uppercase tracking-wide text-[#3A3A38]/50 mb-2 flex items-center gap-1.5">
                      <span>👥</span> Top Contacts
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {insights.contacts.slice(0, 8).map((c, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1 bg-white border border-[rgba(58,58,56,0.15)] px-2 py-1 rounded"
                          title={c.email}
                        >
                          <span className="text-xs text-[#1A3C2B] font-medium">{c.name}</span>
                          <span className="font-mono text-[9px] text-[#3A3A38]/40">({c.frequency})</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {insights?.schedulePatterns && (
                  <section className="px-4 py-3">
                    <p className="font-mono text-[9px] uppercase tracking-wide text-[#3A3A38]/50 mb-2 flex items-center gap-1.5">
                      <span>📅</span> Schedule Patterns
                    </p>
                    <div className="space-y-1">
                      {insights.schedulePatterns.busiestDays && insights.schedulePatterns.busiestDays.length > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-[#3A3A38]/60">Busiest days</span>
                          <span className="text-xs text-[#1A3C2B]">{insights.schedulePatterns.busiestDays.join(", ")}</span>
                        </div>
                      )}
                      {insights.schedulePatterns.avgMeetingsPerWeek != null && (
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-[#3A3A38]/60">Meetings/week</span>
                          <span className="text-xs text-[#1A3C2B]">{insights.schedulePatterns.avgMeetingsPerWeek}</span>
                        </div>
                      )}
                      {insights.schedulePatterns.recurringMeetings && insights.schedulePatterns.recurringMeetings.length > 0 && (
                        <div className="mt-1">
                          <span className="font-mono text-[10px] text-[#3A3A38]/60">Recurring</span>
                          <ul className="mt-1 space-y-0.5">
                            {insights.schedulePatterns.recurringMeetings.slice(0, 3).map((m, i) => (
                              <li key={i} className="text-[10px] text-[#1A3C2B]/80">• {m}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {insights?.topics && insights.topics.length > 0 && (
                  <section className="px-4 py-3">
                    <p className="font-mono text-[9px] uppercase tracking-wide text-[#3A3A38]/50 mb-2 flex items-center gap-1.5">
                      <span>🏷️</span> Topics
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {insights.topics.map((t, i) => (
                        <span key={i} className="text-[10px] bg-[#1A3C2B]/10 text-[#1A3C2B] px-1.5 py-0.5 rounded">
                          {t}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {insights?.automationOpportunities && insights.automationOpportunities.length > 0 && (
                  <section className="px-4 py-3">
                    <p className="font-mono text-[9px] uppercase tracking-wide text-[#3A3A38]/50 mb-2 flex items-center gap-1.5">
                      <span>💡</span> Automation Ideas
                    </p>
                    <ul className="space-y-1.5">
                      {insights.automationOpportunities.map((a, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-[#1A3C2B]/40 mt-0.5 flex-shrink-0">☐</span>
                          <span className="text-xs text-[#1A3C2B]/80 leading-relaxed">{a}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <span className="text-2xl block mb-2">🧠</span>
                <p className="font-mono text-[10px] uppercase tracking-wide text-[#3A3A38]/40">
                  No insights yet
                </p>
                <p className="text-xs text-[#3A3A38]/50 mt-1">
                  Connect integrations to start learning
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[rgba(58,58,56,0.15)] px-4 py-3 flex-shrink-0">
            <Link
              href="/settings/memory"
              className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-[#1A3C2B]/60 hover:text-[#1A3C2B] transition-colors py-1 w-full hover:bg-[#1A3C2B]/5 rounded"
            >
              View all in Memory →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
