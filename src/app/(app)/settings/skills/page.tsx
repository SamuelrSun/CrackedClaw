"use client";

import { useState, useEffect } from "react";
import { BUILTIN_SKILLS, type SkillDefinition } from "@/lib/skills/registry";

interface SkillWithStatus extends SkillDefinition {
  installed: boolean;
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch('/api/skills')
      .then(r => r.json())
      .then(d => setSkills(d.skills || []))
      .finally(() => setLoading(false));
  }, []);

  const install = async (skillId: string) => {
    setInstalling(skillId);
    try {
      const res = await fetch('/api/skills/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId }),
      });
      if (res.ok) {
        setSkills(prev => prev.map(s => s.id === skillId ? { ...s, installed: true } : s));
      }
    } finally {
      setInstalling(null);
    }
  };

  const uninstall = async (skillId: string) => {
    setInstalling(skillId);
    try {
      await fetch(`/api/skills/${skillId}`, { method: 'DELETE' });
      setSkills(prev => prev.map(s => s.id === skillId ? { ...s, installed: false } : s));
    } finally {
      setInstalling(null);
    }
  };

  const filtered = skills.filter(s =>
    !query || s.name.toLowerCase().includes(query.toLowerCase()) || s.description.toLowerCase().includes(query.toLowerCase())
  );
  const installed = filtered.filter(s => s.installed);
  const available = filtered.filter(s => !s.installed);

  return (
    <div className="p-6">
      <h1 className="font-header text-3xl font-bold tracking-tight mb-1">Skills</h1>
      <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mb-2">
        Expand your AI&apos;s capabilities
      </p>
      <p className="font-mono text-[11px] text-grid/50 mb-6 max-w-xl">
        Skills inject domain expertise into your AI. You can also ask your AI to install any skill at any time — just say &ldquo;install a skill for [topic]&rdquo; in chat.
      </p>

      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search skills..."
        className="w-full border border-white/[0.1] bg-paper px-3 py-2 font-mono text-xs outline-none placeholder:text-grid/30 mb-6"
      />

      {loading ? (
        <p className="font-mono text-xs text-grid/40">Loading skills...</p>
      ) : (
        <div className="space-y-6">
          {installed.length > 0 && (
            <section>
              <p className="font-mono text-[10px] uppercase tracking-wide text-grid/40 mb-3">Installed ({installed.length})</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {installed.map(skill => (
                  <SkillCard key={skill.id} skill={skill} onInstall={install} onUninstall={uninstall} isLoading={installing === skill.id} />
                ))}
              </div>
            </section>
          )}
          <section>
            <p className="font-mono text-[10px] uppercase tracking-wide text-grid/40 mb-3">Available{available.length > 0 ? ` (${available.length})` : ''}</p>
            {available.length === 0 ? (
              <p className="font-mono text-xs text-grid/40">All skills installed!</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {available.map(skill => (
                  <SkillCard key={skill.id} skill={skill} onInstall={install} onUninstall={uninstall} isLoading={installing === skill.id} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function SkillCard({ skill, onInstall, onUninstall, isLoading }: {
  skill: SkillWithStatus;
  onInstall: (id: string) => void;
  onUninstall: (id: string) => void;
  isLoading: boolean;
}) {
  return (
    <div className={`border p-4 transition-colors ${skill.installed ? 'border-forest/30 bg-forest/5' : 'border-white/[0.1] bg-paper'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{skill.icon}</span>
          <div>
            <p className="font-header font-bold text-sm">{skill.name}</p>
            <p className="font-mono text-[9px] text-grid/40">{skill.version}</p>
          </div>
        </div>
        {skill.installed && (
          <span className="font-mono text-[9px] uppercase tracking-wide text-forest flex items-center gap-1">
            <span>✓</span> Installed
          </span>
        )}
      </div>
      <p className="font-mono text-[10px] text-grid/60 mb-2">{skill.description}</p>
      <div className="flex flex-wrap gap-1 mb-3">
        {skill.capabilities.slice(0, 3).map(cap => (
          <span key={cap} className="font-mono text-[8px] bg-grid/5 px-2 py-0.5 border border-white/[0.08] text-grid/50">{cap}</span>
        ))}
      </div>
      {skill.installed ? (
        <button onClick={() => onUninstall(skill.id)} disabled={isLoading} className="font-mono text-[10px] uppercase tracking-wide text-coral/70 hover:text-coral transition-colors disabled:opacity-50">
          {isLoading ? 'Removing...' : 'Uninstall'}
        </button>
      ) : (
        <button onClick={() => onInstall(skill.id)} disabled={isLoading} className="w-full py-1.5 font-mono text-[10px] uppercase tracking-wide border border-grid/40 hover:bg-grid hover:text-paper transition-colors disabled:opacity-50">
          {isLoading ? 'Installing...' : 'Install Skill'}
        </button>
      )}
    </div>
  );
}
