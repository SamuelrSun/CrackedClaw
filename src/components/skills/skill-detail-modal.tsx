"use client";

import { X } from "lucide-react";
import type { SkillDetail } from "@/types/skill";

interface SkillDetailModalProps {
  skill: SkillDetail;
  isInstalled: boolean;
  isInstalling: boolean;
  onInstall: (slug: string) => void;
  onUninstall: (slug: string) => void;
  onClose: () => void;
}

export function SkillDetailModal({
  skill,
  isInstalled,
  isInstalling,
  onInstall,
  onUninstall,
  onClose,
}: SkillDetailModalProps) {
  const initial = skill.displayName ? skill.displayName.charAt(0).toUpperCase() : "?";

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0a0a0f]/95 backdrop-blur-[20px] border border-white/10 rounded-[3px] max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-white/[0.08]">
          <div className="flex items-start gap-4">
            {skill.owner?.image ? (
              <img
                src={skill.owner.image}
                alt={skill.displayName}
                className="w-12 h-12 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center text-white/60 text-lg font-medium flex-shrink-0">
                {initial}
              </div>
            )}
            <div>
              <a
                href={`https://clawhub.ai/skills/${skill.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-medium text-white/90 hover:text-white hover:underline transition-colors"
              >
                {skill.displayName}
              </a>
              <p className="font-mono text-[10px] text-white/30">{skill.slug}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Summary */}
          <p className="text-sm text-white/60 leading-relaxed">{skill.summary}</p>

          {/* Stats */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-[2px] p-3 text-center">
              <p className="font-mono text-[9px] text-white/30 uppercase tracking-wide mb-1">Downloads</p>
              <p className="font-mono text-sm text-white/70">{(skill.stats?.downloads ?? skill.downloads ?? 0).toLocaleString()}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-[2px] p-3 text-center">
              <p className="font-mono text-[9px] text-white/30 uppercase tracking-wide mb-1">Stars</p>
              <p className="font-mono text-sm text-white/70">{(skill.stats?.stars ?? skill.stars ?? 0).toLocaleString()}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-[2px] p-3 text-center">
              <p className="font-mono text-[9px] text-white/30 uppercase tracking-wide mb-1">Installs</p>
              <p className="font-mono text-sm text-white/70">{(skill.stats?.installsCurrent ?? skill.installs ?? 0).toLocaleString()}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-[2px] p-3 text-center">
              <p className="font-mono text-[9px] text-white/30 uppercase tracking-wide mb-1">Version</p>
              <p className="font-mono text-sm text-white/70">{skill.version || "-"}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-[2px] p-3 text-center">
              <p className="font-mono text-[9px] text-white/30 uppercase tracking-wide mb-1">Versions</p>
              <p className="font-mono text-sm text-white/70">{skill.stats?.versions ?? skill.versions ?? 0}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-[2px] p-3 text-center">
              <p className="font-mono text-[9px] text-white/30 uppercase tracking-wide mb-1">License</p>
              <p className="font-mono text-sm text-white/70">{skill.license || "MIT"}</p>
            </div>
          </div>

          {/* Author */}
          {skill.owner && (
            <div className="flex items-center gap-2 p-3 bg-white/[0.02] border border-white/[0.06] rounded-[2px]">
              {skill.owner.image ? (
                <img
                  src={skill.owner.image}
                  alt={skill.owner.handle}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-white/[0.08] flex items-center justify-center text-[10px] text-white/30">
                  {skill.owner.handle.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-xs text-white/60">{skill.owner.displayName || skill.owner.handle}</p>
                <p className="font-mono text-[9px] text-white/25">@{skill.owner.handle}</p>
              </div>
            </div>
          )}

          {/* README */}
          {skill.readme && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-white/40 mb-2">Documentation</p>
              <pre className="bg-white/[0.02] border border-white/[0.06] rounded-[2px] p-4 text-xs text-white/50 whitespace-pre-wrap overflow-x-auto font-mono leading-relaxed max-h-[300px] overflow-y-auto">
                {skill.readme}
              </pre>
            </div>
          )}

          {/* Changelog */}
          {skill.changelog && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-white/40 mb-2">Changelog</p>
              <pre className="bg-white/[0.02] border border-white/[0.06] rounded-[2px] p-4 text-xs text-white/50 whitespace-pre-wrap overflow-x-auto font-mono leading-relaxed max-h-[200px] overflow-y-auto">
                {skill.changelog}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/[0.08]">
          {isInstalled ? (
            <button
              onClick={() => onUninstall(skill.slug)}
              disabled={isInstalling}
              className="w-full font-mono text-[11px] uppercase tracking-wide px-4 py-2.5 bg-red-900/10 border border-red-800/20 text-red-400/70 hover:text-red-400 hover:bg-red-900/20 rounded-[2px] transition-colors disabled:opacity-50"
            >
              {isInstalling ? "Removing..." : "Uninstall Skill"}
            </button>
          ) : (
            <button
              onClick={() => onInstall(skill.slug)}
              disabled={isInstalling}
              className="w-full font-mono text-[11px] uppercase tracking-wide px-4 py-2.5 bg-emerald-900/20 border border-emerald-800/30 text-emerald-400 hover:bg-emerald-900/40 rounded-[2px] transition-colors disabled:opacity-50"
            >
              {isInstalling ? "Installing..." : "Install Skill"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
