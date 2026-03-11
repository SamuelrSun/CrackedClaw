"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Play, Pause, Trash2, Clock, BarChart2, Activity, ChevronRight, Plus, Zap, RefreshCw } from "lucide-react";

type WorkerStatus = "active" | "idle" | "error" | "paused";

interface Worker {
  id: string;
  name: string;
  title: string;
  role: string | null;
  avatar_config: { hair_color?: string; skin_color?: string } | null;
  cron_job_id: string | null;
  workflow_type: string;
  schedule: string | null;
  status: WorkerStatus;
  last_active_at: string | null;
  last_result: string | null;
  error_message: string | null;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  desk_position: number | null;
  created_at: string;
  updated_at: string;
}

interface WorkerActivity {
  id: string;
  event_type: string;
  summary: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<WorkerStatus, {
  dot: string; label: string; screenBg: string; textColor: string; glowColor: string;
}> = {
  active: {
    dot: "#22c55e",
    label: "Active",
    screenBg: "linear-gradient(180deg, #0a1a0f 0%, #0d2a14 100%)",
    textColor: "#4ade80",
    glowColor: "rgba(34,197,94,0.15)",
  },
  idle: {
    dot: "#9ca3af",
    label: "Idle",
    screenBg: "linear-gradient(180deg, #111827 0%, #1f2937 100%)",
    textColor: "#6b7280",
    glowColor: "rgba(156,163,175,0.08)",
  },
  error: {
    dot: "#ef4444",
    label: "Error",
    screenBg: "linear-gradient(180deg, #1a0505 0%, #2a0a0a 100%)",
    textColor: "#f87171",
    glowColor: "rgba(239,68,68,0.15)",
  },
  paused: {
    dot: "#f59e0b",
    label: "Paused",
    screenBg: "linear-gradient(180deg, #1a1500 0%, #2a2000 100%)",
    textColor: "#fbbf24",
    glowColor: "rgba(245,158,11,0.12)",
  },
};

const ANIMATION_STYLES = `
  @keyframes workerBob {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-4px); }
  }
  @keyframes workerDroop {
    0%, 100% { transform: rotate(-5deg) translateY(2px); }
    50% { transform: rotate(-3deg) translateY(0px); }
  }
  @keyframes cursorBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  @keyframes screenPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.85; }
  }
  @keyframes errorShake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-2px); }
    75% { transform: translateX(2px); }
  }
  @keyframes panelSlideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes overlayFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes exclamBounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }
  @keyframes skeletonShimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  .worker-bob { animation: workerBob 2s ease-in-out infinite; }
  .worker-droop { animation: workerDroop 3s ease-in-out infinite; }
  .worker-error { animation: errorShake 0.8s ease-in-out infinite; }
  .worker-paused { opacity: 0.65; }
  .cursor-blink { animation: cursorBlink 1s step-end infinite; }
  .screen-pulse { animation: screenPulse 3s ease-in-out infinite; }
  .exclaim-bounce { animation: exclamBounce 1s ease-in-out infinite; }
  .panel-slide-in { animation: panelSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .overlay-fade-in { animation: overlayFadeIn 0.2s ease forwards; }
  .skeleton-shimmer {
    background: linear-gradient(90deg, rgba(58,58,56,0.06) 25%, rgba(58,58,56,0.12) 50%, rgba(58,58,56,0.06) 75%);
    background-size: 800px 100%;
    animation: skeletonShimmer 1.5s infinite;
    border-radius: 6px;
  }
`;

function getScreenLines(worker: Worker): string[] {
  if (worker.status === "error") {
    return [
      `\u2717 ${(worker.error_message || "error occurred").slice(0, 18)}`,
      "retry queued",
      worker.workflow_type || "workflow",
      "\u2192 queued",
    ];
  }
  if (worker.status === "paused") {
    return ["\u23f8 paused", `runs: ${worker.total_runs}`, worker.schedule || "on demand", "\u2014 suspended \u2014"];
  }
  if (worker.status === "idle") {
    return ["\u2014 standby \u2014", `runs: ${worker.total_runs}`, worker.schedule || "on demand", "waiting..."];
  }
  const result = worker.last_result;
  if (result) {
    return ["\u2192 running...", `\u2713 ${result.slice(0, 18)}`, "\u2192 logging", "\u2713 done"];
  }
  return ["\u2192 running...", "processing...", worker.workflow_type || "workflow", "\u2713 done"];
}

function Workstation({ worker, onClick }: { worker: Worker; onClick: () => void }) {
  const cfg = STATUS_CONFIG[worker.status];
  const bobClass =
    worker.status === "active" ? "worker-bob"
    : worker.status === "idle" ? "worker-droop"
    : worker.status === "paused" ? "worker-paused"
    : "worker-error";

  const hairColor = worker.avatar_config?.hair_color || "#2D5016";
  const skinColor = worker.avatar_config?.skin_color || "#F4C17A";
  const screenLines = getScreenLines(worker);

  return (
    <div
      onClick={onClick}
      style={{
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0px",
        width: "180px",
        userSelect: "none",
      }}
    >
      {worker.status === "error" && (
        <div
          className="exclaim-bounce"
          style={{ fontSize: "18px", marginBottom: "2px", filter: "drop-shadow(0 0 4px rgba(239,68,68,0.6))" }}
        >
          ❗
        </div>
      )}
      {worker.status === "paused" && (
        <div style={{ fontSize: "18px", marginBottom: "2px", filter: "drop-shadow(0 0 4px rgba(245,158,11,0.6))" }}>
          ⏸
        </div>
      )}

      <div
        className={bobClass}
        style={{
          position: "relative",
          zIndex: 2,
          marginBottom: "-4px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{
          width: "36px",
          height: "14px",
          background: hairColor,
          borderRadius: "18px 18px 0 0",
          marginBottom: "-2px",
        }} />
        <div style={{
          width: "34px",
          height: "34px",
          background: skinColor,
          borderRadius: "50%",
          border: `2px solid ${hairColor}33`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px",
          position: "relative",
        }}>
          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
            <div style={{ width: "4px", height: "4px", background: "#1A3C2B", borderRadius: "50%" }} />
            <div style={{ width: "4px", height: "4px", background: "#1A3C2B", borderRadius: "50%" }} />
          </div>
          <div style={{
            width: "10px",
            height: "3px",
            borderRadius: "0 0 4px 4px",
            background: worker.status === "error" ? "#dc2626" : worker.status === "active" ? "#16a34a" : "#6b7280",
            opacity: 0.7,
          }} />
        </div>
        <div style={{
          width: "28px",
          height: "16px",
          background: worker.status === "active" ? "#1A3C2B" : worker.status === "error" ? "#7f1d1d" : "#374151",
          borderRadius: "4px 4px 0 0",
          marginTop: "1px",
        }} />
      </div>

      <div style={{
        width: "40px",
        height: "10px",
        background: "linear-gradient(180deg, #374151 0%, #1f2937 100%)",
        borderRadius: "4px",
        zIndex: 1,
        marginBottom: "-2px",
      }} />

      <div style={{
        width: "160px",
        height: "70px",
        background: "linear-gradient(180deg, #8B5E3C 0%, #6B4226 60%, #5A3820 100%)",
        borderRadius: "8px",
        border: "1px solid rgba(139,94,60,0.4)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: "8px",
        gap: "6px",
        position: "relative",
        zIndex: 0,
      }}>
        <div style={{ width: "6px", height: "8px", background: "#4b5563", borderRadius: "1px" }} />

        <div
          className={worker.status === "active" ? "screen-pulse" : undefined}
          style={{
            position: "absolute",
            top: "-44px",
            width: "90px",
            height: "58px",
            background: cfg.screenBg,
            borderRadius: "4px",
            border: `1.5px solid ${worker.status === "active" ? "#22c55e44" : worker.status === "error" ? "#ef444444" : "#37415144"}`,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "4px 6px",
            gap: "3px",
            boxShadow: `0 0 12px ${cfg.glowColor}`,
          }}
        >
          {screenLines.map((line, i) => (
            <div
              key={i}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "7px",
                color: cfg.textColor,
                opacity: i === screenLines.length - 1 && worker.status === "active" ? 0.9 : 0.7,
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              {line}
              {i === screenLines.length - 1 && worker.status === "active" && (
                <span className="cursor-blink" style={{ color: cfg.textColor }}>█</span>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "8px", marginTop: "22px", alignItems: "flex-end" }}>
          <div style={{
            width: "12px", height: "14px",
            background: "linear-gradient(180deg, #e5e7eb 0%, #d1d5db 100%)",
            borderRadius: "2px 2px 3px 3px",
            border: "1px solid #9ca3af",
            opacity: 0.8,
          }} />
          <div style={{
            width: "18px", height: "12px",
            background: "linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%)",
            borderRadius: "1px",
            border: "1px solid #d1d5db",
            opacity: 0.6,
          }} />
        </div>
      </div>

      <div style={{ marginTop: "10px", textAlign: "center" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "5px",
          marginBottom: "2px",
        }}>
          <div style={{
            width: "7px", height: "7px", borderRadius: "50%",
            background: cfg.dot, flexShrink: 0,
            boxShadow: `0 0 6px ${cfg.dot}`,
          }} />
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 600, fontSize: "14px", color: "#1A3C2B",
          }}>{worker.name}</span>
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "10px", color: "#3A3A38", opacity: 0.6, letterSpacing: "0.05em",
        }}>{worker.title}</div>
      </div>
    </div>
  );
}

