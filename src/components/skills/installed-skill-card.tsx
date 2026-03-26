"use client";

import type { SkillItem } from "@/types/skill";

interface InstalledSkillCardProps {
  skill: SkillItem;
  isUninstalling: boolean;
  onUninstall: (slug: string) => void;
  onClick: (skill: SkillItem) => void;
}

export function InstalledSkillCard({ skill, isUninstalling, onUninstall, onClick }: InstalledSkillCardProps) {
  const initial = skill.displayName ? skill.displayName.charAt(0).toUpperCase() : "?";

  return (
    <div
      className="bg-black/[0.07] backdrop-blur-[10px] border border-white/10 rounded-[3px] p-4 flex flex-col gap-3 cursor-pointer hover:border-white/20 transition-colors"
      onClick={() => onClick(skill)}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {skill.owner?.image ? (
          <img
            src={skill.owner.image}
            alt={skill.displayName}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center text-white/60 text-sm font-medium flex-shrink-0">
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <a
            href={`https://clawhub.ai/skills/${skill.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-white/80 truncate hover:text-white/95 hover:underline transition-colors block"
            onClick={(e) => e.stopPropagation()}
          >
            {skill.displayName}
          </a>
          <p className="font-mono text-[9px] text-white/25 truncate">{skill.slug}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {skill.version && (
            <span className="font-mono text-[9px] px-2 py-0.5 bg-white/[0.05] border border-white/[0.08] text-white/35 rounded-[2px]">
              v{skill.version}
            </span>
          )}
        </div>
      </div>

      {/* Summary */}
      <p className="text-xs text-white/50 leading-relaxed line-clamp-2 flex-1">
        {skill.summary || "No description available."}
      </p>

      {/* Stats */}
      <p className="font-mono text-[9px] text-white/30">
        ↓ {(skill.downloads ?? 0).toLocaleString()} · ⭐ {(skill.stars ?? 0).toLocaleString()}{skill.version ? ` · v${skill.version}` : ""}
      </p>

      {/* Author */}
      {skill.owner && (
        <div className="flex items-center gap-1.5">
          {skill.owner.image ? (
            <img
              src={skill.owner.image}
              alt={skill.owner.handle}
              width={16}
              height={16}
              className="rounded-full"
            />
          ) : (
            <div className="w-4 h-4 rounded-full bg-white/[0.08] flex items-center justify-center text-[8px] text-white/30">
              {skill.owner.handle.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="font-mono text-[9px] text-white/25 truncate">@{skill.owner.handle}</span>
        </div>
      )}

      {/* Footer */}
      <div onClick={(e) => e.stopPropagation()}>
        {isUninstalling ? (
          <span className="font-mono text-[10px] px-3 py-1 bg-white/[0.05] border border-white/[0.08] text-white/40 rounded-[2px] flex items-center gap-1.5 w-fit">
            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Removing...
          </span>
        ) : (
          <button
            className="font-mono text-[10px] px-3 py-1 bg-red-900/10 border border-red-800/20 text-red-400/60 hover:text-red-400 hover:bg-red-900/20 rounded-[2px] transition-colors"
            onClick={() => onUninstall(skill.slug)}
          >
            Uninstall
          </button>
        )}
      </div>
    </div>
  );
}
