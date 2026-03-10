'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

export interface AgentActivityEntry {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  logs: string[];
  startedAt: number;
  completedAt?: number;
}

interface AgentActivityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activities: AgentActivityEntry[];
  activeTabId?: string;
  onTabChange?: (id: string) => void;
}

function StatusIndicator({ status }: { status: AgentActivityEntry['status'] }) {
  if (status === 'running') {
    return (
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
    );
  }
  if (status === 'done') {
    return <span className="text-green-600 text-[10px] font-bold">✓</span>;
  }
  if (status === 'failed') {
    return <span className="text-red-500 text-[10px] font-bold">✗</span>;
  }
  return <span className="h-2 w-2 rounded-full bg-grid/30 flex-shrink-0 inline-block" />;
}

function getLogBorderColor(line: string): string {
  const lower = line.toLowerCase();
  if (lower.includes('complete') || lower.includes('stored') || lower.includes('fetched') || lower.includes('done')) {
    return 'border-l-2 border-green-400/60';
  }
  if (lower.includes('running') || lower.includes('analyzing') || lower.includes('correlat')) {
    return 'border-l-2 border-blue-400/60';
  }
  if (lower.includes('fail') || lower.includes('error') || lower.includes('warn')) {
    return 'border-l-2 border-yellow-400/60';
  }
  return 'border-l-2 border-transparent';
}

export function AgentActivityPanel({
  isOpen,
  onClose,
  activities,
  activeTabId,
  onTabChange,
}: AgentActivityPanelProps) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const [internalTab, setInternalTab] = useState<string>('');

  const activeId = activeTabId || internalTab || activities[0]?.id || '';
  const activeActivity = activities.find(a => a.id === activeId) || activities[0];

  // Auto-select first tab when activities appear
  useEffect(() => {
    if (activities.length > 0 && !internalTab) {
      setInternalTab(activities[0].id);
    }
  }, [activities, internalTab]);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeActivity?.logs]);

  const runningCount = activities.filter(a => a.status === 'running').length;

  const handleTabClick = (id: string) => {
    setInternalTab(id);
    onTabChange?.(id);
  };

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-[#F5F3EF] transition-transform duration-300',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[rgba(58,58,56,0.2)] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wide text-grid/70">Agent Activity</span>
          {runningCount > 0 && (
            <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-[#1A3C2B] text-white font-mono text-[9px]">
              {runningCount}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="font-mono text-[11px] text-grid/40 hover:text-grid/70 transition-colors"
          title="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      {activities.length > 0 && (
        <div className="flex overflow-x-auto border-b border-[rgba(58,58,56,0.15)] flex-shrink-0">
          {activities.map(activity => (
            <button
              key={activity.id}
              onClick={() => handleTabClick(activity.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 font-mono text-[10px] whitespace-nowrap transition-colors flex-shrink-0',
                (activity.id === activeId)
                  ? 'border-b-2 border-[#1A3C2B] text-[#1A3C2B]'
                  : 'text-grid/50 hover:text-grid/70 border-b-2 border-transparent'
              )}
            >
              <StatusIndicator status={activity.status} />
              <span>{activity.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Log area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {activities.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="font-mono text-[10px] text-grid/30 text-center">
              No agent activity yet.<br />
              Run a scan to see live progress here.
            </p>
          </div>
        ) : !activeActivity ? null : activeActivity.logs.length === 0 ? (
          <div className="flex items-center gap-1.5 py-1">
            <span className="font-mono text-[10px] text-grid/40 italic">Waiting for updates...</span>
          </div>
        ) : (
          activeActivity.logs.map((line, idx) => (
            <div
              key={idx}
              className={cn('pl-2 py-0.5', getLogBorderColor(line))}
            >
              <div className="font-mono text-[10px] text-grid/70 leading-relaxed prose prose-sm max-w-none prose-p:my-0">
                <ReactMarkdown>{line}</ReactMarkdown>
              </div>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>

      {/* Footer with timing */}
      {activeActivity && (
        <div className="flex-shrink-0 border-t border-[rgba(58,58,56,0.1)] px-3 py-1.5">
          <span className="font-mono text-[9px] text-grid/30">
            {activeActivity.status === 'running'
              ? `Running...`
              : activeActivity.completedAt
                ? `Completed in ${Math.round((activeActivity.completedAt - activeActivity.startedAt) / 1000)}s`
                : activeActivity.status}
          </span>
        </div>
      )}
    </div>
  );
}
