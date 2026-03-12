"use client";

import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { getActivityIcon, getActivityColor, getActivityCategory } from "@/lib/activity-icons";
import { formatDateWithTime } from "@/lib/time";
import { useRelativeTime } from "@/hooks/use-relative-time";
import type { ActivityItem } from "@/lib/mock-data";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ActivityPageClientProps {
  initialActivities: ActivityItem[];
}

type FilterType = 'all' | 'workflow' | 'chat' | 'integration' | 'memory';
type DateRange = 'today' | 'week' | 'month' | 'all';

const ITEMS_PER_PAGE = 20;

// Client-safe date range calculation
function getDateRangeStartClient(range: DateRange): Date | null {
  const now = new Date();
  
  switch (range) {
    case 'today':
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      return today;
    
    case 'week':
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);
      return weekStart;
    
    case 'month':
      const monthStart = new Date(now);
      monthStart.setDate(monthStart.getDate() - 30);
      monthStart.setHours(0, 0, 0, 0);
      return monthStart;
    
    case 'all':
    default:
      return null;
  }
}

export default function ActivityPageClient({ initialActivities }: ActivityPageClientProps) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);

  // Calculate date range on client only to avoid hydration mismatch
  useEffect(() => {
    setRangeStart(getDateRangeStartClient(dateRange));
  }, [dateRange]);

  // Filter activities
  const filteredActivities = useMemo(() => {
    let filtered = [...initialActivities];

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(item => {
        const category = getActivityCategory(item.action);
        return category === filterType;
      });
    }

    // Filter by date range (only apply if rangeStart is set - i.e., on client)
    if (dateRange !== 'all' && rangeStart) {
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.timestamp);
        return itemDate >= rangeStart;
      });
    }

    // Filter by search
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(item =>
        item.action.toLowerCase().includes(searchLower) ||
        item.detail?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [initialActivities, filterType, dateRange, rangeStart, search]);

  // Pagination
  const totalPages = Math.ceil(filteredActivities.length / ITEMS_PER_PAGE);
  const paginatedActivities = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredActivities.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredActivities, currentPage]);

  // Reset page when filters change
  const handleFilterChange = (newFilter: FilterType) => {
    setFilterType(newFilter);
    setCurrentPage(1);
  };

  const handleDateRangeChange = (newRange: DateRange) => {
    setDateRange(newRange);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  return (
    <div className="p-6">
      <Breadcrumbs 
        items={[
          { label: "Home", href: "/" },
          { label: "Activity" },
        ]} 
      />

      <div className="mb-6">
        <h1 className="font-header text-3xl font-bold tracking-tight leading-tight">
          Activity
        </h1>
        <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mt-1">
          All Activity / History
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        {/* Search */}
        <div className="max-w-md">
          <Input
            label="Search activity"
            placeholder="Filter by action or detail..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        {/* Filter buttons row */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Type filters */}
          <div className="flex items-center gap-1">
            <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mr-2">
              Type:
            </span>
            {(['all', 'workflow', 'chat', 'integration', 'memory'] as FilterType[]).map((type) => (
              <button
                key={type}
                onClick={() => handleFilterChange(type)}
                className={`font-mono text-[10px] uppercase tracking-wide px-2 py-1 border transition-colors ${
                  filterType === type
                    ? 'bg-forest text-white border-forest'
                    : 'bg-white text-grid/70 border-[rgba(58,58,56,0.2)] hover:border-forest/50'
                }`}
              >
                {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          {/* Date range filters */}
          <div className="flex items-center gap-1">
            <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mr-2">
              Range:
            </span>
            {(['today', 'week', 'month', 'all'] as DateRange[]).map((range) => (
              <button
                key={range}
                onClick={() => handleDateRangeChange(range)}
                className={`font-mono text-[10px] uppercase tracking-wide px-2 py-1 border transition-colors ${
                  dateRange === range
                    ? 'bg-forest text-white border-forest'
                    : 'bg-white text-grid/70 border-[rgba(58,58,56,0.2)] hover:border-forest/50'
                }`}
              >
                {range === 'all' ? 'All Time' : range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Activity list */}
      <Card label={`Activity (${filteredActivities.length})`} accentColor="#FF8C69" bordered={false}>
        {paginatedActivities.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-grid/50 mb-2">No activity found</p>
            <p className="font-mono text-[10px] text-grid/40">
              {search || filterType !== 'all' || dateRange !== 'all'
                ? 'Try adjusting your filters'
                : 'Activity will appear here once you start using Dopl'}
            </p>
          </div>
        ) : (
          <div className="mt-2 divide-y divide-[rgba(58,58,56,0.1)]">
            {paginatedActivities.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-[rgba(58,58,56,0.1)]">
            <span className="font-mono text-[10px] text-grid/50">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

interface ActivityRowProps {
  item: ActivityItem;
}

function ActivityRow({ item }: ActivityRowProps) {
  const Icon = getActivityIcon(item.action);
  const iconColor = getActivityColor(item.action);
  const relativeTime = useRelativeTime(item.timestamp);
  const fullTime = formatDateWithTime(item.timestamp);

  return (
    <div className="flex items-start gap-3 py-3 hover:bg-[rgba(58,58,56,0.02)] transition-colors -mx-2 px-2 group">
      {/* Icon */}
      <div
        className="w-8 h-8 flex items-center justify-center flex-shrink-0 border border-[rgba(58,58,56,0.1)] bg-white group-hover:border-[rgba(58,58,56,0.2)] transition-colors"
        style={{ color: iconColor }}
      >
        <Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-grid leading-snug">{item.action}</p>
        {item.detail && (
          <p className="font-mono text-[10px] text-grid/50 mt-0.5">
            {item.detail}
          </p>
        )}
      </div>

      {/* Timestamp with tooltip */}
      <div className="flex-shrink-0 text-right">
        <span 
          className="font-mono text-[10px] text-grid/40 whitespace-nowrap cursor-default"
          title={fullTime}
        >
          {relativeTime || '—'}
        </span>
      </div>
    </div>
  );
}
