"use client";

import { useMemo } from "react";

interface UsageHistoryItem {
  date: string;
  tokens_used: number;
}

interface UsageChartProps {
  history: UsageHistoryItem[];
  className?: string;
}

export function UsageChart({ history, className = "" }: UsageChartProps) {
  const { maxTokens, formattedDays } = useMemo(() => {
    const max = Math.max(...history.map((d) => d.tokens_used), 1);
    
    const today = new Date().toISOString().split("T")[0];
    
    const formatted = history.map((item) => {
      const date = new Date(item.date);
      const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
      const isToday = item.date === today;
      
      return {
        ...item,
        dayName,
        isToday,
        heightPercent: Math.max((item.tokens_used / max) * 100, 2),
      };
    });
    
    return { maxTokens: max, formattedDays: formatted };
  }, [history]);

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  return (
    <div className={`${className}`}>
      <div className="flex items-end gap-1 h-32">
        {formattedDays.map((day) => (
          <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
            <div className="flex-1 w-full flex items-end justify-center">
              <div
                className={`w-full max-w-8 transition-all duration-300 rounded-none ${
                  day.isToday
                    ? "bg-forest"
                    : "bg-forest/30 hover:bg-forest/50"
                }`}
                style={{ height: `${day.heightPercent}%` }}
                title={`${formatTokens(day.tokens_used)} tokens`}
              />
            </div>
            <span
              className={`font-mono text-[9px] uppercase tracking-wide ${
                day.isToday ? "text-forest font-bold" : "text-grid/50"
              }`}
            >
              {day.dayName}
            </span>
          </div>
        ))}
      </div>
      
      {/* Y-axis labels */}
      <div className="flex justify-between mt-2 pt-2 border-t border-[rgba(58,58,56,0.1)]">
        <span className="font-mono text-[9px] text-grid/40">0</span>
        <span className="font-mono text-[9px] text-grid/40">
          Max: {formatTokens(maxTokens)}
        </span>
      </div>
    </div>
  );
}
