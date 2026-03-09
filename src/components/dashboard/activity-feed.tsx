"use client";

import { formatDistanceToNow } from "date-fns";

type ActivityStatus = 'success' | 'pending' | 'running';
type ActivityType = 'scan' | 'task' | 'workflow' | 'alert';

interface ActivityItem {
  id: string;
  type: ActivityType;
  status: ActivityStatus;
  title: string;
  timestamp: string;
}

const statusDot: Record<ActivityStatus, string> = {
  success: 'bg-green-500',
  pending: 'bg-gold',
  running: 'bg-blue-400',
};

const typeIcon: Record<ActivityType, string> = {
  scan: '📧',
  task: '🤖',
  workflow: '⚡',
  alert: '🔔',
};

function relativeTime(ts: string): string {
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return ts;
  }
}

interface ActivityFeedProps {
  items: ActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className="border border-[rgba(58,58,56,0.15)] p-6 text-center">
        <p className="font-mono text-[11px] text-grid/40 uppercase tracking-wide">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="border border-[rgba(58,58,56,0.15)] divide-y divide-[rgba(58,58,56,0.08)]">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-forest/5 transition-colors">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot[item.status]}`} />
          <span className="text-base flex-shrink-0">{typeIcon[item.type]}</span>
          <span className="flex-1 font-body text-sm text-grid">{item.title}</span>
          <span className="font-mono text-[10px] text-grid/40 whitespace-nowrap">
            {relativeTime(item.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}
