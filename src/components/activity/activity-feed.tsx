"use client";

import { useMemo } from "react";
import Link from "next/link";
import { getActivityIcon, getActivityColor } from "@/lib/activity-icons";
import { formatRelativeTime } from "@/lib/time";
import type { ActivityItem } from "@/lib/mock-data";

interface ActivityFeedProps {
  activities: ActivityItem[];
  limit?: number;
  showViewAll?: boolean;
  loading?: boolean;
}

export function ActivityFeed({
  activities,
  limit,
  showViewAll = false,
  loading = false,
}: ActivityFeedProps) {
  const displayedActivities = useMemo(() => {
    return limit ? activities.slice(0, limit) : activities;
  }, [activities, limit]);

  if (loading) {
    return (
      <div className="space-y-3 mt-2">
        {Array.from({ length: limit || 5 }).map((_, i) => (
          <ActivityItemSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-grid/50 mb-2">No recent activity</p>
        <p className="font-mono text-[10px] text-grid/40">
          Activity will appear here once you start using OpenClaw
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1 mt-2">
      {displayedActivities.map((item) => (
        <ActivityItemRow key={item.id} item={item} />
      ))}
      {showViewAll && activities.length > 0 && (
        <div className="pt-3 border-t border-white/[0.08] mt-3">
          <Link
            href="/activity"
            className="font-mono text-[10px] uppercase tracking-wide text-forest hover:text-forest/80 transition-colors"
          >
            View All Activity →
          </Link>
        </div>
      )}
    </div>
  );
}

interface ActivityItemRowProps {
  item: ActivityItem;
}

function ActivityItemRow({ item }: ActivityItemRowProps) {
  const Icon = getActivityIcon(item.action);
  const iconColor = getActivityColor(item.action);
  const relativeTime = formatRelativeTime(item.timestamp);

  return (
    <div className="flex items-start gap-3 py-2 px-2 -mx-2 rounded-sm hover:bg-[rgba(58,58,56,0.03)] transition-colors group">
      {/* Icon */}
      <div
        className="w-7 h-7 flex items-center justify-center flex-shrink-0 border border-white/[0.08] bg-white group-hover:border-white/[0.1] transition-colors"
        style={{ color: iconColor }}
      >
        <Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-grid leading-snug">{item.action}</p>
        {item.detail && (
          <p className="font-mono text-[10px] text-grid/50 truncate mt-0.5">
            {item.detail}
          </p>
        )}
      </div>

      {/* Timestamp */}
      <span className="font-mono text-[10px] text-grid/40 whitespace-nowrap flex-shrink-0 pt-0.5">
        {relativeTime}
      </span>
    </div>
  );
}

function ActivityItemSkeleton() {
  return (
    <div className="flex items-start gap-3 py-2 animate-pulse">
      <div className="w-7 h-7 bg-[rgba(58,58,56,0.1)] flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-[rgba(58,58,56,0.1)] rounded w-3/4" />
        <div className="h-2 bg-[rgba(58,58,56,0.08)] rounded w-1/2" />
      </div>
      <div className="h-2 bg-[rgba(58,58,56,0.08)] rounded w-12" />
    </div>
  );
}

export default ActivityFeed;
