'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

type Period = 'day' | 'week' | 'month';

interface Bucket {
  label: string;
  timestamp: string;
  cost: number;
  count: number;
}

interface HistogramData {
  period: Period;
  buckets: Bucket[];
  total: number;
  totalCount: number;
}

const PERIOD_LABELS: Record<Period, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
};

export function UsageHistogram() {
  const [period, setPeriod] = useState<Period>('day');
  const [data, setData] = useState<HistogramData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/usage/history?period=${p}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  const maxCost = data ? Math.max(...data.buckets.map(b => b.cost), 0.001) : 0;

  // Format bucket labels in user's local timezone
  function formatLabel(timestamp: string, p: Period): string {
    const d = new Date(timestamp);
    if (p === 'day') {
      const h = d.getHours();
      const ampm = h >= 12 ? 'PM' : 'AM';
      return `${h % 12 || 12}${ampm}`;
    } else if (p === 'week') {
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    } else {
      return `${d.getMonth() + 1}/${d.getDate()}`;
    }
  }

  // Determine which labels to show (skip some on dense charts)
  const labelInterval = data?.buckets.length === 30 ? 5 : data?.buckets.length === 24 ? 3 : 1;

  return (
    <div>
      {/* Period tabs */}
      <div className="flex items-center gap-0 mb-4 border-b border-white/[0.06]">
        {(['day', 'week', 'month'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              'font-mono text-[10px] uppercase tracking-wide px-3 py-2 transition-colors border-b-2 -mb-px',
              period === p
                ? 'text-white/80 border-white/40'
                : 'text-white/35 border-transparent hover:text-white/55 hover:border-white/15'
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
        {/* Total on the right */}
        <div className="ml-auto pr-1">
          {data && !loading && (
            <span className="font-mono text-[11px] text-white/50">
              ${data.total.toFixed(2)}
              <span className="text-white/25 ml-1">
                ({data.totalCount} {data.totalCount === 1 ? 'call' : 'calls'})
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Histogram */}
      <div className="relative">
        {loading ? (
          <div className="h-[120px] flex items-center justify-center">
            <span className="font-mono text-[10px] text-white/30 animate-pulse">Loading...</span>
          </div>
        ) : !data || data.totalCount === 0 ? (
          <div className="h-[120px] flex items-center justify-center">
            <span className="font-mono text-[10px] text-white/30">
              No usage data for this period.
            </span>
          </div>
        ) : (
          <>
            {/* Bars */}
            <div className="flex items-end gap-[2px] h-[120px]">
              {data.buckets.map((bucket, i) => {
                const heightPct = (bucket.cost / maxCost) * 100;
                const isHovered = hoveredIndex === i;
                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center justify-end h-full relative"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    {/* Tooltip on hover */}
                    {isHovered && bucket.cost > 0 && (
                      <div
                        className={cn(
                          'absolute bottom-full mb-1 px-2 py-1 bg-black/90 border border-white/10 rounded-[2px] whitespace-nowrap z-10 pointer-events-none',
                          // Prevent tooltip clipping at edges
                          i <= 2 ? 'left-0' : i >= (data.buckets.length - 3) ? 'right-0' : 'left-1/2 -translate-x-1/2'
                        )}
                      >
                        <span className="font-mono text-[9px] text-white/40 mr-1.5">
                          {formatLabel(bucket.timestamp, period)}
                        </span>
                        <span className="font-mono text-[10px] text-white/80">
                          ${bucket.cost.toFixed(4)}
                        </span>
                        <span className="font-mono text-[9px] text-white/40 ml-1">
                          ({bucket.count})
                        </span>
                      </div>
                    )}
                    {/* Bar */}
                    <div
                      className={cn(
                        'w-full rounded-t-[1px] transition-all duration-200',
                        bucket.cost > 0
                          ? isHovered
                            ? 'bg-emerald-400/80'
                            : 'bg-emerald-400/50'
                          : 'bg-white/[0.03]'
                      )}
                      style={{
                        height: bucket.cost > 0 ? `${Math.max(heightPct, 4)}%` : '1px',
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* X-axis labels — formatted in user's local timezone */}
            <div className="flex gap-[2px] mt-1.5">
              {data.buckets.map((bucket, i) => (
                <div key={i} className="flex-1 text-center overflow-hidden">
                  {i % labelInterval === 0 ? (
                    <span className="font-mono text-[8px] text-white/25">
                      {formatLabel(bucket.timestamp, period)}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
