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
  memoryCount?: number;
}

interface AgentActivityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activities: AgentActivityEntry[];
  activeTabId?: string;
  onTabChange?: (id: string) => void;
  overallProgress?: number;
  totalMemories?: number;
  totalWorkflows?: number;
  scanStartedAt?: number;
}

const TAB_ICONS: Record<string, string> = {
  fetching: '📡',
  Fetching: '📡',
  analyzing: '🧠',
  Analyzing: '🧠',
  synthesis: '🔗',
  Synthesis: '🔗',
  storing: '💾',
  Storing: '💾',
  correlating: '🔗',
  Correlating: '🔗',
};

function getTabIcon(name: string): string {
  return TAB_ICONS[name] || '⚙️';
}

function StatusIndicator({ status }: { status: AgentActivityEntry['status'] }) {
  if (status === 'running') {
    return (
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2D6A4F] opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2D6A4F]" />
      </span>
    );
  }
  if (status === 'done') {
    return <span className="text-white/80 text-[10px] font-bold">✓</span>;
  }
  if (status === 'failed') {
    return <span className="text-red-500 text-[10px] font-bold">✗</span>;
  }
  return <span className="h-2 w-2 rounded-full bg-grid/20 flex-shrink-0 inline-block" />;
}

interface LogEntryProps {
  line: string;
  timestamp?: number;
  idx: number;
}

