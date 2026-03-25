'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';

type Period = 'day' | 'week' | 'month';

interface Bucket {
  label: string;
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

  // Detect user's timezone once on mount
  const userTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'UTC';
    }
  }, []);

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/usage/history?period=${p}&tz=${encodeURIComponent(userTz)}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [userTz]);

  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  const maxCost = data ? Math.max(...data.buckets.map(b => b.cost), 0.001) : 0;

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
      <div className="relative overflow-visible">
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
            {/* Bars — add top padding so tooltips aren't clipped */}
            <div className="pt-8">
              <div className="flex items-end gap-[2px] h-[120px]">
                {data.buckets.map((bucket, i) => {
                  const heightPct = (bucket.cost / maxCost) * 100;
                  const isHovered = hoveredIndex === i;
                  const hasCost = bucket.cost > 0;
                  return (
                    <div
                      key={i}
                      className={cn(
                        'flex-1 flex flex-col items-center justify-end h-full relative',
                        hasCost && 'cursor-crosshair',
                      )}
                      onMouseEnter={() => hasCost ? setHoveredIndex(i) : undefined}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      {/* Tooltip on hover — only for bars with cost */}
                      {isHovered && hasCost && (
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/90 border border-white/10 rounded-[2px] whitespace-nowrap z-10 pointer-events-none">
                          <div className="font-mono text-[10px] text-white/80">
                            ${bucket.cost.toFixed(4)}
                          </div>
                          <div className="font-mono text-[9px] text-white/40">
                            {bucket.count} {bucket.count === 1 ? 'call' : 'calls'} · {bucket.label}
                          </div>
                        </div>
                      )}
                      {/* Bar */}
                      <div
                        className={cn(
                          'w-full rounded-t-[1px] transition-all duration-200',
                          hasCost
                            ? isHovered
                              ? 'bg-emerald-400/80'
                              : 'bg-emerald-400/50'
                            : 'bg-white/[0.03]'
                        )}
                        style={{
                          height: hasCost ? `${Math.max(heightPct, 4)}%` : '2px',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X-axis labels */}
            <div className="flex gap-[2px] mt-1.5">
              {data.buckets.map((bucket, i) => (
                <div key={i} className="flex-1 text-center overflow-hidden">
                  {i % labelInterval === 0 ? (
                    <span className="font-mono text-[8px] text-white/25 truncate">
                      {bucket.label}
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
