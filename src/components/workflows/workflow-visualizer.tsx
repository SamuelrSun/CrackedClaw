"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface WorkflowStep {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'ai_process';
  name: string;
  description: string;
  icon: string;
  config: Record<string, unknown>;
  integration?: string;
}

export interface WorkflowDef {
  id?: string;
  name: string;
  description: string;
  trigger: {
    type: 'schedule' | 'webhook' | 'event' | 'manual';
    config: Record<string, unknown>;
  };
  steps: WorkflowStep[];
}

const TYPE_COLORS: Record<string, string> = {
  trigger: '#3B82F6',
  action: '#10B981',
  condition: '#F59E0B',
  ai_process: '#8B5CF6',
};

const TYPE_BG: Record<string, string> = {
  trigger: 'bg-blue-50',
  action: 'bg-emerald-50',
  condition: 'bg-amber-900/20',
  ai_process: 'bg-violet-50',
};

const TYPE_LABEL: Record<string, string> = {
  trigger: 'Trigger',
  action: 'Action',
  condition: 'Condition',
  ai_process: 'AI',
};

const TRIGGER_ICONS: Record<string, string> = {
  schedule: '⏰',
  webhook: '🔗',
  event: '⚡',
  manual: '▶️',
};

function TriggerNode({ trigger, visible, onClick, highlighted }: {
  trigger: WorkflowDef['trigger'];
  visible: boolean;
  onClick?: () => void;
  highlighted?: boolean;
}) {
  const icon = TRIGGER_ICONS[trigger.type] || '⚡';
  const label = trigger.type === 'schedule' && trigger.config.cron
    ? `Schedule: ${trigger.config.cron}`
    : trigger.type === 'webhook'
    ? 'Webhook trigger'
    : trigger.type === 'event'
    ? `Event: ${trigger.config.event || 'integration event'}`
    : 'Manual trigger';

  return (
    <div
      className={cn(
        "transition-all duration-500",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          "relative rounded-xl border-2 border-dashed p-4 cursor-pointer transition-all duration-200",
          highlighted ? "shadow-lg scale-[1.02]" : "hover:shadow-md hover:scale-[1.01]",
          TYPE_BG['trigger']
        )}
        style={{ borderColor: TYPE_COLORS['trigger'] }}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">{icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-mono text-[9px] uppercase tracking-wider font-bold" style={{ color: TYPE_COLORS['trigger'] }}>
                Trigger
              </span>
            </div>
            <p className="font-semibold text-sm text-gray-800 truncate">{label}</p>
            {typeof trigger.config.timezone === "string" && (
              <p className="font-mono text-[10px] text-gray-500 mt-0.5">{String(trigger.config.timezone)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepNode({ step, index, visible, onClick, highlighted }: {
  step: WorkflowStep;
  index: number;
  visible: boolean;
  onClick?: () => void;
  highlighted?: boolean;
}) {
  const color = TYPE_COLORS[step.type] || TYPE_COLORS.action;
  const bg = TYPE_BG[step.type] || TYPE_BG.action;
  const label = TYPE_LABEL[step.type] || step.type;

  return (
    <div
      className={cn(
        "transition-all duration-500",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      )}
      style={{ transitionDelay: `${index * 80}ms` }}
      onClick={onClick}
    >
      <div
        className={cn(
          "relative rounded-xl border-l-4 border border-gray-200 p-4 cursor-pointer transition-all duration-200",
          highlighted ? "shadow-lg scale-[1.02]" : "hover:shadow-md hover:scale-[1.01]",
          bg
        )}
        style={{ borderLeftColor: color }}
      >
        <div className="flex items-start gap-3">
          <span className="text-xl">{step.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-mono text-[9px] uppercase tracking-wider font-bold" style={{ color }}>
                {label}
              </span>
              {step.integration && (
                <span className="font-mono text-[8px] uppercase bg-white/60 border border-gray-200 px-1.5 py-0.5 rounded text-gray-500">
                  {step.integration}
                </span>
              )}
            </div>
            <p className="font-semibold text-sm text-gray-800">{step.name}</p>
            {step.description && (
              <p className="font-mono text-[10px] text-gray-500 mt-0.5 line-clamp-2">{step.description}</p>
            )}
          </div>
          <span className="font-mono text-[10px] text-gray-400 font-bold">{index + 1}</span>
        </div>
      </div>
    </div>
  );
}

function Connector({ visible }: { visible: boolean }) {
  return (
    <div className={cn("flex justify-center transition-all duration-300", visible ? "opacity-100" : "opacity-0")}>
      <div className="flex flex-col items-center">
        <div className="w-0.5 h-4 bg-gray-300" />
        <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-300" />
      </div>
    </div>
  );
}

interface WorkflowVisualizerProps {
  workflow: WorkflowDef | null;
  onNodeClick?: (nodeId: string, nodeName: string) => void;
  highlightedId?: string;
  className?: string;
}

export function WorkflowVisualizer({ workflow, onNodeClick, highlightedId, className }: WorkflowVisualizerProps) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (!workflow) {
      setVisibleCount(0);
      return;
    }
    const total = 1 + workflow.steps.length;
    if (visibleCount >= total) return;
    const timer = setTimeout(() => setVisibleCount(v => Math.min(v + 1, total)), 120);
    return () => clearTimeout(timer);
  }, [workflow, visibleCount]);

  // Reset animation when workflow changes substantially
  useEffect(() => {
    setVisibleCount(0);
  }, [workflow?.name]);

  if (!workflow) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full text-center p-8", className)}>
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <span className="text-3xl">⚡</span>
        </div>
        <h3 className="font-semibold text-gray-700 mb-2">No workflow yet</h3>
        <p className="text-sm text-gray-400 max-w-xs">
          Describe what you want to automate in the chat and I'll build it visually here.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5 p-2", className)}>
      {/* Workflow name */}
      <div className="mb-4">
        <h3 className="font-bold text-base text-gray-800">{workflow.name}</h3>
        {workflow.description && (
          <p className="text-xs text-gray-500 mt-0.5">{workflow.description}</p>
        )}
      </div>

      {/* Trigger */}
      <TriggerNode
        trigger={workflow.trigger}
        visible={visibleCount >= 1}
        highlighted={highlightedId === 'trigger'}
        onClick={() => onNodeClick?.('trigger', 'Trigger')}
      />

      {/* Steps */}
      {workflow.steps.map((step, i) => (
        <div key={step.id}>
          <Connector visible={visibleCount >= i + 2} />
          <StepNode
            step={step}
            index={i}
            visible={visibleCount >= i + 2}
            highlighted={highlightedId === step.id}
            onClick={() => onNodeClick?.(step.id, step.name)}
          />
        </div>
      ))}
    </div>
  );
}
