'use client';

import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';

export interface ScanProgressCardProps {
  scanId: string;
  status: 'running' | 'complete' | 'failed';
  providers: Array<{ name: string; status: string; memories?: number; error?: string }>;
  progress: number;
  currentPhase: string;
  currentMessage: string;
  totalMemories?: number;
  durationSeconds?: number;
  workflowSuggestions?: Array<{ name: string; description: string }>;
  onViewActivity: () => void;
}

const phaseLabel: Record<string, string> = {
  fetching: 'Fetching',
  analyzing: 'Analyzing',
  synthesis: 'Synthesis',
  storing: 'Storing',
  correlating: 'Correlating',
};

const PHASES = ['fetching', 'analyzing', 'synthesis', 'storing'] as const;

function getPhaseStatus(phase: string, currentPhase: string, overallStatus: string): 'done' | 'active' | 'waiting' {
  if (overallStatus === 'complete') return 'done';
  const phases = PHASES as readonly string[];
  const currentIdx = phases.indexOf(currentPhase);
  const phaseIdx = phases.indexOf(phase);
  if (phaseIdx < currentIdx) return 'done';
  if (phaseIdx === currentIdx) return 'active';
  return 'waiting';
}

export function ScanProgressCard({
  status,
  providers,
  progress,
  currentPhase,
  currentMessage,
  totalMemories,
  durationSeconds,
  workflowSuggestions,
  onViewActivity,
}: ScanProgressCardProps) {
  const providerLabel = providers.length === 1
    ? providers[0].name
    : providers.length > 0 ? `${providers.length} providers` : 'workspace';

  if (status === 'complete') {
    return (
      <div className="bg-[#FAFAF8] border border-[rgba(58,58,56,0.15)] rounded-sm p-4 max-w-sm space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#1A3C2B] flex-shrink-0" />
          <span className="font-mono text-[11px] uppercase tracking-wide text-[#1A3C2B] font-semibold">
            {providerLabel} Scan Complete
          </span>
        </div>
        <div className="font-mono text-[10px] text-grid/60 space-y-0.5">
          {totalMemories != null && <div>{totalMemories} memories saved</div>}
          {workflowSuggestions && workflowSuggestions.length > 0 && (
            <div>{workflowSuggestions.length} workflow suggestion{workflowSuggestions.length !== 1 ? 's' : ''}</div>
          )}
          {durationSeconds != null && <div>{durationSeconds}s elapsed</div>}
        </div>
        <button
          onClick={onViewActivity}
          className="flex items-center gap-1.5 font-mono text-[10px] text-[#1A3C2B] hover:text-[#2D6A4F] transition-colors group"
        >
          View Details
          <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="bg-[#FAFAF8] border border-[rgba(58,58,56,0.15)] rounded-sm p-4 max-w-sm space-y-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="font-mono text-[11px] uppercase tracking-wide text-red-600">Scan Failed</span>
        </div>
        <div className="font-mono text-[10px] text-grid/60">{currentMessage || 'An error occurred during the scan.'}</div>
        {providers.filter(p => p.error).map((p, i) => (
          <div key={i} className="font-mono text-[10px] text-red-500/70">{p.name}: {p.error}</div>
        ))}
      </div>
    );
  }

  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="bg-[#FAFAF8] border border-[rgba(58,58,56,0.15)] rounded-sm p-4 max-w-sm space-y-3">
      <div className="flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 text-[#1A3C2B] animate-spin flex-shrink-0" />
        <span className="font-mono text-[11px] uppercase tracking-wide text-[#1A3C2B] font-semibold">
          Scanning {providerLabel}
        </span>
      </div>

      <div className="space-y-1">
        <div className="h-1.5 bg-[rgba(58,58,56,0.08)] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#1A3C2B] to-[#2D6A4F] rounded-full transition-all duration-700 ease-out"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
        <div className="flex justify-between">
          <span className="font-mono text-[9px] text-grid/40">
            {currentPhase ? (phaseLabel[currentPhase] || currentPhase) : 'Starting'}
          </span>
          <span className="font-mono text-[9px] text-grid/40">{Math.round(clampedProgress)}%</span>
        </div>
      </div>

      <div className="space-y-1">
        {PHASES.map(phase => {
          const phStatus = getPhaseStatus(phase, currentPhase, status);
          const msg = phase === currentPhase ? currentMessage : undefined;
          return (
            <div key={phase} className={cn(
              'flex items-start gap-2 font-mono text-[10px]',
              phStatus === 'done' && 'text-[#1A3C2B]/70',
              phStatus === 'active' && 'text-grid',
              phStatus === 'waiting' && 'text-grid/30',
            )}>
              <span className="flex-shrink-0 leading-tight">
                {phStatus === 'done' ? '✅' : phStatus === 'active' ? '🔄' : '⏳'}
              </span>
              <span className="leading-tight">
                <span className="capitalize">{phaseLabel[phase] || phase}</span>
                {msg && phStatus === 'active' && (
                  <span className="text-grid/50">: {msg.length > 50 ? msg.slice(0, 50) + '\u2026' : msg}</span>
                )}
                {phStatus === 'waiting' && <span className="text-grid/25">: Waiting</span>}
              </span>
            </div>
          );
        })}
      </div>

      <button
        onClick={onViewActivity}
        className="flex items-center gap-1.5 font-mono text-[10px] text-[#1A3C2B] hover:text-[#2D6A4F] transition-colors group"
      >
        View Live Activity
        <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </button>
    </div>
  );
}