function HireWorkerSlot({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: "180px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        cursor: "pointer",
        opacity: 0.55,
        transition: "opacity 0.2s",
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
      onMouseLeave={e => (e.currentTarget.style.opacity = "0.55")}
    >
      <div style={{ height: "64px", display: "flex", alignItems: "flex-end" }}>
        <div style={{
          width: "34px", height: "34px", borderRadius: "50%",
          border: "2px dashed #3A3A3870",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Plus style={{ width: "14px", height: "14px", color: "#3A3A3870" }} />
        </div>
      </div>
      <div style={{ height: "10px" }} />
      <div style={{
        width: "160px", height: "70px",
        border: "2px dashed rgba(58,58,56,0.22)",
        borderRadius: "8px",
        background: "rgba(58,58,56,0.03)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "10px", color: "#3A3A38", opacity: 0.5, textAlign: "center", lineHeight: "1.6",
        }}>+ Hire a Worker</div>
      </div>
      <div style={{ marginTop: "10px" }}>
        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 500, fontSize: "13px", color: "#1A3C2B", opacity: 0.45,
        }}>Open a role</div>
      </div>
    </div>
  );
}

function SectionLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
      <span style={{ width: "13px", height: "13px", color: "#1A3C2B", opacity: 0.45, display: "flex" }}>{icon}</span>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "10px", textTransform: "uppercase" as const,
        letterSpacing: "0.1em", color: "#1A3C2B", opacity: 0.45, fontWeight: 500,
      }}>{text}</span>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: "10px",
        color: "#3A3A38", opacity: 0.4, flexShrink: 0, width: "72px",
        paddingTop: "1px", textTransform: "uppercase" as const, letterSpacing: "0.05em",
      }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function StatCard({ label, value, accent = "#1A3C2B" }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{
      background: "rgba(26,60,43,0.04)",
      border: "1px solid rgba(58,58,56,0.1)",
      borderRadius: "6px", padding: "14px", textAlign: "center",
    }}>
      <div style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 700, fontSize: "24px", color: accent, marginBottom: "4px",
      }}>{value}</div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "10px", color: "#3A3A38", opacity: 0.45,
        textTransform: "uppercase" as const, letterSpacing: "0.08em",
      }}>{label}</div>
    </div>
  );
}

