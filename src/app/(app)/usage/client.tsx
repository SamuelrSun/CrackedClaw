'use client';

import { useEffect, useState } from 'react';

interface DailyUsage {
  date: string;
  messages_sent: number;
  tokens_used: number;
  tool_calls: number;
}

interface UsageData {
  daily: DailyUsage[];
  totals: {
    messages: number;
    tokens: number;
    toolCalls: number;
  };
  memoryCount: number;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function SkeletonCard() {
  return (
    <div className="border border-[rgba(58,58,56,0.2)] p-5 bg-paper animate-pulse">
      <div className="h-3 w-20 bg-forest/10 mb-3" />
      <div className="h-7 w-16 bg-forest/10 mb-2" />
      <div className="h-3 w-14 bg-forest/5" />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="border border-[rgba(58,58,56,0.2)] p-5 bg-paper">
      <div className="font-mono text-[10px] uppercase tracking-widest text-grid/50 mb-2">{label}</div>
      <div className="font-header text-2xl text-forest mb-1">{value}</div>
      <div className="font-mono text-[10px] text-grid/40">{sub}</div>
    </div>
  );
}

interface BarChartProps {
  daily: DailyUsage[];
}

function BarChart({ daily }: BarChartProps) {
  const [tooltip, setTooltip] = useState<{ date: string; messages: number; x: number; y: number } | null>(null);

  // Build last-30-days array (fill missing dates with 0)
  const days: { date: string; messages: number }[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const found = daily.find((r) => r.date === dateStr);
    days.push({ date: dateStr, messages: found?.messages_sent || 0 });
  }

  const maxVal = Math.max(...days.map((d) => d.messages), 1);

  return (
    <div className="relative">
      <div className="flex items-end gap-0.5 h-24">
        {days.map((d, i) => {
          const pct = (d.messages / maxVal) * 100;
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col justify-end group relative cursor-default"
              onMouseEnter={(e) => {
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                const parentRect = (e.target as HTMLElement).closest('.relative')!.getBoundingClientRect();
                setTooltip({ date: d.date, messages: d.messages, x: rect.left - parentRect.left, y: rect.top - parentRect.top });
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              <div
                className="bg-forest hover:bg-forest/70 transition-colors"
                style={{ height: `${Math.max(pct, d.messages > 0 ? 4 : 1)}%` }}
              />
            </div>
          );
        })}
      </div>
      {/* X-axis labels */}
      <div className="flex gap-0.5 mt-1">
        {days.map((d, i) => (
          <div key={d.date} className="flex-1 text-center">
            {i % 5 === 0 && (
              <span className="font-mono text-[8px] text-grid/40">
                {d.date.slice(5)}
              </span>
            )}
          </div>
        ))}
      </div>
      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-10 bg-paper border border-[rgba(58,58,56,0.3)] px-2 py-1 pointer-events-none"
          style={{ left: Math.min(tooltip.x, 260), top: -40 }}
        >
          <div className="font-mono text-[10px] text-forest">{tooltip.date}</div>
          <div className="font-mono text-[10px] text-grid/60">{fmt(tooltip.messages)} msgs</div>
        </div>
      )}
    </div>
  );
}

export function UsageClient() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/usage')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const recentRows = data
    ? [...data.daily].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
    : [];

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-header text-2xl text-forest mb-1">Usage</h1>
        <p className="font-mono text-[11px] text-grid/50 uppercase tracking-widest">Last 30 days</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px border border-[rgba(58,58,56,0.2)] mb-8">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard label="Messages" value={fmt(data?.totals.messages || 0)} sub="this month" />
            <StatCard label="Tokens" value={fmt(data?.totals.tokens || 0)} sub="this month" />
            <StatCard label="Tool Calls" value={fmt(data?.totals.toolCalls || 0)} sub="this month" />
            <StatCard label="Memories" value={fmt(data?.memoryCount || 0)} sub="total" />
          </>
        )}
      </div>

      {/* Bar chart */}
      <div className="border border-[rgba(58,58,56,0.2)] bg-paper p-5 mb-8">
        <div className="font-mono text-[10px] uppercase tracking-widest text-grid/50 mb-4">Daily Activity</div>
        {loading ? (
          <div className="h-28 bg-forest/5 animate-pulse" />
        ) : (
          <BarChart daily={data?.daily || []} />
        )}
      </div>

      {/* Recent activity table */}
      <div className="border border-[rgba(58,58,56,0.2)] bg-paper">
        <div className="p-4 border-b border-[rgba(58,58,56,0.1)]">
          <span className="font-mono text-[10px] uppercase tracking-widest text-grid/50">Recent Activity</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgba(58,58,56,0.1)]">
              {['Date', 'Messages', 'Tokens', 'Tool Calls'].map((h) => (
                <th key={h} className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-widest text-grid/40">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-[rgba(58,58,56,0.05)]">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <td key={j} className="px-4 py-2.5">
                      <div className="h-3 w-16 bg-forest/5 animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : recentRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center font-mono text-[11px] text-grid/40">
                  No data yet. Start chatting to track usage.
                </td>
              </tr>
            ) : (
              recentRows.map((row) => (
                <tr key={row.date} className="border-b border-[rgba(58,58,56,0.05)] hover:bg-forest/[0.02] transition-colors">
                  <td className="px-4 py-2.5 font-mono text-[11px] text-forest">{row.date}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-grid/70">{fmt(row.messages_sent)}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-grid/70">{fmt(row.tokens_used)}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-grid/70">{fmt(row.tool_calls)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
