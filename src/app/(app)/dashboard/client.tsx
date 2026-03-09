"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { WeeklyChart } from "@/components/dashboard/weekly-chart";
import { QuickActions } from "@/components/dashboard/quick-actions";

interface DashboardData {
  greeting: string;
  stats: {
    emailsProcessed: number;
    tasksCompleted: number;
    timeSavedHours: number;
    integrationsConnected: number;
  };
  recentActivity: Array<{
    id: string;
    type: 'scan' | 'task' | 'workflow' | 'alert';
    status: 'success' | 'pending' | 'running';
    title: string;
    timestamp: string;
  }>;
  memoryInsights: {
    contactsLearned: number;
    writingStyleSaved: boolean;
    schedulePatterns: number;
    automationIdeas: number;
  };
  weeklyActivity: Array<{ day: string; tasks: number }>;
}

const DEFAULT_WEEKLY = [
  { day: 'Mon', tasks: 0 },
  { day: 'Tue', tasks: 0 },
  { day: 'Wed', tasks: 0 },
  { day: 'Thu', tasks: 0 },
  { day: 'Fri', tasks: 0 },
  { day: 'Sat', tasks: 0 },
  { day: 'Sun', tasks: 0 },
];

export function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const greeting = data?.greeting ?? 'Good day';
  const stats = data?.stats ?? { emailsProcessed: 0, tasksCompleted: 0, timeSavedHours: 0, integrationsConnected: 0 };
  const recentActivity = data?.recentActivity ?? [];
  const memoryInsights = data?.memoryInsights ?? { contactsLearned: 0, writingStyleSaved: false, schedulePatterns: 0, automationIdeas: 0 };
  const weeklyActivity = data?.weeklyActivity ?? DEFAULT_WEEKLY;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="font-header text-3xl font-bold text-forest tracking-tight">
          👋 {greeting}
        </h1>
        <p className="font-body text-base text-grid/60 mt-1">
          {loading ? 'Loading your activity…' : 'Your AI has been busy since you were away'}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon="📧"
          value={stats.emailsProcessed}
          label="Messages"
          sublabel="processed"
          color="text-forest"
        />
        <StatCard
          icon="🤖"
          value={stats.tasksCompleted}
          label="Tasks"
          sublabel="completed"
          color="text-forest"
        />
        <StatCard
          icon="⏱"
          value={stats.timeSavedHours}
          label="Hours"
          sublabel="saved"
          color="text-coral"
          decimals={1}
        />
        <StatCard
          icon="🔗"
          value={stats.integrationsConnected}
          label="Integrations"
          sublabel="connected"
          color="text-forest"
        />
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-header text-base font-semibold text-forest flex items-center gap-2">
            📊 Recent Activity
          </h2>
          <Link
            href="/activity"
            className="font-mono text-[10px] uppercase tracking-wide text-grid/40 hover:text-forest transition-colors"
          >
            View All →
          </Link>
        </div>
        <ActivityFeed items={recentActivity} />
      </div>

      {/* Memory + Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Memory Insights */}
        <div className="border border-[rgba(58,58,56,0.15)] p-5 space-y-3">
          <h2 className="font-header text-base font-semibold text-forest">🧠 Memory Insights</h2>
          <ul className="space-y-1.5">
            <li className="font-body text-sm text-grid">
              <span className="font-semibold text-forest">{memoryInsights.contactsLearned}</span> contacts learned
            </li>
            <li className="font-body text-sm text-grid">
              Writing style {memoryInsights.writingStyleSaved ? <span className="text-green-600 font-semibold">saved</span> : <span className="text-grid/40">not yet saved</span>}
            </li>
            <li className="font-body text-sm text-grid">
              <span className="font-semibold text-forest">{memoryInsights.schedulePatterns}</span> schedule patterns
            </li>
            <li className="font-body text-sm text-grid">
              <span className="font-semibold text-forest">{memoryInsights.automationIdeas}</span> automation ideas
            </li>
          </ul>
          <Link
            href="/memory"
            className="inline-block font-mono text-[10px] uppercase tracking-wide text-forest border border-forest/30 px-3 py-1.5 hover:bg-forest hover:text-paper transition-all"
          >
            View Memory →
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="border border-[rgba(58,58,56,0.15)] p-5 space-y-3">
          <h2 className="font-header text-base font-semibold text-forest">⚡ Quick Actions</h2>
          <QuickActions />
        </div>
      </div>

      {/* Weekly Activity */}
      <div>
        <h2 className="font-header text-base font-semibold text-forest mb-3">📈 This Week</h2>
        <WeeklyChart data={weeklyActivity} />
      </div>
    </div>
  );
}
