"use client";

interface WeeklyChartProps {
  data: Array<{ day: string; tasks: number }>;
}

export function WeeklyChart({ data }: WeeklyChartProps) {
  const maxTasks = Math.max(...data.map((d) => d.tasks), 1);

  return (
    <div className="border border-[rgba(58,58,56,0.15)] p-5 bg-paper">
      <div className="flex items-end gap-2 h-24">
        {data.map((item) => {
          const pct = item.tasks > 0 ? (item.tasks / maxTasks) * 100 : 0;
          return (
            <div key={item.day} className="flex-1 flex flex-col items-center gap-1">
              <span className="font-mono text-[9px] text-grid/40">
                {item.tasks > 0 ? item.tasks : '–'}
              </span>
              <div className="w-full flex flex-col justify-end" style={{ height: '64px' }}>
                {item.tasks > 0 ? (
                  <div
                    className="w-full bg-forest transition-all duration-700"
                    style={{ height: `${Math.max(pct, 8)}%` }}
                  />
                ) : (
                  <div
                    className="w-full bg-[rgba(58,58,56,0.08)]"
                    style={{ height: '100%' }}
                  />
                )}
              </div>
              <span className="font-mono text-[9px] uppercase tracking-wide text-grid/50">
                {item.day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
