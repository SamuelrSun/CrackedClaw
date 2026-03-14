"use client";

import { useState } from "react";
import { getSkillById } from "@/lib/skills/registry";

interface SkillSuggestCardProps {
  skillId: string;
  reason: string;
  onInstalled?: (skillId: string) => void;
}

export function SkillSuggestCard({ skillId, reason, onInstalled }: SkillSuggestCardProps) {
  const skill = getSkillById(skillId);
  const [state, setState] = useState<'idle' | 'installing' | 'installed' | 'dismissed'>('idle');

  if (!skill || state === 'dismissed') return null;

  const install = async () => {
    setState('installing');
    try {
      const res = await fetch('/api/skills/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId }),
      });
      if (res.ok) {
        setState('installed');
        onInstalled?.(skillId);
      } else {
        setState('idle');
      }
    } catch {
      setState('idle');
    }
  };

  if (state === 'installed') {
    return (
      <div className="my-2 p-3 border border-forest/30 bg-forest/5 flex items-center gap-2">
        <span>✅</span>
        <p className="font-mono text-[11px] text-forest">{skill.name} installed! I&apos;ll use it going forward.</p>
      </div>
    );
  }

  return (
    <div className="my-3 border border-white/[0.1] bg-amber-900/20 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span>💡</span>
        <p className="font-mono text-[9px] uppercase tracking-wide text-grid/40">Skill Suggestion</p>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{skill.icon}</span>
        <p className="font-header font-bold text-sm">{skill.name}</p>
      </div>
      <p className="font-mono text-[10px] text-grid/60 mb-3">{reason}</p>
      <div className="flex flex-wrap gap-1 mb-3">
        {skill.capabilities.slice(0, 4).map(cap => (
          <span key={cap} className="font-mono text-[8px] bg-grid/5 px-2 py-0.5 border border-white/[0.08] text-grid/50">{cap}</span>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={install}
          disabled={state === 'installing'}
          className="flex-1 py-1.5 font-mono text-[10px] uppercase tracking-wide bg-grid text-paper hover:bg-grid/80 transition-colors disabled:opacity-50"
        >
          {state === 'installing' ? 'Installing...' : 'Install Skill'}
        </button>
        <button onClick={() => setState('dismissed')} className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide border border-white/[0.1] hover:bg-grid/5 transition-colors">
          Not now
        </button>
      </div>
    </div>
  );
}