function ControlButton({ icon, label, variant, onClick }: {
  icon: React.ReactNode; label: string;
  variant: "primary" | "secondary" | "danger";
  onClick?: () => void;
}) {
  const styles = {
    primary: { background: "#1A3C2B", color: "#F7F7F5", border: "1px solid #1A3C2B" },
    secondary: { background: "transparent", color: "#1A3C2B", border: "1px solid rgba(58,58,56,0.2)" },
    danger: { background: "transparent", color: "#dc2626", border: "1px solid rgba(220,38,38,0.3)" },
  };
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: "6px",
        padding: "8px 14px", borderRadius: "4px", cursor: "pointer",
        fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", fontWeight: 500,
        transition: "opacity 0.15s",
        ...styles[variant],
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
      onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
    >
      <span style={{ width: "14px", height: "14px", display: "flex" }}>{icon}</span>
      {label}
    </button>
  );
}

function WorkerPanel({
  worker,
  onClose,
  activity,
  onPauseResume,
  onRemove,
}: {
  worker: Worker;
  onClose: () => void;
  activity: WorkerActivity[];
  onPauseResume: (w: Worker) => void;
  onRemove: (w: Worker) => void;
}) {
  const cfg = STATUS_CONFIG[worker.status];
  const hairColor = worker.avatar_config?.hair_color || "#2D5016";
  const skinColor = worker.avatar_config?.skin_color || "#F4C17A";
  const successRate = worker.total_runs > 0
    ? Math.round((worker.successful_runs / worker.total_runs) * 100)
    : 0;

  const activityLog = activity.map(a => ({
    time: new Date(a.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    entry: a.summary || a.event_type,
  }));

  return (
    <>
      <div
        className="overlay-fade-in"
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(26,60,43,0.12)", zIndex: 40,
        }}
      />
      <div
        className="panel-slide-in"
        style={{
          position: "fixed", right: 0, top: 0, bottom: 0, width: "420px",
          background: "#F7F7F5", borderLeft: "1px solid rgba(58,58,56,0.15)",
          zIndex: 50, overflowY: "auto", display: "flex", flexDirection: "column",
        }}
      >
        <div style={{
          padding: "24px 24px 20px",
          borderBottom: "1px solid rgba(58,58,56,0.1)",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "44px", height: "44px", borderRadius: "50%",
              background: skinColor,
              border: `2px solid ${hairColor}33`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "20px", fontFamily: "sans-serif", fontWeight: "bold",
              color: hairColor, flexShrink: 0,
            }}>
              {worker.name[0]}
            </div>
            <div>
              <h2 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700, fontSize: "20px", color: "#1A3C2B", margin: 0,
              }}>{worker.name}</h2>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px", color: "#3A3A38", opacity: 0.55, marginTop: "2px",
              }}>{worker.title}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "1px solid rgba(58,58,56,0.15)",
              borderRadius: "4px", padding: "6px", cursor: "pointer",
              display: "flex", alignItems: "center", color: "#3A3A38",
            }}
          >
            <X style={{ width: "16px", height: "16px" }} />
          </button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "24px", flex: 1 }}>
          <section>
            <SectionLabel icon={<Zap style={{ width: "13px", height: "13px" }} />} text="Overview" />
            <div style={{
              background: "rgba(26,60,43,0.04)", border: "1px solid rgba(58,58,56,0.1)",
              borderRadius: "6px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px",
            }}>
              <Row label="Status">
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: "5px",
                  fontFamily: "'JetBrains Mono', monospace", fontSize: "11px",
                  color: cfg.dot, fontWeight: 500,
                }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: cfg.dot, display: "inline-block" }} />
                  {cfg.label}
                </span>
              </Row>
              <Row label="Role">
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "12px", color: "#1A3C2B", lineHeight: "1.5" }}>
                  {worker.role || worker.workflow_type}
                </span>
              </Row>
              <Row label="Schedule">
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#3A3A38" }}>
                  {worker.schedule || "On demand"}
                </span>
              </Row>
              <Row label="Last run">
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "12px", color: "#1A3C2B", lineHeight: "1.5" }}>
                  {worker.last_result || "No activity yet"}
                </span>
              </Row>
            </div>
          </section>

          <section>
            <SectionLabel icon={<Activity style={{ width: "13px", height: "13px" }} />} text="Activity Log" />
            <div style={{ border: "1px solid rgba(58,58,56,0.1)", borderRadius: "6px", overflow: "hidden" }}>
              {activityLog.length === 0 ? (
                <div style={{ padding: "16px 14px", textAlign: "center" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#3A3A38", opacity: 0.4 }}>
                    No activity recorded yet
                  </span>
                </div>
              ) : activityLog.map((entry, i) => (
                <div key={i} style={{
                  display: "flex", gap: "12px", padding: "10px 14px",
                  borderBottom: i < activityLog.length - 1 ? "1px solid rgba(58,58,56,0.07)" : undefined,
                  background: i % 2 === 0 ? "transparent" : "rgba(26,60,43,0.02)",
                  alignItems: "flex-start",
                }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: "10px",
                    color: "#3A3A38", opacity: 0.45, flexShrink: 0, minWidth: "60px", paddingTop: "1px",
                  }}>{entry.time}</span>
                  <span style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: "12px", color: "#1A3C2B", lineHeight: "1.5",
                  }}>{entry.entry}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionLabel icon={<BarChart2 style={{ width: "13px", height: "13px" }} />} text="Stats" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <StatCard label="Total runs" value={worker.total_runs.toLocaleString()} />
              <StatCard
                label="Success rate"
                value={`${successRate}%`}
                accent={successRate >= 95 ? "#22c55e" : successRate >= 85 ? "#f59e0b" : "#ef4444"}
              />
            </div>
          </section>

          <section>
            <SectionLabel icon={<Clock style={{ width: "13px", height: "13px" }} />} text="Controls" />
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {worker.status === "active" ? (
                <ControlButton
                  icon={<Pause style={{ width: "14px", height: "14px" }} />}
                  label="Pause"
                  variant="secondary"
                  onClick={() => onPauseResume(worker)}
                />
              ) : (
                <ControlButton
                  icon={<Play style={{ width: "14px", height: "14px" }} />}
                  label="Resume"
                  variant="primary"
                  onClick={() => onPauseResume(worker)}
                />
              )}
              <ControlButton
                icon={<Trash2 style={{ width: "14px", height: "14px" }} />}
                label="Remove"
                variant="danger"
                onClick={() => onRemove(worker)}
              />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 10px",
      border: `1px solid ${color}44`,
      borderRadius: "100px",
      background: `${color}11`,
    }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: color, display: "inline-block" }} />
      <span style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: color, fontWeight: 500,
      }}>{label}</span>
    </span>
  );
}

