"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search } from "lucide-react";
import { GlassNavbar } from "@/components/layout/glass-navbar";
import { SkillCard } from "@/components/skills/skill-card";
import { InstalledSkillCard } from "@/components/skills/installed-skill-card";
import { SkillDetailModal } from "@/components/skills/skill-detail-modal";
import type { SkillItem, SkillDetail } from "@/types/skill";

type SortMode = "all" | "trending" | "downloads" | "newest" | "rating";
type ViewMode = "browse" | "installed";

const QUERY_POOL = [
  "calendar", "ai", "data", "marketing", "finance", "social",
  "developer", "writing", "analytics", "weather", "music",
  "security", "database", "chat", "image",
];

interface SkillsClientProps {
  initialInstalledSlugs: string[];
}

export function SkillsClient({ initialInstalledSlugs }: SkillsClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("all");
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [installedSlugs, setInstalledSlugs] = useState<Set<string>>(new Set(initialInstalledSlugs));
  const [installedSkills, setInstalledSkills] = useState<SkillItem[]>([]);
  const [view, setView] = useState<ViewMode>("browse");
  const [selectedSkill, setSelectedSkill] = useState<SkillDetail | null>(null);
  const [installing, setInstalling] = useState<Set<string>>(new Set());
  const [loadingDetail, setLoadingDetail] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Load More state
  const [loadingMore, setLoadingMore] = useState(false);
  const [seenSlugs, setSeenSlugs] = useState<Set<string>>(new Set());
  const [queryIndex, setQueryIndex] = useState(0);

  // Fetch browse/search results
  const fetchSkills = useCallback(async (query: string, sort: SortMode) => {
    setLoading(true);
    setQueryIndex(0);
    try {
      const params = new URLSearchParams();
      if (query) {
        params.set("q", query);
        params.set("limit", "20");
      } else {
        // "all" uses downloads as a proxy for popular
        params.set("sort", sort === "all" ? "downloads" : sort);
        params.set("limit", "30");
      }
      const res = await fetch(`/api/skills/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        const fetched: SkillItem[] = data.skills || [];
        setSkills(fetched);
        setSeenSlugs(new Set(fetched.map((s) => s.slug)));
      }
    } catch (err) {
      console.error("Failed to fetch skills:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load more skills (only for browse view, not search)
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || queryIndex >= QUERY_POOL.length) return;
    setLoadingMore(true);
    const q = QUERY_POOL[queryIndex];
    setQueryIndex((i) => i + 1);
    try {
      const params = new URLSearchParams({ q, limit: "10" });
      const res = await fetch(`/api/skills/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        const incoming: SkillItem[] = data.skills || [];
        setSkills((prev) => {
          const next = [...prev];
          const seen = new Set(prev.map((s) => s.slug));
          for (const skill of incoming) {
            if (!seen.has(skill.slug)) {
              seen.add(skill.slug);
              next.push(skill);
            }
          }
          setSeenSlugs(seen);
          return next;
        });
      }
    } catch (err) {
      console.error("Failed to load more skills:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, queryIndex]);

  // Fetch installed skills details
  const fetchInstalledSkills = useCallback(async () => {
    if (installedSlugs.size === 0) {
      setInstalledSkills([]);
      return;
    }
    try {
      const res = await fetch("/api/skills/installed");
      if (res.ok) {
        const data = await res.json();
        // API returns { installed: [{ id, slug, name, version, source }] }
        // Map to SkillItem shape for card rendering
        const items = (data.installed || []).map((s: { slug: string; name: string; version?: string; source?: string }) => ({
          slug: s.slug,
          displayName: s.name || s.slug,
          summary: '',
          downloads: 0,
          installs: 0,
          stars: 0,
          version: s.version || null,
          updatedAt: 0,
          owner: null,
        }));
        setInstalledSkills(items);
      }
    } catch (err) {
      console.error("Failed to fetch installed skills:", err);
    }
  }, [installedSlugs.size]);

  // Fetch skill detail
  const fetchSkillDetail = async (slug: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(slug)}`);
      if (res.ok) {
        const data = await res.json();
        // API returns { skill: { ... } }
        setSelectedSkill(data.skill ?? data);
      }
    } catch (err) {
      console.error("Failed to fetch skill detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Install skill
  const handleInstall = async (slug: string) => {
    setInstalling((prev) => new Set(prev).add(slug));
    try {
      const res = await fetch("/api/skills/installed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (res.ok) {
        setInstalledSlugs((prev) => new Set(prev).add(slug));
      }
    } catch (err) {
      console.error("Failed to install skill:", err);
    } finally {
      setInstalling((prev) => {
        const next = new Set(prev);
        next.delete(slug);
        return next;
      });
    }
  };

  // Uninstall skill
  const handleUninstall = async (slug: string) => {
    setInstalling((prev) => new Set(prev).add(slug));
    try {
      const res = await fetch("/api/skills/installed", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (res.ok) {
        setInstalledSlugs((prev) => {
          const next = new Set(prev);
          next.delete(slug);
          return next;
        });
        if (selectedSkill?.slug === slug) {
          setSelectedSkill((prev) => prev ? { ...prev } : null);
        }
      }
    } catch (err) {
      console.error("Failed to uninstall skill:", err);
    } finally {
      setInstalling((prev) => {
        const next = new Set(prev);
        next.delete(slug);
        return next;
      });
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchSkills("", sortMode);
  }, [fetchSkills, sortMode]);

  // Fetch installed skills when switching to installed view
  useEffect(() => {
    if (view === "installed") {
      fetchInstalledSkills();
    }
  }, [view, fetchInstalledSkills]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      fetchSkills(searchQuery, sortMode);
    }, 400);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, sortMode, fetchSkills]);

  const handleCardClick = (skill: SkillItem) => {
    fetchSkillDetail(skill.slug);
  };

  const sidebarItems: { key: SortMode | "installed"; label: string }[] = [
    { key: "all", label: "All" },
    { key: "trending", label: "Trending" },
    { key: "downloads", label: "Popular" },
    { key: "newest", label: "Newest" },
    { key: "rating", label: "Top Rated" },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col p-1 gap-1 md:p-[7px] md:gap-[7px]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url('/img/landing_background.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <GlassNavbar />

      <div className="flex-1 flex gap-1 md:gap-[7px] min-h-0">
        {/* Sidebar - Desktop */}
        <div className="hidden md:flex w-[220px] flex-shrink-0 bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 flex-col p-3">
          <p className="font-mono text-[10px] uppercase tracking-wide text-white/40 mb-3">Browse</p>
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  if (item.key !== "installed") {
                    setView("browse");
                    setSortMode(item.key);
                  }
                }}
                className={`w-full text-left px-3 py-2 rounded-[2px] font-mono text-[10px] uppercase tracking-wide transition-colors ${
                  view === "browse" && sortMode === item.key
                    ? "bg-white/[0.08] text-white/80"
                    : "text-white/40 hover:bg-white/[0.04] hover:text-white/60"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="my-3 border-t border-white/[0.08]" />

          <button
            onClick={() => setView("installed")}
            className={`w-full text-left px-3 py-2 rounded-[2px] font-mono text-[10px] uppercase tracking-wide transition-colors flex items-center justify-between ${
              view === "installed"
                ? "bg-white/[0.08] text-white/80"
                : "text-white/40 hover:bg-white/[0.04] hover:text-white/60"
            }`}
          >
            <span>Installed</span>
            <span className="bg-white/[0.1] px-1.5 py-0.5 rounded-[2px] text-[9px]">
              {installedSlugs.size}
            </span>
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col gap-1 md:gap-[7px] min-h-0 overflow-hidden">
          {/* Mobile Filter + Search */}
          <div className="bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 p-3">
            {/* Mobile dropdown */}
            <div className="md:hidden mb-3">
              <select
                value={view === "installed" ? "installed" : sortMode}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "installed") {
                    setView("installed");
                  } else {
                    setView("browse");
                    setSortMode(val as SortMode);
                  }
                }}
                className="w-full bg-black/30 border border-white/10 rounded-[2px] px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-white/70 focus:outline-none focus:border-white/20"
              >
                <option value="all">All</option>
                <option value="trending">Trending</option>
                <option value="downloads">Popular</option>
                <option value="newest">Newest</option>
                <option value="rating">Top Rated</option>
                <option value="installed">Installed ({installedSlugs.size})</option>
              </select>
            </div>

            {/* Search bar */}
            {view === "browse" && (
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-white/30 flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search skills..."
                  className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-white/70 placeholder:text-white/25"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="font-mono text-[10px] text-white/40 hover:text-white/60"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
            {view === "installed" && (
              <p className="font-mono text-[10px] uppercase tracking-wide text-white/40">
                {installedSlugs.size} skill{installedSlugs.size !== 1 ? "s" : ""} installed
              </p>
            )}
          </div>

          {/* Skills Grid */}
          <div className="flex-1 overflow-y-auto bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 p-3">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-black/[0.07] backdrop-blur-[10px] border border-white/10 rounded-[3px] p-4"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-white/[0.08] animate-pulse" />
                      <div className="flex-1">
                        <div className="w-24 h-4 bg-white/[0.08] rounded-[2px] animate-pulse mb-2" />
                        <div className="w-16 h-2 bg-white/[0.05] rounded-[2px] animate-pulse" />
                      </div>
                    </div>
                    <div className="space-y-2 mb-3">
                      <div className="w-full h-3 bg-white/[0.05] rounded-[2px] animate-pulse" />
                      <div className="w-3/4 h-3 bg-white/[0.04] rounded-[2px] animate-pulse" />
                    </div>
                    <div className="w-20 h-6 bg-white/[0.06] rounded-[2px] animate-pulse" />
                  </div>
                ))}
              </div>
            ) : view === "browse" ? (
              skills.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <p className="font-mono text-[11px] text-white/40 mb-2">No skills found.</p>
                  <p className="font-mono text-[10px] text-white/25">Try a different search.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {skills.map((skill) => (
                      <SkillCard
                        key={skill.slug}
                        skill={skill}
                        isInstalled={installedSlugs.has(skill.slug)}
                        isInstalling={installing.has(skill.slug)}
                        onInstall={handleInstall}
                        onClick={handleCardClick}
                      />
                    ))}
                  </div>
                  {/* Load More button (browse view, not search) */}
                  {!searchQuery && queryIndex < QUERY_POOL.length && (
                    <div className="flex justify-center mt-4">
                      <button
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="font-mono text-[10px] px-6 py-2 bg-white/[0.05] border border-white/[0.1] text-white/50 hover:text-white/70 hover:bg-white/[0.08] rounded-[2px] transition-colors disabled:opacity-50"
                      >
                        {loadingMore ? "Loading..." : "Load More"}
                      </button>
                    </div>
                  )}
                </>
              )
            ) : installedSlugs.size === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <p className="font-mono text-[11px] text-white/40 mb-2">No skills installed yet.</p>
                <p className="font-mono text-[10px] text-white/25">
                  Browse the catalog to get started.
                </p>
                <button
                  onClick={() => setView("browse")}
                  className="mt-4 font-mono text-[10px] px-4 py-2 bg-emerald-900/20 border border-emerald-800/30 text-emerald-400 hover:bg-emerald-900/40 rounded-[2px] transition-colors"
                >
                  Browse Skills
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {installedSkills.length > 0
                  ? installedSkills.map((skill) => (
                      <InstalledSkillCard
                        key={skill.slug}
                        skill={skill}
                        isUninstalling={installing.has(skill.slug)}
                        onUninstall={handleUninstall}
                        onClick={handleCardClick}
                      />
                    ))
                  : Array.from(installedSlugs).map((slug) => (
                      <div
                        key={slug}
                        className="bg-black/[0.07] backdrop-blur-[10px] border border-white/10 rounded-[3px] p-4 flex items-center justify-between"
                      >
                        <span className="font-mono text-xs text-white/60">{slug}</span>
                        <button
                          onClick={() => handleUninstall(slug)}
                          disabled={installing.has(slug)}
                          className="font-mono text-[10px] px-3 py-1 bg-red-900/10 border border-red-800/20 text-red-400/60 hover:text-red-400 hover:bg-red-900/20 rounded-[2px] transition-colors disabled:opacity-50"
                        >
                          {installing.has(slug) ? "..." : "Uninstall"}
                        </button>
                      </div>
                    ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedSkill && (
        <SkillDetailModal
          skill={selectedSkill}
          isInstalled={installedSlugs.has(selectedSkill.slug)}
          isInstalling={installing.has(selectedSkill.slug)}
          onInstall={handleInstall}
          onUninstall={handleUninstall}
          onClose={() => setSelectedSkill(null)}
        />
      )}

      {/* Loading overlay for detail fetch */}
      {loadingDetail && (
        <div className="fixed inset-0 z-[199] bg-black/40 flex items-center justify-center">
          <div className="bg-black/80 backdrop-blur-[10px] border border-white/10 rounded-[3px] px-6 py-4">
            <div className="flex items-center gap-3">
              <svg className="animate-spin w-4 h-4 text-white/50" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="font-mono text-[11px] text-white/50">Loading skill details...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
