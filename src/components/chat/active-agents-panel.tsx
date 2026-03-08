"use client";

interface AgentTask {
  id: string;
  label: string;
  startedAt: number;
}

interface ActiveAgentsPanelProps {
  tasks: AgentTask[];
}

export function ActiveAgentsPanel({ tasks }: ActiveAgentsPanelProps) {
  if (tasks.length === 0) return null;

  return (
    <div className="absolute bottom-[72px] left-4 z-10 max-w-[240px]">
      <div className="border border-[rgba(58,58,56,0.15)] bg-paper/90 backdrop-blur-sm px-3 py-2">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#9EFFBF] animate-pulse" />
          <span className="font-mono text-[9px] uppercase tracking-wide text-grid/50">
            {tasks.length} agent{tasks.length > 1 ? "s" : ""} running
          </span>
        </div>
        <div className="space-y-0.5">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-start gap-1.5">
              <span className="font-mono text-[9px] text-grid/40 mt-px">·</span>
              <span className="font-mono text-[9px] text-grid/60 leading-relaxed truncate">
                {task.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
