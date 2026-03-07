"use client";

interface Insight {
  icon: string;
  text: string;
}

interface ContextSummaryCardProps {
  insights: Insight[];
  source: string;
}

export function ContextSummaryCard({
  insights,
  source,
}: ContextSummaryCardProps) {
  return (
    <div className="border border-[rgba(58,58,56,0.2)] rounded-none bg-white p-4 max-w-sm">
      <div className="font-mono text-[10px] uppercase tracking-wide text-grid/60 mb-3">
        Learned from {source}
      </div>

      <ul className="space-y-2">
        {insights.map((insight, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <span className="text-sm flex-shrink-0">{insight.icon}</span>
            <span className="text-xs text-forest leading-relaxed">
              {insight.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
