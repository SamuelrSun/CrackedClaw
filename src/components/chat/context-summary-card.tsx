"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ExternalLink, PanelRightOpen } from "lucide-react";
import type { MemoryInsights } from "./memory-panel";

interface Insight {
  icon: string;
  text: string;
}

interface TopContact {
  name: string;
  frequency: number;
}

interface WritingStyle {
  tone: string;
  patterns?: string[];
}

interface RawInsights {
  topics?: string[];
  contacts?: TopContact[];
  writingStyle?: WritingStyle;
  automationOpportunities?: string[];
  [key: string]: unknown;
}

interface ContextSummaryCardProps {
  insights: Insight[];
  source: string;
  rawInsights?: RawInsights;
  onOpenMemory?: (insights: MemoryInsights, source: string) => void;
}

export function ContextSummaryCard({
  insights,
  source,
  rawInsights,
  onOpenMemory,
}: ContextSummaryCardProps) {
  const [expanded, setExpanded] = useState(false);

  const handleOpenPanel = () => {
    if (!onOpenMemory) return;
    const memInsights: MemoryInsights = {
      topics: rawInsights?.topics,
      contacts: rawInsights?.contacts?.map((c) => ({ name: c.name, frequency: c.frequency })),
      writingStyle: rawInsights?.writingStyle
        ? { tone: rawInsights.writingStyle.tone, openingPatterns: rawInsights.writingStyle.patterns }
        : undefined,
      automationOpportunities: rawInsights?.automationOpportunities,
    };
    onOpenMemory(memInsights, source);
  };

  return (
    <div className="border border-white/[0.1] rounded-none bg-white max-w-sm">
      {/* Header — clickable */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-forest/5 transition-colors"
      >
        <span className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
          Learned from {source}
        </span>
        <span className="text-grid/40 ml-2">
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </span>
      </button>

      {/* Summary list — always visible */}
      <ul className="space-y-2 px-4 pb-3">
        {insights.map((insight, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <span className="text-sm flex-shrink-0">{insight.icon}</span>
            <span className="text-xs text-forest leading-relaxed">
              {insight.text}
            </span>
          </li>
        ))}
      </ul>

      {/* Expanded detail */}
      {expanded && rawInsights && (
        <div className="border-t border-[rgba(58,58,56,0.12)] px-4 py-3 space-y-3">
          {rawInsights.topics && rawInsights.topics.length > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wide text-grid/50 mb-1">Topics</p>
              <div className="flex flex-wrap gap-1">
                {rawInsights.topics.map((t, i) => (
                  <span key={i} className="text-[10px] bg-forest/10 text-forest px-1.5 py-0.5 rounded">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {rawInsights.contacts && rawInsights.contacts.length > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wide text-grid/50 mb-1">Top Contacts</p>
              <ul className="space-y-0.5">
                {rawInsights.contacts.slice(0, 5).map((c, i) => (
                  <li key={i} className="text-[10px] text-forest/80">
                    {c.name} <span className="text-grid/40">({c.frequency}x)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rawInsights.writingStyle && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wide text-grid/50 mb-1">Writing Style</p>
              <p className="text-[10px] text-forest/80">
                Tone: {rawInsights.writingStyle.tone}
              </p>
            </div>
          )}

          {rawInsights.automationOpportunities && rawInsights.automationOpportunities.length > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wide text-grid/50 mb-1">Automation Ideas</p>
              <ul className="space-y-0.5">
                {rawInsights.automationOpportunities.slice(0, 3).map((a, i) => (
                  <li key={i} className="text-[10px] text-forest/80">• {a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-[rgba(58,58,56,0.12)] px-4 py-2 flex items-center justify-between">
        {onOpenMemory && rawInsights ? (
          <button
            onClick={handleOpenPanel}
            className="flex items-center gap-1 text-[10px] font-mono text-forest/50 hover:text-forest transition-colors"
          >
            <PanelRightOpen className="w-2.5 h-2.5" />
            Open in panel
          </button>
        ) : (
          <span />
        )}
        <Link
          href="/settings/memory"
          className="flex items-center gap-1 text-[10px] font-mono text-forest/50 hover:text-forest transition-colors"
        >
          View in Memory <ExternalLink className="w-2.5 h-2.5" />
        </Link>
      </div>
    </div>
  );
}
