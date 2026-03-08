"use client";

import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { UsageChart } from "@/components/settings/usage-chart";
import type { TokenUsage } from "@/lib/mock-data";
import type { UsageHistoryItem } from "@/lib/supabase/data";

interface UsagePageClientProps {
  initialUsage: TokenUsage;
  initialHistory: UsageHistoryItem[];
}

export default function UsagePageClient({ initialUsage, initialHistory }: UsagePageClientProps) {
  const percentage = Math.round((initialUsage.used / initialUsage.limit) * 100);
  
  // Client-side state for date-dependent calculations to avoid hydration mismatch
  const [daysUntilReset, setDaysUntilReset] = useState<number | null>(null);
  const [todayUsage, setTodayUsage] = useState<number>(0);
  const [todayDate, setTodayDate] = useState<string>("");
  
  // Calculate date-dependent values only on client
  useEffect(() => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    setTodayDate(today);
    
    // Calculate today's usage
    const todayData = initialHistory.find((item) => item.date === today);
    setTodayUsage(todayData?.tokens_used || 0);
    
    // Calculate days until reset
    if (initialUsage.resetDate && initialUsage.resetDate !== "—") {
      const resetDate = new Date(initialUsage.resetDate);
      const diffTime = resetDate.getTime() - now.getTime();
      setDaysUntilReset(Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24))));
    }
  }, [initialUsage.resetDate, initialHistory]);
  
  // Determine status color
  const statusColor = useMemo(() => {
    if (percentage >= 95) return { bg: "bg-coral", text: "text-coral", label: "Critical" };
    if (percentage >= 80) return { bg: "bg-gold", text: "text-gold", label: "Warning" };
    return { bg: "bg-forest", text: "text-forest", label: "Normal" };
  }, [percentage]);

  // Get last 7 days for quick view
  const last7Days = initialHistory.slice(-7);
  
  // Get last 3 months summary
  const monthlyUsage = useMemo(() => {
    const months: { [key: string]: number } = {};
    
    initialHistory.forEach((item) => {
      const monthKey = item.date.substring(0, 7); // YYYY-MM
      months[monthKey] = (months[monthKey] || 0) + item.tokens_used;
    });
    
    return Object.entries(months)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 3)
      .map(([month, tokens]) => ({
        month,
        monthName: new Date(month + "-01").toLocaleDateString("en-US", { 
          month: "long", 
          year: "numeric" 
        }),
        tokens,
      }));
  }, [initialHistory]);

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(2)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  return (
    <div className="p-6">
      <Breadcrumbs 
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Settings", href: "/settings" },
          { label: "Usage" },
        ]} 
      />
      
      <div className="mb-6">
        <h1 className="font-header text-3xl font-bold tracking-tight leading-tight">
          Token Usage
        </h1>
        <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mt-1">
          Detailed usage analytics
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Period Card */}
        <Card label="Current Period" accentColor="#F4D35E" className="lg:col-span-2">
          <div className="mt-2 space-y-4">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="font-header text-4xl font-bold">{percentage}%</span>
                <span className={`ml-3 px-2 py-0.5 text-[10px] font-mono uppercase ${statusColor.bg} text-white`}>
                  {statusColor.label}
                </span>
              </div>
              <span className="font-mono text-sm text-grid/60">
                {formatTokens(initialUsage.used)} / {formatTokens(initialUsage.limit)}
              </span>
            </div>
            
            {/* Progress bar with gradient */}
            <div className="w-full h-3 bg-[rgba(58,58,56,0.1)] rounded-none overflow-hidden">
              <div
                className={`h-full rounded-none transition-all duration-500 ${
                  percentage >= 95 ? "bg-coral" : percentage >= 80 ? "bg-gold" : "bg-forest"
                }`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-[rgba(58,58,56,0.1)]">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50 block mb-1">
                  Reset Date
                </span>
                <span className="font-mono text-sm text-forest">
                  {initialUsage.resetDate}
                </span>
              </div>
              {daysUntilReset !== null && (
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50 block mb-1">
                    Days Until Reset
                  </span>
                  <span className="font-mono text-sm text-forest">
                    {daysUntilReset} day{daysUntilReset !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50 block mb-1">
                  Today&apos;s Usage
                </span>
                <span className="font-mono text-sm text-forest">
                  {formatTokens(todayUsage)}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Plan Info Card */}
        <Card label="Plan Limits" accentColor="#9EFFBF">
          <div className="mt-2 space-y-4">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50 block mb-1">
                Monthly Limit
              </span>
              <span className="font-header text-2xl font-bold text-forest">
                {formatTokens(initialUsage.limit)}
              </span>
            </div>
            
            <div className="space-y-2 pt-4 border-t border-[rgba(58,58,56,0.1)]">
              <div className="flex justify-between">
                <span className="font-mono text-[10px] text-grid/50">Remaining</span>
                <span className="font-mono text-[10px] text-forest">
                  {formatTokens(initialUsage.limit - initialUsage.used)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-[10px] text-grid/50">Daily Average</span>
                <span className="font-mono text-[10px] text-forest">
                  {formatTokens(Math.round((initialUsage.limit - initialUsage.used) / (daysUntilReset || 1)))} / day
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Weekly Usage Chart */}
        <Card label="Last 7 Days" accentColor="#1A3C2B" className="lg:col-span-2">
          <div className="mt-2">
            <UsageChart history={last7Days} />
          </div>
        </Card>

        {/* Monthly Summary */}
        <Card label="Monthly Summary" accentColor="#FF8C69">
          <div className="mt-2 space-y-3">
            {monthlyUsage.length > 0 ? (
              monthlyUsage.map((month, index) => (
                <div 
                  key={month.month}
                  className={`flex justify-between items-center ${
                    index === 0 ? "pb-3 border-b border-[rgba(58,58,56,0.1)]" : ""
                  }`}
                >
                  <div>
                    <span className={`font-mono text-sm ${index === 0 ? "font-bold text-forest" : "text-grid/70"}`}>
                      {month.monthName}
                    </span>
                    {index === 0 && (
                      <span className="ml-2 px-1.5 py-0.5 text-[8px] font-mono uppercase bg-mint/20 text-forest">
                        Current
                      </span>
                    )}
                  </div>
                  <span className={`font-mono text-sm ${index === 0 ? "text-forest" : "text-grid/60"}`}>
                    {formatTokens(month.tokens)}
                  </span>
                </div>
              ))
            ) : (
              <p className="font-mono text-[11px] text-grid/50">
                No usage history available
              </p>
            )}
          </div>
        </Card>

        {/* Daily Breakdown */}
        <Card label="Daily Breakdown (Last 30 Days)" accentColor="#F4D35E" className="lg:col-span-3">
          <div className="mt-2">
            <div className="grid grid-cols-7 md:grid-cols-10 gap-1">
              {initialHistory.map((day) => {
                const maxTokens = Math.max(...initialHistory.map((d) => d.tokens_used), 1);
                const intensity = day.tokens_used / maxTokens;
                const isToday = todayDate && day.date === todayDate;
                
                return (
                  <div
                    key={day.date}
                    className={`aspect-square flex items-center justify-center text-[8px] font-mono rounded-none cursor-pointer transition-all hover:scale-110 ${
                      isToday ? "ring-1 ring-forest" : ""
                    }`}
                    style={{
                      backgroundColor: day.tokens_used === 0 
                        ? "rgba(58,58,56,0.05)" 
                        : `rgba(26, 60, 43, ${0.1 + intensity * 0.9})`,
                      color: intensity > 0.5 ? "white" : "rgba(26, 60, 43, 0.8)",
                    }}
                    title={`${day.date}: ${formatTokens(day.tokens_used)}`}
                  >
                    {new Date(day.date).getDate()}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-end gap-2 mt-3">
              <span className="font-mono text-[9px] text-grid/40">Less</span>
              <div className="flex gap-0.5">
                {[0.1, 0.3, 0.5, 0.7, 0.9].map((opacity) => (
                  <div
                    key={opacity}
                    className="w-3 h-3 rounded-none"
                    style={{ backgroundColor: `rgba(26, 60, 43, ${opacity})` }}
                  />
                ))}
              </div>
              <span className="font-mono text-[9px] text-grid/40">More</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