function LogEntry({ line, timestamp, idx }: LogEntryProps) {
  const isHeader = line.startsWith('###') || line.startsWith('##');
  const isBullet = line.trimStart().startsWith('-') || line.trimStart().startsWith('*');
  const isCodeBlock = line.startsWith('```');

  const timeStr = timestamp
    ? new Date(timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  if (isHeader) {
    return (
      <div className="bg-[rgba(26,60,43,0.04)] border-l-2 border-[#1A3C2B] px-2 py-1.5 my-1.5 flex items-start justify-between gap-2">
        <div className="font-mono text-[10px] text-white/80 font-semibold leading-snug prose prose-sm max-w-none prose-p:my-0">
          <ReactMarkdown>{line}</ReactMarkdown>
        </div>
        {timeStr && (
          <span className="font-mono text-[8px] text-grid/30 flex-shrink-0 mt-0.5">{timeStr}</span>
        )}
      </div>
    );
  }

  if (isCodeBlock) {
    return (
      <div className="my-1 bg-[#1A1A1A] rounded px-2 py-1.5">
        <span className="font-mono text-[9px] text-green-400">{line}</span>
      </div>
    );
  }

  const lowerLine = line.toLowerCase();
  const isSuccess = lowerLine.includes('complete') || lowerLine.includes('stored') || lowerLine.includes('fetched') || lowerLine.includes('done') || lowerLine.includes('saved');
  const isActive = lowerLine.includes('running') || lowerLine.includes('analyzing') || lowerLine.includes('correlat') || lowerLine.includes('scanning');
  const isWarn = lowerLine.includes('fail') || lowerLine.includes('error') || lowerLine.includes('warn');

  const borderColor = isSuccess
    ? 'border-l-2 border-[#2D6A4F]/60'
    : isActive
    ? 'border-l-2 border-blue-400/50'
    : isWarn
    ? 'border-l-2 border-yellow-400/60'
    : 'border-l-2 border-transparent';

  return (
    <div key={idx} className={cn('pl-2 py-0.5 flex items-start justify-between gap-2', borderColor, isBullet && 'ml-2')}>
      <div className="font-mono text-[10px] text-grid/70 leading-relaxed prose prose-sm max-w-none prose-p:my-0 prose-strong:text-white/80 flex-1">
        <ReactMarkdown>{line}</ReactMarkdown>
      </div>
      {timeStr && (
        <span className="font-mono text-[8px] text-grid/25 flex-shrink-0 mt-0.5">{timeStr}</span>
      )}
    </div>
  );
}

export function AgentActivityPanel({
  isOpen,
  onClose,
  activities,
  activeTabId,
  onTabChange,
  overallProgress,
  totalMemories,
  totalWorkflows,
  scanStartedAt,
}: AgentActivityPanelProps) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [internalTab, setInternalTab] = useState<string>('');
  const [logTimestamps, setLogTimestamps] = useState<Record<string, number[]>>({});

  const activeId = activeTabId || internalTab || activities[0]?.id || '';
  const activeActivity = activities.find(a => a.id === activeId) || activities[0];

  // Auto-select running tab
  useEffect(() => {
    const runningActivity = activities.find(a => a.status === 'running');
    if (runningActivity) {
      setInternalTab(runningActivity.id);
      onTabChange?.(runningActivity.id);
    } else if (activities.length > 0 && !internalTab) {
      setInternalTab(activities[0].id);
    }
  }, [activities]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track timestamps for new log entries
  useEffect(() => {
    if (!activeActivity) return;
    const id = activeActivity.id;
    setLogTimestamps(prev => {
      const existing = prev[id] || [];
      const newCount = activeActivity.logs.length - existing.length;
      if (newCount <= 0) return prev;
      const now = Date.now();
      const newTimestamps = Array(newCount).fill(now);
      return { ...prev, [id]: [...existing, ...newTimestamps] };
    });
  }, [activeActivity?.logs.length, activeActivity?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom
  useEffect(() => {
    const container = logContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    if (isNearBottom) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeActivity?.logs]);

  const runningCount = activities.filter(a => a.status === 'running').length;

  // Elapsed time
  const elapsedSeconds = scanStartedAt ? Math.round((Date.now() - scanStartedAt) / 1000) : null;

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
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.1] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wide text-grid/70">Agent Activity</span>
          {runningCount > 0 && (
            <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-white/[0.12] text-white font-mono text-[9px]">
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

      {/* Overall progress bar */}
      {overallProgress != null && overallProgress > 0 && overallProgress < 100 && (
        <div className="flex-shrink-0 px-3 pt-2 pb-1">
          <div className="h-1 bg-[rgba(58,58,56,0.08)] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#1A3C2B] to-[#2D6A4F] rounded-full transition-all duration-700 ease-out"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <div className="flex justify-end mt-0.5">
            <span className="font-mono text-[8px] text-grid/30">{Math.round(overallProgress)}%</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      {activities.length > 0 && (
        <div className="flex overflow-x-auto border-b border-white/[0.1] flex-shrink-0">
          {activities.map(activity => (
            <button
              key={activity.id}
              onClick={() => handleTabClick(activity.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2.5 font-mono text-[10px] whitespace-nowrap transition-colors flex-shrink-0',
                (activity.id === activeId)
                  ? 'border-b-2 border-[#1A3C2B] text-white/80 bg-[rgba(26,60,43,0.04)]'
                  : 'text-grid/50 hover:text-grid/70 border-b-2 border-transparent'
              )}
            >
              <span>{getTabIcon(activity.name)}</span>
              <StatusIndicator status={activity.status} />
              <span>{activity.name}</span>
              {activity.status === 'done' && activity.memoryCount != null && activity.memoryCount > 0 && (
                <span className="inline-flex items-center justify-center h-3.5 min-w-[14px] px-1 rounded-full bg-white/[0.12]/15 text-white/80 font-mono text-[8px]">
                  {activity.memoryCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Log area */}
      <div ref={logContainerRef} className="flex-1 overflow-y-auto p-3 space-y-0.5 scroll-smooth">
        {activities.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 py-12">
            <div className="text-3xl opacity-20">🔍</div>
            <p className="font-mono text-[10px] text-grid/30 text-center leading-relaxed">
              No agent activity yet.<br />
              Run a scan to see live progress here.
            </p>
          </div>
        ) : !activeActivity ? null : activeActivity.logs.length === 0 ? (
          <div className="flex items-center gap-1.5 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F] animate-pulse" />
            <span className="font-mono text-[10px] text-grid/40 italic">Waiting for updates...</span>
          </div>
        ) : (
          activeActivity.logs.map((line, idx) => (
            <LogEntry
              key={idx}
              line={line}
              idx={idx}
              timestamp={logTimestamps[activeActivity.id]?.[idx]}
            />
          ))
        )}
        <div ref={logEndRef} />
      </div>

      {/* Summary footer */}
      <div className="flex-shrink-0 border-t border-white/[0.08] px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-[9px] text-grid/40">
            {totalMemories != null && totalMemories > 0 && (
              <span>{totalMemories} memories</span>
            )}
            {totalWorkflows != null && totalWorkflows > 0 && (
              <>
                <span className="text-grid/20">·</span>
                <span>{totalWorkflows} workflows</span>
              </>
            )}
            {elapsedSeconds != null && elapsedSeconds > 0 && (
              <>
                <span className="text-grid/20">·</span>
                <span>{elapsedSeconds}s elapsed</span>
              </>
            )}
          </div>
          {activeActivity && (
            <span className="font-mono text-[9px] text-grid/30">
              {activeActivity.status === 'running'
                ? 'Running...'
                : activeActivity.completedAt
                  ? `Done in ${Math.round((activeActivity.completedAt - activeActivity.startedAt) / 1000)}s`
                  : activeActivity.status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
