"use client";

import { useEffect, useState } from "react";

interface StatCardProps {
  icon: string;
  value: number;
  label: string;
  sublabel: string;
  color?: string;
  decimals?: number;
}

export function StatCard({ icon, value, label, sublabel, color = "text-forest", decimals = 0 }: StatCardProps) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    const duration = 1200;
    const steps = 40;
    const increment = value / steps;
    let current = 0;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      current = Math.min(increment * step, value);
      setDisplayed(current);
      if (step >= steps) clearInterval(timer);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);

  const formatted = decimals > 0
    ? displayed.toFixed(decimals)
    : Math.round(displayed).toString();

  return (
    <div className="bg-paper border border-[rgba(58,58,56,0.15)] p-5 flex flex-col gap-2">
      <span className="text-2xl">{icon}</span>
      <span className={`font-header text-3xl font-bold tracking-tight ${color}`}>
        {formatted}
      </span>
      <div>
        <div className="font-header text-sm font-semibold text-grid">{label}</div>
        <div className="font-mono text-[10px] uppercase tracking-wide text-grid/50">{sublabel}</div>
      </div>
    </div>
  );
}