export default function WorkforcePage() {
  const router = useRouter();
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<WorkerActivity[]>([]);
  const [syncing, setSyncing] = useState(false);

  const fetchWorkers = useCallback(async () => {
    try {
      const res = await fetch("/api/workers");
      if (res.ok) {
        const data = await res.json();
        setWorkers(data.workers || []);
      }
    } catch (err) {
      console.error("Failed to fetch workers:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWorkerDetail = useCallback(async (workerId: string) => {
    try {
      const res = await fetch(`/api/workers/${workerId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedActivity(data.activity || []);
      }
    } catch (err) {
      console.error("Failed to fetch worker detail:", err);
    }
  }, []);

  useEffect(() => {
    fetchWorkers();
    const interval = setInterval(fetchWorkers, 30000);
    return () => clearInterval(interval);
  }, [fetchWorkers]);

  const handleSelectWorker = (worker: Worker) => {
    setSelectedWorker(worker);
    setSelectedActivity([]);
    fetchWorkerDetail(worker.id);
  };

  const handlePauseResume = async (worker: Worker) => {
    const newStatus = worker.status === "paused" ? "active" : "paused";
    await fetch(`/api/workers/${worker.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchWorkers();
  };

  const handleRemoveWorker = async (worker: Worker) => {
    if (!confirm(`Remove ${worker.name}? This won't delete the underlying automation.`)) return;
    await fetch(`/api/workers/${worker.id}`, { method: "DELETE" });
    setSelectedWorker(null);
    fetchWorkers();
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch("/api/workers/sync", { method: "POST" });
      await fetchWorkers();
    } finally {
      setSyncing(false);
    }
  };

  const activeCount = workers.filter(w => w.status === "active").length;
  const errorCount = workers.filter(w => w.status === "error").length;

  return (
    <>
      <style>{ANIMATION_STYLES}</style>
      <div style={{ minHeight: "100vh", padding: "40px 48px", fontFamily: "'Space Grotesk', sans-serif" }}>

        <div style={{ marginBottom: "48px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <h1 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700, fontSize: "28px", color: "#1A3C2B",
                letterSpacing: "-0.02em", marginBottom: "6px",
              }}>Your Workforce</h1>
              <p style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "12px", color: "#3A3A38", opacity: 0.5, marginBottom: "16px",
              }}>Your AI team, hard at work</p>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "8px 14px",
                background: "transparent",
                border: "1px solid rgba(58,58,56,0.2)",
                borderRadius: "6px", cursor: syncing ? "default" : "pointer",
                fontFamily: "'JetBrains Mono', monospace", fontSize: "11px",
                color: "#1A3C2B", opacity: syncing ? 0.5 : 1,
                transition: "opacity 0.15s",
              }}
              onMouseEnter={e => { if (!syncing) e.currentTarget.style.opacity = "0.7"; }}
              onMouseLeave={e => { if (!syncing) e.currentTarget.style.opacity = "1"; }}
            >
              <RefreshCw style={{ width: "13px", height: "13px" }} />
              {syncing ? "Syncing..." : "Sync Status"}
            </button>
          </div>
          {!loading && (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <StatusPill label={`${activeCount} active`} color="#22c55e" />
              {errorCount > 0 && <StatusPill label={`${errorCount} error`} color="#ef4444" />}
              <StatusPill label={`${workers.length} workers`} color="#9ca3af" />
            </div>
          )}
        </div>

        {loading ? (
          <div style={{
            border: "1px solid rgba(58,58,56,0.1)",
            borderRadius: "16px",
            padding: "56px 40px 48px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            minHeight: "300px",
          }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "13px", color: "#3A3A38", opacity: 0.5,
            }}>Loading your workforce...</div>
            <div style={{ display: "flex", gap: "48px" }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                  <div className="skeleton-shimmer" style={{ width: "34px", height: "34px", borderRadius: "50%" }} />
                  <div className="skeleton-shimmer" style={{ width: "160px", height: "70px" }} />
                  <div className="skeleton-shimmer" style={{ width: "80px", height: "12px" }} />
                </div>
              ))}
            </div>
          </div>
        ) : workers.length === 0 ? (
          <div style={{
            border: "1px solid rgba(58,58,56,0.1)",
            borderRadius: "16px",
            padding: "80px 40px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            textAlign: "center",
            backgroundImage: `
              linear-gradient(rgba(58,58,56,0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(58,58,56,0.04) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}>
            <div style={{ fontSize: "40px" }}>🏢</div>
            <div>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700, fontSize: "18px", color: "#1A3C2B", marginBottom: "8px",
              }}>Your office is empty!</div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "12px", color: "#3A3A38", opacity: 0.55, lineHeight: "1.7", maxWidth: "380px",
              }}>
                Start chatting with your agent and ask it to set up recurring tasks.<br />
                Workers will appear here automatically.
              </div>
            </div>
            <button
              onClick={() => router.push("/chat")}
              style={{
                marginTop: "8px",
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 20px",
                background: "#1A3C2B", color: "#F7F7F5",
                border: "none", borderRadius: "6px", cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "13px",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              <Zap style={{ width: "14px", height: "14px" }} />
              Chat with your agent
            </button>
          </div>
        ) : (
          <>
            <div style={{
              border: "1px solid rgba(58,58,56,0.1)",
              borderRadius: "16px",
              padding: "56px 40px 48px",
              position: "relative",
              backgroundImage: `
                linear-gradient(rgba(58,58,56,0.04) 1px, transparent 1px),
                linear-gradient(90deg, rgba(58,58,56,0.04) 1px, transparent 1px)
              `,
              backgroundSize: "40px 40px",
            }}>
              <div style={{
                position: "absolute", top: "14px", left: "20px",
                fontFamily: "'JetBrains Mono', monospace", fontSize: "10px",
                color: "#3A3A38", opacity: 0.25,
                textTransform: "uppercase", letterSpacing: "0.1em",
              }}>Office Floor · Level 1</div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 180px)",
                gap: "56px 48px",
                justifyContent: "center",
              }}>
                {workers.map(worker => (
                  <div key={worker.id} style={{ position: "relative" }}>
                    <Workstation worker={worker} onClick={() => handleSelectWorker(worker)} />
                    <div style={{
                      position: "absolute", bottom: "-20px", left: "50%",
                      transform: "translateX(-50%)",
                      fontFamily: "'JetBrains Mono', monospace", fontSize: "9px",
                      color: "#3A3A38", opacity: 0.25,
                      whiteSpace: "nowrap", pointerEvents: "none",
                    }}>
                      click to inspect
                    </div>
                  </div>
                ))}
                <HireWorkerSlot onClick={() => router.push("/chat")} />
              </div>
            </div>

            <div style={{ marginTop: "36px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {workers.map(w => {
                const successRate = w.total_runs > 0
                  ? Math.round((w.successful_runs / w.total_runs) * 100)
                  : 0;
                return (
                  <button
                    key={w.id}
                    onClick={() => handleSelectWorker(w)}
                    style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      padding: "9px 16px",
                      background: "transparent",
                      border: "1px solid rgba(58,58,56,0.12)",
                      borderRadius: "6px", cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = "rgba(58,58,56,0.25)";
                      e.currentTarget.style.background = "rgba(26,60,43,0.03)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = "rgba(58,58,56,0.12)";
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span style={{
                      width: "7px", height: "7px", borderRadius: "50%",
                      background: STATUS_CONFIG[w.status].dot, flexShrink: 0,
                    }} />
                    <span style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 600, fontSize: "13px", color: "#1A3C2B",
                    }}>{w.name}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#3A3A38", opacity: 0.3 }}>·</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#3A3A38", opacity: 0.45 }}>
                      {w.total_runs.toLocaleString()} runs · {successRate}%
                    </span>
                    <ChevronRight style={{ width: "12px", height: "12px", color: "#3A3A38", opacity: 0.3 }} />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {selectedWorker && (
        <WorkerPanel
          worker={selectedWorker}
          onClose={() => setSelectedWorker(null)}
          activity={selectedActivity}
          onPauseResume={handlePauseResume}
          onRemove={handleRemoveWorker}
        />
      )}
    </>
  );
}
