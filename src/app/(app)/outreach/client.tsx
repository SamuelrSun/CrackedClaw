"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { useGateway } from "@/hooks/use-gateway";
import { usePathname } from "next/navigation";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { UserMenu } from "@/components/auth/user-menu";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Target,
  Trash2,
  Loader2,
  Sparkles,
  Upload,
  Database,
  ScanLine,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BarChart2,
  Mail,
  Copy,
  Check,
  RefreshCw,
  MessageSquare,
  Search,
  User,
  ArrowRight,
  CircleDot,
} from "lucide-react";
import type { Campaign } from "./page-content";
import type { Workflow, WorkflowType } from "@/lib/outreach/workflow-types";
import type { CriteriaModel, Criterion } from "@/lib/outreach/criteria-engine";
import type { AnalysisReport } from "@/lib/outreach/dataset-analyzer";
import type { OutreachTemplate, PersonalizedMessage } from "@/lib/outreach/template-engine";
import type { FeedbackAnalysis, CriterionAdjustment } from "@/lib/outreach/feedback-analyzer";
import { VoiceInputButton } from "@/components/chat/voice-input-button";

// ─── Dataset types ─────────────────────────────────────────────────────────────

interface DatasetInfo {
  id: string;
  source_type: 'csv' | 'google_sheet';
  source_url?: string;
  source_name?: string;
  columns: string[];
  rows: Record<string, string>[];
  row_count: number;
  enriched_count?: number;
  url_columns?: string[];
  enriched_rows?: Array<{ row_index: number; data: Record<string, string>; enriched_at: string }>;
}

// ─── Lead scoring types ───────────────────────────────────────────────────────

interface CriterionScore {
  criterion_id: string;
  category: string;
  score: number;
  weight: number;
  weighted_score: number;
  evidence: string;
}

interface ScoredLead {
  id: string;
  campaign_id: string;
  name: string;
  profile_url?: string;
  profile_data: Record<string, string>;
  rank: 'high' | 'medium' | 'low';
  score: number;
  criterion_scores: CriterionScore[];
  reasoning: string;
  user_override_rank?: 'high' | 'medium' | 'low' | null;
  user_feedback?: string;
  outreach_status: 'pending' | 'sent' | 'replied' | 'ignored';
  source: string;
  scored_at: string;
  draft_subject?: string | null;
  draft_body?: string | null;
  draft_channel?: string | null;
}

interface LeadsByRank {
  high: number;
  medium: number;
  low: number;
}

interface ScoringStats {
  scored: number;
  by_rank: LeadsByRank;
  criteria_used?: number;
}

interface DiscoveryStats {
  total_leads: number;
  by_source: {
    dataset: number;
    agent_discovery: number;
    [key: string]: number;
  };
  by_rank: LeadsByRank;
  recent_discoveries: Array<{
    id: string;
    name: string;
    rank: string;
    source: string;
    created_at: string;
  }>;
}

// ─── Status badge ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<Campaign["status"], string> = {
  setup: "bg-white/[0.06] text-white/40 border-white/[0.1]",
  scanning: "bg-amber-900/30 text-amber-400 border-amber-800/40",
  active: "bg-emerald-900/30 text-emerald-400 border-emerald-800/40",
  paused: "bg-zinc-800/40 text-white/30 border-white/[0.08]",
};

function StatusBadge({ status }: { status: Campaign["status"] }) {
  return (
    <span
      className={cn(
        "font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 border",
        STATUS_STYLES[status]
      )}
    >
      {status}
    </span>
  );
}

// ─── Chat types ───────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

// ─── Streaming indicator ──────────────────────────────────────────────────────

function StreamingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1 h-1 bg-white/40 rounded-full animate-pulse"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

// ─── Data Source Connection Card ──────────────────────────────────────────────

interface DataSourceCardProps {
  campaignId: string;
  onConnected: (info: DatasetInfo) => void;
}

function DataSourceCard({ campaignId, onConnected }: DataSourceCardProps) {
  const [mode, setMode] = useState<'choose' | 'sheet' | 'csv'>('choose');
  const [sheetUrl, setSheetUrl] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const connectSheet = async () => {
    if (!sheetUrl.trim()) return;
    setConnecting(true);
    setError('');
    try {
      const res = await fetch(`/api/outreach/campaigns/${campaignId}/dataset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheet_url: sheetUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to connect sheet.');
        return;
      }
      // Fetch full dataset info
      const dsRes = await fetch(`/api/outreach/campaigns/${campaignId}/dataset`);
      const dsData = await dsRes.json();
      if (dsData.dataset) onConnected(dsData.dataset);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  const uploadCSV = async (file: File) => {
    setConnecting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/outreach/campaigns/${campaignId}/dataset`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to upload CSV.');
        return;
      }
      // Fetch full dataset info
      const dsRes = await fetch(`/api/outreach/campaigns/${campaignId}/dataset`);
      const dsData = await dsRes.json();
      if (dsData.dataset) onConnected(dsData.dataset);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadCSV(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      uploadCSV(file);
    } else {
      setError('Please drop a .csv file.');
    }
  };

  return (
    <div className="shrink-0 mx-4 my-3 bg-white/[0.04] border border-white/[0.08] rounded-[3px] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Database className="w-3.5 h-3.5 text-white/40" />
        <span className="font-mono text-[10px] uppercase tracking-wide text-white/50">
          Connect Dataset
        </span>
      </div>

      {mode === 'choose' && (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => setMode('sheet')}
            className="flex-1 flex items-center justify-center gap-2 py-3 border border-white/[0.1] text-white/50 hover:text-white/80 hover:bg-white/[0.04] hover:border-white/[0.2] transition-colors text-sm"
          >
            <span className="text-base">📊</span>
            <span className="text-[12px]">Google Sheet URL</span>
          </button>
          <button
            onClick={() => setMode('csv')}
            className="flex-1 flex items-center justify-center gap-2 py-3 border border-white/[0.1] text-white/50 hover:text-white/80 hover:bg-white/[0.04] hover:border-white/[0.2] transition-colors text-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="text-[12px]">Upload CSV</span>
          </button>
        </div>
      )}

      {mode === 'sheet' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="url"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="flex-1 bg-white/[0.04] border border-white/[0.1] text-white/90 text-sm px-3 py-2.5 outline-none focus:border-white/[0.25] transition-colors placeholder:text-white/20"
              disabled={connecting}
              onKeyDown={(e) => e.key === 'Enter' && connectSheet()}
            />
            <button
              onClick={connectSheet}
              disabled={connecting || !sheetUrl.trim()}
              className="px-4 py-2.5 bg-white/[0.06] border border-white/[0.12] text-white/70 hover:bg-white/[0.1] hover:text-white/90 transition-colors font-mono text-[10px] uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Connect'}
            </button>
          </div>
          <p className="font-mono text-[9px] text-white/25">
            Sheet must be publicly accessible (Share → Anyone with the link → Viewer)
          </p>
          <button
            onClick={() => { setMode('choose'); setError(''); }}
            className="font-mono text-[9px] uppercase tracking-wide text-white/30 hover:text-white/60 transition-colors"
          >
            ← Back
          </button>
        </div>
      )}

      {mode === 'csv' && (
        <div className="space-y-2">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !connecting && fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-[3px] p-6 text-center cursor-pointer transition-colors',
              dragOver
                ? 'border-white/[0.35] bg-white/[0.04]'
                : 'border-white/[0.15] hover:border-white/[0.25]',
              connecting && 'opacity-50 cursor-not-allowed'
            )}
          >
            {connecting ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
                <p className="text-sm text-white/40">Uploading…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-5 h-5 text-white/30" />
                <p className="text-sm text-white/50">Drop a CSV file here, or click to browse</p>
                <p className="font-mono text-[9px] text-white/25">.csv files only</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => { setMode('choose'); setError(''); }}
            className="font-mono text-[9px] uppercase tracking-wide text-white/30 hover:text-white/60 transition-colors"
          >
            ← Back
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 font-mono text-[10px] text-red-400/80 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Scan Results Card ────────────────────────────────────────────────────────

interface ScanResultCardProps {
  report: AnalysisReport;
  onAccept: () => void;
  onViewFull: () => void;
}

function ScanResultCard({ report, onAccept, onViewFull }: ScanResultCardProps) {
  const confirmedCount = (report.refined_criteria || []).length;
  const newCount = (report.new_criteria || []).length;
  const allFindings = (report.passes || []).flatMap((p) => p.findings || []);
  const keyFindings = allFindings.slice(0, 4);

  return (
    <div className="shrink-0 mx-4 my-3 bg-white/[0.04] border border-white/[0.1] rounded-[3px] p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">📊</span>
        <span className="font-mono text-[11px] uppercase tracking-wide text-white/70">
          Dataset Analysis Complete
        </span>
      </div>

      <p className="text-sm text-white/60">
        Scanned <span className="text-white/80">{report.scanned_rows}</span> leads across{' '}
        <span className="text-white/80">{report.scanned_columns}</span> columns
      </p>

      <div className="space-y-1.5">
        {confirmedCount > 0 && (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/70 flex-shrink-0" />
            <span className="text-sm text-emerald-400/70">
              {confirmedCount} {confirmedCount === 1 ? 'criterion' : 'criteria'} confirmed by data
            </span>
          </div>
        )}
        {newCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 flex items-center justify-center text-amber-400/70 text-xs flex-shrink-0">✦</span>
            <span className="text-sm text-amber-400/70">
              {newCount} new {newCount === 1 ? 'pattern' : 'patterns'} discovered
            </span>
          </div>
        )}
        {(report.anti_patterns || []).length > 0 && (
          <div className="flex items-center gap-2">
            <XCircle className="w-3.5 h-3.5 text-red-400/60 flex-shrink-0" />
            <span className="text-sm text-red-400/60">
              {(report.anti_patterns || []).length} exclusion {(report.anti_patterns || []).length === 1 ? 'pattern' : 'patterns'} identified
            </span>
          </div>
        )}
      </div>

      {keyFindings.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
          <p className="font-mono text-[9px] uppercase tracking-wide text-white/30">Key findings</p>
          {keyFindings.map((f, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-white/25 text-xs mt-0.5">•</span>
              <span className="text-xs text-white/55 leading-relaxed">
                {f.description}
                {f.evidence && (
                  <span className="text-white/30"> ({f.evidence})</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {report.summary && (
        <p className="text-xs text-white/45 leading-relaxed italic border-t border-white/[0.06] pt-2">
          {report.summary}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onViewFull}
          className="font-mono text-[10px] uppercase tracking-wide px-3 py-1.5 border border-white/[0.12] text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors"
        >
          View Full Report
        </button>
        <button
          onClick={onAccept}
          className="font-mono text-[10px] uppercase tracking-wide px-3 py-1.5 bg-emerald-900/30 border border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/50 transition-colors"
        >
          Accept & Continue
        </button>
      </div>
    </div>
  );
}

// ─── Dataset Preview (right panel) ───────────────────────────────────────────

function DatasetPreview({ dataset }: { dataset: DatasetInfo }) {
  const previewRows = (dataset.rows || []).slice(0, 5);
  const visibleCols = (dataset.columns || []).slice(0, 6); // cap for mobile

  return (
    <div className="px-3 py-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Database className="w-3 h-3 text-white/30" />
        <span className="font-mono text-[9px] uppercase tracking-wide text-white/40">Dataset</span>
      </div>

      <div className="text-xs text-white/50 mb-1">
        {dataset.source_name ? (
          <span className="text-white/60">{dataset.source_name}</span>
        ) : (
          <span className="text-white/40">{dataset.source_type === 'google_sheet' ? 'Google Sheet' : 'CSV File'}</span>
        )}
      </div>
      <p className="font-mono text-[9px] text-white/30 mb-3">
        {dataset.row_count} rows · {(dataset.columns || []).length} columns
      </p>

      {previewRows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr>
                {visibleCols.map((col) => (
                  <th
                    key={col}
                    className="font-mono text-[9px] uppercase tracking-wide text-white/35 pb-1.5 pr-3 border-b border-white/[0.06] whitespace-nowrap"
                  >
                    {col.length > 12 ? col.slice(0, 12) + '…' : col}
                  </th>
                ))}
                {(dataset.columns || []).length > 6 && (
                  <th className="font-mono text-[9px] text-white/20 pb-1.5 whitespace-nowrap">
                    +{(dataset.columns || []).length - 6} more
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i} className="border-b border-white/[0.04]">
                  {visibleCols.map((col) => {
                    const val = row[col] ?? '';
                    return (
                      <td
                        key={col}
                        className="text-[11px] text-white/40 py-1 pr-3 max-w-[80px] truncate whitespace-nowrap"
                        title={val}
                      >
                        {val || <span className="text-white/20">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Enrichment Status Card ───────────────────────────────────────────────────

interface EnrichmentStatusCardProps {
  dataset: DatasetInfo;
  onStartEnrichment: () => void;
}

function EnrichmentStatusCard({ dataset, onStartEnrichment }: EnrichmentStatusCardProps) {
  const urlColumns = dataset.url_columns ?? [];
  const total = dataset.row_count ?? 0;
  const enriched = dataset.enriched_count ?? 0;
  const pct = total > 0 ? Math.round((enriched / total) * 100) : 0;

  // Only show when URL columns are detected
  if (urlColumns.length === 0) return null;

  return (
    <div className="mx-4 my-3 bg-white/[0.04] border border-white/[0.08] rounded-[3px] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-white/40" />
        <span className="font-mono text-[10px] uppercase tracking-wide text-white/50">
          Enrichment Status
        </span>
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-white/50">
            {enriched} / {total} enriched
          </span>
          <span className="font-mono text-[10px] text-white/30">{pct}%</span>
        </div>
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-600/60 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* URL columns */}
      <div className="space-y-1">
        <p className="font-mono text-[9px] uppercase tracking-wide text-white/30">
          URL Columns Detected
        </p>
        <div className="flex flex-wrap gap-1">
          {urlColumns.map((col) => (
            <span
              key={col}
              className="font-mono text-[9px] px-1.5 py-0.5 bg-blue-900/20 border border-blue-800/30 text-blue-400/70"
            >
              {col}
            </span>
          ))}
        </div>
      </div>

      {/* Start enrichment button */}
      {enriched < total && (
        <button
          onClick={onStartEnrichment}
          className="w-full flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-wide px-3 py-2 bg-emerald-900/20 border border-emerald-800/30 text-emerald-400/80 hover:bg-emerald-900/40 hover:text-emerald-400 transition-colors"
        >
          <Sparkles className="w-3 h-3" />
          Start Enrichment
        </button>
      )}

      {enriched >= total && total > 0 && (
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/60" />
          <span className="font-mono text-[10px] text-emerald-400/60">
            All rows enriched
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Setup Panel ──────────────────────────────────────────────────────────────

interface SetupPanelProps {
  campaign: Campaign;
  onRunAnalysis: (description: string, dataSourceUrl: string | null) => Promise<void>;
}

function SetupPanel({ campaign, onRunAnalysis }: SetupPanelProps) {
  const [description, setDescription] = useState("");
  const [dataSourceUrl, setDataSourceUrl] = useState("");
  const [running, setRunning] = useState(false);
  const {
    isListening,
    fullText,
    wordCount,
    isSupported,
    startListening,
    stopListening,
    clearTranscript,
  } = useSpeechRecognition();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  // Timer for recording duration
  useEffect(() => {
    if (isListening) {
      startTimeRef.current = Date.now();
      const interval = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setElapsedSeconds(0);
    }
  }, [isListening]);

  // Sync voice transcript into description
  useEffect(() => {
    if (isListening && fullText) {
      setDescription(fullText);
    }
  }, [isListening, fullText]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartVoice = () => {
    clearTranscript();
    setDescription("");
    startListening();
  };

  const handleStopVoice = () => {
    stopListening();
    if (fullText.trim()) {
      setDescription(fullText.trim());
    }
  };

  const handleRun = async () => {
    if (!description.trim() || running) return;
    if (isListening) handleStopVoice();
    setRunning(true);
    try {
      await onRunAnalysis(description.trim(), dataSourceUrl.trim() || null);
    } finally {
      setRunning(false);
    }
  };

  const descWordCount = description.trim() ? description.trim().split(/\s+/).length : 0;

  return (
    <div className="w-full max-w-lg space-y-4">
      {/* Header */}
      <div className="text-center mb-2">
        <h2 className="text-sm text-white/70 font-medium mb-1">
          {campaign.name}
        </h2>
        <p className="font-mono text-[10px] uppercase tracking-wide text-white/30">
          Describe your ideal leads and connect your data
        </p>
      </div>

      {/* Description input */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-[3px] p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] uppercase tracking-wide text-white/40">
            Who are you looking for?
          </span>
          {isListening ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="font-mono text-[10px] text-red-400/70">{formatTime(elapsedSeconds)}</span>
              <span className="font-mono text-[9px] text-white/25">{wordCount}w</span>
            </div>
          ) : descWordCount > 0 ? (
            <span className="font-mono text-[9px] text-white/25">{descWordCount} words</span>
          ) : null}
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. AR consultants at established tech companies who post regularly on LinkedIn and have 5+ years of experience..."
          rows={4}
          disabled={running}
          className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/20 outline-none resize-none disabled:opacity-50 leading-relaxed"
        />
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.06]">
          {isSupported && (
            <button
              type="button"
              onClick={isListening ? handleStopVoice : handleStartVoice}
              disabled={running}
              className={cn(
                "flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide px-2.5 py-1.5 transition-colors disabled:opacity-40",
                isListening
                  ? "bg-red-900/30 border border-red-800/40 text-red-400 hover:bg-red-900/50"
                  : "border border-white/[0.1] text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
              )}
            >
              {isListening ? (
                <>
                  <span className="flex items-end gap-[2px] h-3">
                    {[1, 2, 3, 2, 1].map((h, i) => (
                      <span
                        key={i}
                        className="w-[1.5px] bg-red-400 rounded-full"
                        style={{
                          height: `${h * 3}px`,
                          animation: `voiceBar 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
                        }}
                      />
                    ))}
                  </span>
                  Stop
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 10a7 7 0 0 0 14 0" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                  Voice
                </>
              )}
            </button>
          )}
          {!isSupported && <div />}
          <span className="font-mono text-[9px] text-white/20">
            Speak or type — be as detailed as you want
          </span>
        </div>
      </div>

      {/* Data source link */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-[3px] p-4">
        <div className="flex items-center gap-2 mb-2">
          <Database className="w-3.5 h-3.5 text-white/30" />
          <span className="font-mono text-[10px] uppercase tracking-wide text-white/40">
            Data Source
          </span>
          <span className="font-mono text-[9px] text-white/20">(optional)</span>
        </div>
        <input
          type="url"
          value={dataSourceUrl}
          onChange={(e) => setDataSourceUrl(e.target.value)}
          placeholder="Paste a Google Sheet link, CSV URL, or LinkedIn search URL..."
          disabled={running}
          className="w-full bg-white/[0.04] border border-white/[0.1] text-sm text-white/80 placeholder:text-white/20 px-3 py-2.5 outline-none focus:border-white/[0.25] transition-colors disabled:opacity-50"
        />
        <p className="font-mono text-[9px] text-white/20 mt-1.5">
          Connect your existing leads to discover patterns in who you&apos;ve already selected
        </p>
      </div>

      {/* Run Analysis button */}
      <button
        onClick={handleRun}
        disabled={!description.trim() || running}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-3.5 font-mono text-[11px] uppercase tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
          running
            ? "bg-emerald-900/30 border border-emerald-800/40 text-emerald-400"
            : "bg-white/[0.08] border border-white/[0.15] text-white/70 hover:bg-white/[0.12] hover:text-white/90"
        )}
      >
        {running ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyzing…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Run Analysis
          </>
        )}
      </button>

      <style jsx>{`
        @keyframes voiceBar {
          from { transform: scaleY(0.5); }
          to   { transform: scaleY(1.5); }
        }
      `}</style>
    </div>
  );
}

// ─── Outreach Chat ────────────────────────────────────────────────────────────

interface OutreachChatProps {
  campaign: Campaign;
  onConversationCreated: (conversationId: string) => void;
  onMessagesChange: (count: number) => void;
  onCriteriaRefresh: () => void;
  hasCriteria: boolean;
  dataset: DatasetInfo | null;
  scanning: boolean;
  scanReport: AnalysisReport | null;
  onDatasetConnected: (info: DatasetInfo) => void;
  onScanTriggered: () => void;
  onScanReportDismissed: () => void;
}

function OutreachChat({
  campaign,
  onConversationCreated,
  onMessagesChange,
  onCriteriaRefresh,
  hasCriteria,
  dataset,
  scanning,
  scanReport,
  onDatasetConnected,
  onScanTriggered,
  onScanReportDismissed,
}: OutreachChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const {
    isListening: voiceListening,
    fullText: voiceText,
    isSupported: voiceSupported,
    startListening: voiceStart,
    stopListening: voiceStop,
    clearTranscript: voiceClear,
  } = useSpeechRecognition();

  // Load existing messages if campaign has a conversation_id
  useEffect(() => {
    const config = campaign.config as Record<string, unknown>;
    const existingConvoId = config.conversation_id as string | undefined;

    if (existingConvoId) {
      setConversationId(existingConvoId);
      loadMessages(existingConvoId);
    } else {
      setMessages([]);
      setConversationId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  async function loadMessages(convoId: string) {
    try {
      const res = await fetch(`/api/conversations/${convoId}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      const loaded: ChatMessage[] = (data.messages ?? []).map(
        (m: { id: string; role: "user" | "assistant"; content: string; created_at: string }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: new Date(m.created_at),
        })
      );
      setMessages(loaded);
      onMessagesChange(loaded.length);
    } catch {
      // ignore
    }
  }

  // Sync voice text to input while listening
  useEffect(() => {
    if (voiceListening && voiceText) {
      setInput(voiceText);
    }
  }, [voiceListening, voiceText]);

  // Listen for fill-chat events (e.g., from Start Enrichment button)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { text?: string };
      if (detail.text) {
        setInput(detail.text);
        textareaRef.current?.focus();
      }
    };
    window.addEventListener('outreach:fill-chat', handler);
    return () => window.removeEventListener('outreach:fill-chat', handler);
  }, []);

  // No auto-scroll — user controls scroll position

  useEffect(() => {
    onMessagesChange(messages.length);
  }, [messages.length, onMessagesChange]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    // Resize textarea back
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const abortController = new AbortController();
    abortRef.current = abortController;

    const assistantId = crypto.randomUUID();
    let assistantContent = "";
    let newConversationId = conversationId;

    // Add streaming placeholder
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: new Date(),
      },
    ]);

    try {
      const res = await fetch("/api/outreach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          campaign_id: campaign.id,
          conversation_id: conversationId,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      // Read conversation ID from header
      const headerConvoId = res.headers.get("X-Conversation-Id");
      if (headerConvoId && !conversationId) {
        newConversationId = headerConvoId;
        setConversationId(headerConvoId);
        onConversationCreated(headerConvoId);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") break;

          try {
            const event = JSON.parse(data);

            if (event.type === "status" && event.conversation_id && !conversationId) {
              newConversationId = event.conversation_id;
              setConversationId(event.conversation_id);
              onConversationCreated(event.conversation_id);
            }

            if (event.type === "token" && event.text) {
              assistantContent += event.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: assistantContent }
                    : m
                )
              );
            }

            if (event.type === "done") {
              if (event.conversation_id && !conversationId) {
                newConversationId = event.conversation_id;
                setConversationId(event.conversation_id);
                onConversationCreated(event.conversation_id);
              }
              break;
            }

            if (event.type === "error") {
              throw new Error(event.message || "Stream error");
            }
          } catch {
            // skip parse errors
          }
        }
      }
      reader.releaseLock();
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    assistantContent ||
                    "Sorry, something went wrong. Please try again.",
                }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      void newConversationId; // suppress unused warning
    }
  }, [input, isStreaming, conversationId, campaign.id, onConversationCreated]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  };

  const handleExtractCriteria = async () => {
    if (extracting || !conversationId) return;
    setExtracting(true);
    try {
      const res = await fetch(`/api/outreach/campaigns/${campaign.id}/criteria`, {
        method: "POST",
      });
      if (res.ok) {
        onCriteriaRefresh();
      }
    } catch {
      // ignore
    } finally {
      setExtracting(false);
    }
  };

  const canExtract =
    messages.length >= 4 && campaign.status === "setup" && !extracting;

  const canScan =
    hasCriteria &&
    dataset !== null &&
    (campaign.status === "setup" || campaign.status === "scanning" || campaign.status === "active") &&
    !scanning;

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0%', minHeight: 0 }}>
      {/* Extract / Scan button row */}
      {(canExtract || canScan || scanning) && (
        <div className="shrink-0 px-5 py-2 border-b border-white/[0.04] flex items-center justify-end gap-2">
          {canExtract && (
            <button
              onClick={handleExtractCriteria}
              disabled={extracting}
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide px-3 py-1.5 bg-emerald-900/30 border border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/50 transition-colors disabled:opacity-50"
            >
              {extracting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              {extracting ? "Extracting…" : "Extract Criteria"}
            </button>
          )}
          {(canScan || scanning) && (
            <button
              onClick={onScanTriggered}
              disabled={scanning}
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide px-3 py-1.5 bg-amber-900/30 border border-amber-800/40 text-amber-400 hover:bg-amber-900/50 transition-colors disabled:opacity-50"
            >
              {scanning ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ScanLine className="w-3 h-3" />
              )}
              {scanning ? "Scanning…" : "Scan Dataset"}
            </button>
          )}
        </div>
      )}

      {/* Messages — cards are INSIDE the scroll container so they don't crush it */}
      <div style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'auto' }} className="px-4 py-4 space-y-4">
        {/* Data source connection card — shown when criteria exist but no dataset */}
        {hasCriteria && !dataset && !scanning && (
          <DataSourceCard
            campaignId={campaign.id}
            onConnected={onDatasetConnected}
          />
        )}

        {/* Scan progress indicator */}
        {scanning && (
          <div className="mx-0 mb-3 bg-amber-900/10 border border-amber-800/30 rounded-[3px] p-4 flex items-center gap-3">
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm text-amber-400/80 font-medium">Analyzing dataset…</p>
              <p className="font-mono text-[9px] text-amber-400/40 mt-0.5">
                Running 5 pattern analysis passes
              </p>
            </div>
          </div>
        )}

        {/* Scan results card */}
        {scanReport && !scanning && (
          <ScanResultCard
            report={scanReport}
            onAccept={onScanReportDismissed}
            onViewFull={() => {
              const fullText = [
                '📊 DATASET ANALYSIS REPORT',
                '',
                `Scanned ${scanReport.scanned_rows} leads across ${scanReport.scanned_columns} columns.`,
                '',
                (scanReport.passes || []).map((pass) => {
                  const findings = (pass.findings || []).map(
                    (f) => `  • ${f.description}${f.evidence ? ` (${f.evidence})` : ''}`
                  );
                  return [
                    `PASS ${pass.pass_number} — ${(pass.pass_name || '').toUpperCase()}`,
                    ...findings,
                  ].join('\n');
                }).join('\n\n'),
                '',
                (scanReport.anti_patterns || []).length > 0
                  ? `EXCLUSIONS:\n${(scanReport.anti_patterns || []).map((ap) => `  ✕ ${ap}`).join('\n')}`
                  : '',
                '',
                `SUMMARY: ${scanReport.summary}`,
              ].filter(Boolean).join('\n');
              console.log(fullText);
            }}
          />
        )}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-8 px-4">
            {campaign.status === 'setup' ? (
              <SetupPanel
                campaign={campaign}
                onRunAnalysis={async (description, dataSourceUrl) => {
                  // 1. Send the description as a chat message
                  const userMsg: ChatMessage = {
                    id: crypto.randomUUID(),
                    role: "user",
                    content: description,
                    createdAt: new Date(),
                  };
                  setMessages([userMsg]);
                  setInput("");
                  setIsStreaming(true);

                  const abortController = new AbortController();
                  abortRef.current = abortController;
                  const assistantId = crypto.randomUUID();
                  let assistantContent = "";

                  setMessages((prev) => [
                    ...prev,
                    { id: assistantId, role: "assistant", content: "", createdAt: new Date() },
                  ]);

                  try {
                    // Send to chat to establish conversation
                    const res = await fetch("/api/outreach/chat", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        message: description,
                        campaign_id: campaign.id,
                        conversation_id: conversationId,
                      }),
                      signal: abortController.signal,
                    });

                    if (!res.ok) throw new Error(`HTTP ${res.status}`);

                    const headerConvoId = res.headers.get("X-Conversation-Id");
                    if (headerConvoId && !conversationId) {
                      setConversationId(headerConvoId);
                      onConversationCreated(headerConvoId);
                    }

                    const reader = res.body?.getReader();
                    if (!reader) throw new Error("No response body");

                    const decoder = new TextDecoder();
                    let buffer = "";

                    while (true) {
                      const { done, value } = await reader.read();
                      if (done) break;

                      buffer += decoder.decode(value, { stream: true });
                      const lines = buffer.split("\n");
                      buffer = lines.pop() || "";

                      for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith("data: ")) continue;
                        const data = trimmed.slice(6);
                        if (data === "[DONE]") break;

                        try {
                          const event = JSON.parse(data);
                          if (event.type === "status" && event.conversation_id && !conversationId) {
                            setConversationId(event.conversation_id);
                            onConversationCreated(event.conversation_id);
                          }
                          if (event.type === "token" && event.text) {
                            assistantContent += event.text;
                            setMessages((prev) =>
                              prev.map((m) =>
                                m.id === assistantId ? { ...m, content: assistantContent } : m
                              )
                            );
                          }
                          if (event.type === "done") {
                            if (event.conversation_id && !conversationId) {
                              setConversationId(event.conversation_id);
                              onConversationCreated(event.conversation_id);
                            }
                            break;
                          }
                        } catch { /* skip */ }
                      }
                    }
                    reader.releaseLock();
                  } catch (err) {
                    if ((err as Error).name !== "AbortError") {
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === assistantId
                            ? { ...m, content: assistantContent || "Sorry, something went wrong." }
                            : m
                        )
                      );
                    }
                  } finally {
                    setIsStreaming(false);
                    abortRef.current = null;
                  }

                  // 2. Extract criteria from the conversation
                  try {
                    const critRes = await fetch(`/api/outreach/campaigns/${campaign.id}/criteria`, {
                      method: "POST",
                    });
                    if (critRes.ok) onCriteriaRefresh();
                  } catch { /* ignore */ }

                  // 3. If a data source URL was provided, connect it and scan
                  if (dataSourceUrl) {
                    try {
                      const dsRes = await fetch(`/api/outreach/campaigns/${campaign.id}/dataset`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ sheet_url: dataSourceUrl }),
                      });
                      if (dsRes.ok) {
                        const dsData = await dsRes.json();
                        onDatasetConnected({
                          source_type: dsData.source_type || 'google_sheet',
                          row_count: dsData.row_count || 0,
                          columns: dsData.columns || [],
                        });

                        // Trigger scan
                        onScanTriggered();
                      }
                    } catch { /* ignore */ }
                  }
                }}
              />
            ) : (
              <div className="text-center">
                <div className="w-10 h-10 bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
                  <Target className="w-5 h-5 text-white/20" />
                </div>
                <p className="text-sm text-white/40 mb-1">{campaign.name}</p>
                <p className="font-mono text-[10px] uppercase tracking-wide text-white/20 mt-1 max-w-xs mx-auto">
                  Use the chat below to continue refining your search.
                </p>
              </div>
            )}
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const isStreaming_ =
            !isUser &&
            msg === messages[messages.length - 1] &&
            isStreaming;

          return (
            <div
              key={msg.id}
              className={cn("flex", isUser ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "flex flex-col gap-1",
                  isUser ? "items-end max-w-[55%]" : "items-start max-w-[65%]"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-white/40">
                    {isUser ? "You" : "Agent"}
                  </span>
                  <span className="text-[10px] text-white/25">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
                <div
                  className={cn(
                    "rounded-[3px] p-4 text-sm leading-relaxed whitespace-pre-wrap",
                    isUser
                      ? "bg-white/[0.08] border border-white/[0.1] text-white/80"
                      : "bg-white/[0.04] border border-white/[0.06] text-white/70"
                  )}
                >
                  {msg.content}
                  {isStreaming_ && !msg.content && <StreamingDots />}
                  {isStreaming_ && msg.content && <StreamingDots />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-2 md:p-4 flex justify-center">
        <div className="w-[95%] md:w-3/4 min-w-0 md:min-w-[300px]">
          <div
            className="relative bg-white/[0.08] border border-white/[0.1] rounded-[10px] overflow-hidden"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                handleTextareaChange(e);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you're looking for…"
              disabled={isStreaming}
              rows={1}
              className="w-full bg-transparent px-4 pt-4 pb-2 text-base leading-[24px] text-white/90 outline-none resize-none placeholder:text-white/30 disabled:opacity-50 min-h-[48px] max-h-[200px]"
            />
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-1.5">
                {/* Paperclip attach button */}
                <button
                  type="button"
                  disabled={isStreaming}
                  className="group/btn relative w-7 h-7 flex items-center justify-center text-white/40 hover:text-white/80 border border-white/[0.1] rounded-[4px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-transparent"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] text-white/80 bg-black/80 rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none">Attach</span>
                </button>

                {/* Integrations button */}
                <button
                  type="button"
                  disabled={isStreaming}
                  className="group/btn relative w-7 h-7 flex items-center justify-center text-white/40 hover:text-white/80 border border-white/[0.1] rounded-[4px] transition-colors bg-transparent"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] text-white/80 bg-black/80 rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none">Integrations</span>
                </button>

                {/* Computer button */}
                <button
                  type="button"
                  disabled={isStreaming}
                  className="group/btn relative w-7 h-7 flex items-center justify-center text-white/40 hover:text-white/80 border border-white/[0.1] rounded-[4px] transition-colors bg-transparent"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="14" x="2" y="3" rx="2"/>
                    <line x1="8" x2="16" y1="21" y2="21"/>
                    <line x1="12" x2="12" y1="17" y2="21"/>
                  </svg>
                  <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] text-white/80 bg-black/80 rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none">Computer</span>
                </button>

                {/* Contact button */}
                <button
                  type="button"
                  disabled={isStreaming}
                  className="group/btn relative w-7 h-7 flex items-center justify-center text-white/40 hover:text-white/80 border border-white/[0.1] rounded-[4px] transition-colors bg-transparent"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] text-white/80 bg-black/80 rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none">Contact</span>
                </button>
              </div>

              {/* Voice input button */}
              {voiceSupported && (
                <button
                  type="button"
                  onClick={() => {
                    if (voiceListening) {
                      voiceStop();
                      if (voiceText.trim()) setInput(voiceText.trim());
                      setTimeout(() => voiceClear(), 100);
                    } else {
                      voiceClear();
                      voiceStart();
                    }
                  }}
                  disabled={isStreaming}
                  className={cn(
                    "group/btn relative w-7 h-7 flex items-center justify-center border rounded-[4px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-transparent",
                    voiceListening
                      ? "border-red-500/50 text-red-400"
                      : "border-white/[0.1] text-white/40 hover:text-white/80"
                  )}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 10a7 7 0 0 0 14 0" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                  <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] text-white/80 bg-black/80 rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none">{voiceListening ? 'Stop' : 'Voice'}</span>
                </button>
              )}

              {/* Send button */}
              <button
                type="button"
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                className="group/btn relative w-7 h-7 flex items-center justify-center text-white/40 hover:text-white/80 border border-white/[0.1] rounded-[4px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-transparent"
              >
                {isStreaming ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
                )}
                <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] text-white/80 bg-black/80 rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none">Send</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Criteria Panel ───────────────────────────────────────────────────────────

const SOURCE_BADGE: Record<string, string> = {
  user_stated: "bg-emerald-900/30 text-emerald-400 border-emerald-800/40",
  agent_discovered: "bg-amber-900/30 text-amber-400 border-amber-800/40",
  refined: "bg-blue-900/30 text-blue-400 border-blue-800/40",
};

const SOURCE_LABEL: Record<string, string> = {
  user_stated: "USER",
  agent_discovered: "DISCOVERED",
  refined: "REFINED",
};

function CriterionCard({ criterion }: { criterion: Criterion }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-[2px] p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-white/30 rounded-full" />
          <span className="font-mono text-[9px] uppercase tracking-wide text-white/50">
            {criterion.category}
          </span>
        </div>
        <span className="font-mono text-[10px] text-white/40">
          {criterion.importance.toFixed(2)}
        </span>
      </div>

      {/* Importance bar */}
      <div className="h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full bg-white/20 rounded-full"
          style={{ width: `${criterion.importance * 100}%` }}
        />
      </div>

      <p className="text-xs text-white/65 leading-relaxed">
        {criterion.description}
      </p>

      {criterion.thresholds && (
        <p className="font-mono text-[9px] text-white/30">
          {criterion.thresholds}
        </p>
      )}

      {Array.isArray(criterion.interaction_effects) && criterion.interaction_effects.length > 0 && (
        <div className="space-y-0.5">
          {criterion.interaction_effects.map((effect, i) => (
            <p key={i} className="font-mono text-[9px] text-white/25 italic">
              ↳ {effect}
            </p>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <span
          className={cn(
            "font-mono text-[8px] uppercase tracking-wide px-1.5 py-0.5 border",
            SOURCE_BADGE[criterion.source] ?? SOURCE_BADGE.user_stated
          )}
        >
          {SOURCE_LABEL[criterion.source] ?? criterion.source}
        </span>
      </div>
    </div>
  );
}

interface CriteriaPanelProps {
  campaignId: string | null;
  refreshKey: number;
}

function CriteriaPanel({ campaignId, refreshKey }: CriteriaPanelProps) {
  const [criteria, setCriteria] = useState<CriteriaModel | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!campaignId) {
      setCriteria(null);
      return;
    }

    setLoading(true);
    fetch(`/api/outreach/campaigns/${campaignId}/criteria`)
      .then((r) => r.json())
      .then((d) => setCriteria(d.criteria ?? null))
      .catch(() => setCriteria(null))
      .finally(() => setLoading(false));
  }, [campaignId, refreshKey]);

  if (!campaignId) {
    return (
      <div className="px-4 py-5">
        <div className="text-xs text-white/25 leading-relaxed">
          Select or create a campaign to see criteria here.
        </div>
        <div className="mt-3 space-y-2">
          {["Role", "Company size", "Location", "Signals"].map((label) => (
            <div
              key={label}
              className="flex items-center gap-2 py-1.5 border-b border-white/[0.04]"
            >
              <div className="w-1.5 h-1.5 bg-white/[0.1]" />
              <span className="font-mono text-[9px] uppercase tracking-wide text-white/20">
                {label}
              </span>
              <span className="ml-auto text-xs text-white/15">—</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-4 py-5 space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 bg-white/[0.02] border border-white/[0.05] rounded-[2px] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!criteria || criteria.criteria.length === 0) {
    return (
      <div className="px-4 py-5">
        <div className="text-xs text-white/25 leading-relaxed">
          No criteria extracted yet. Chat with the agent to describe your ideal
          leads, then click &quot;Extract Criteria&quot;.
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 space-y-2">
      {criteria.criteria.map((c) => (
        <CriterionCard key={c.id} criterion={c} />
      ))}

      {criteria.anti_patterns.length > 0 && (
        <div className="mt-4">
          <div className="font-mono text-[9px] uppercase tracking-wide text-red-400/50 mb-2 px-0.5">
            Exclude
          </div>
          <div className="space-y-1">
            {criteria.anti_patterns.map((ap, i) => (
              <div
                key={i}
                className="flex items-start gap-2 py-1.5 px-2 bg-red-950/10 border border-red-800/20 rounded-[2px]"
              >
                <span className="text-red-400/60 text-xs mt-0.5">✕</span>
                <span className="text-xs text-red-400/60 leading-relaxed">{ap}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {criteria.notes && (
        <div className="mt-3 px-2 py-2 bg-white/[0.02] border border-white/[0.05] rounded-[2px]">
          <p className="font-mono text-[9px] uppercase tracking-wide text-white/30 mb-1">
            Notes
          </p>
          <p className="text-xs text-white/35 leading-relaxed">{criteria.notes}</p>
        </div>
      )}
    </div>
  );
}

// ─── Outreach status helpers ──────────────────────────────────────────────────

const OUTREACH_STATUS_BADGE: Record<string, string> = {
  pending: 'bg-white/[0.06] border-white/[0.12] text-white/40',
  sent: 'bg-blue-900/30 border-blue-800/40 text-blue-400',
  replied: 'bg-emerald-900/30 border-emerald-800/40 text-emerald-400',
  ignored: 'bg-amber-900/20 border-amber-800/30 text-amber-500/70',
};

const OUTREACH_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  sent: 'Sent',
  replied: 'Replied',
  ignored: 'Ignored',
};

// ─── Lead rank helpers ────────────────────────────────────────────────────────

const RANK_DOT: Record<string, string> = {
  high: 'text-emerald-400',
  medium: 'text-amber-400',
  low: 'text-white/30',
};

const RANK_BADGE: Record<string, string> = {
  high: 'bg-emerald-900/30 border-emerald-800/40 text-emerald-400',
  medium: 'bg-amber-900/30 border-amber-800/40 text-amber-400',
  low: 'bg-white/[0.04] border-white/[0.08] text-white/30',
};

const RANK_BAR: Record<string, string> = {
  high: 'bg-emerald-500',
  medium: 'bg-amber-500',
  low: 'bg-white/20',
};

const RANK_LABEL: Record<string, string> = {
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
};

// ─── Lead score bar ───────────────────────────────────────────────────────────

function ScoreBar({ score, rank }: { score: number; rank: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-[2px] bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', RANK_BAR[rank])}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn('font-mono text-[10px]', RANK_DOT[rank])}>
        {score.toFixed(0)}
      </span>
    </div>
  );
}

// ─── Expanded Lead View ───────────────────────────────────────────────────────

interface ExpandedLeadProps {
  lead: ScoredLead;
  onOverride: (rank: 'high' | 'medium' | 'low') => void;
  onFeedback: (text: string) => void;
  onStatusChange: (status: 'pending' | 'sent' | 'replied' | 'ignored') => void;
  overriding: boolean;
}

function ExpandedLeadView({ lead, onOverride, onFeedback, onStatusChange, overriding }: ExpandedLeadProps) {
  const [feedback, setFeedback] = useState(lead.user_feedback ?? '');
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const effectiveRank = lead.user_override_rank ?? lead.rank;

  const handleCopyDraft = () => {
    if (!lead.draft_body) return;
    const text = lead.draft_subject
      ? `Subject: ${lead.draft_subject}\n\n${lead.draft_body}`
      : lead.draft_body;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleFeedbackSubmit = () => {
    if (!feedback.trim()) return;
    onFeedback(feedback.trim());
    setFeedbackSaved(true);
    setTimeout(() => setFeedbackSaved(false), 2000);
  };

  return (
    <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-3">
      {/* Criterion breakdown */}
      <div className="space-y-2">
        <p className="font-mono text-[9px] uppercase tracking-wide text-white/30">
          Criterion Scores
        </p>
        {lead.criterion_scores.map((cs) => (
          <div key={cs.criterion_id} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] text-white/40 uppercase tracking-wide">
                {cs.category}
              </span>
              <span className={cn('font-mono text-[9px]', RANK_DOT[effectiveRank])}>
                {cs.score.toFixed(2)}
              </span>
            </div>
            <div className="h-[2px] bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full', RANK_BAR[effectiveRank])}
                style={{ width: `${cs.score * 100}%` }}
              />
            </div>
            {cs.evidence && cs.evidence !== '(not evaluated)' && (
              <p className="font-mono text-[9px] text-white/25 leading-relaxed">
                {cs.evidence}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Reasoning */}
      {lead.reasoning && (
        <div>
          <p className="font-mono text-[9px] uppercase tracking-wide text-white/30 mb-1">
            Reasoning
          </p>
          <p className="text-xs text-white/50 leading-relaxed">{lead.reasoning}</p>
        </div>
      )}

      {/* Override buttons */}
      <div>
        <p className="font-mono text-[9px] uppercase tracking-wide text-white/30 mb-1.5">
          Override Rank
        </p>
        <div className="flex items-center gap-1.5">
          {(['high', 'medium', 'low'] as const).map((r) => (
            <button
              key={r}
              onClick={() => onOverride(r)}
              disabled={overriding}
              className={cn(
                'font-mono text-[9px] uppercase tracking-wide px-2 py-1 border transition-colors disabled:opacity-50',
                lead.user_override_rank === r
                  ? RANK_BADGE[r]
                  : 'border-white/[0.1] text-white/30 hover:border-white/[0.2] hover:text-white/60'
              )}
            >
              {overriding ? '…' : RANK_LABEL[r]}
            </button>
          ))}
          {lead.user_override_rank && (
            <button
              onClick={() => onOverride(lead.rank)}
              disabled={overriding}
              className="font-mono text-[9px] uppercase tracking-wide px-2 py-1 border border-white/[0.08] text-white/25 hover:text-white/50 transition-colors disabled:opacity-50"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Feedback */}
      <div>
        <p className="font-mono text-[9px] uppercase tracking-wide text-white/30 mb-1.5">
          Feedback (optional)
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFeedbackSubmit()}
            placeholder="Why did you override?"
            className="flex-1 bg-white/[0.04] border border-white/[0.08] text-white/70 text-xs px-2 py-1.5 outline-none focus:border-white/[0.2] transition-colors placeholder:text-white/20"
          />
          <button
            onClick={handleFeedbackSubmit}
            disabled={!feedback.trim()}
            className="font-mono text-[9px] uppercase tracking-wide px-2 py-1.5 border border-white/[0.1] text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors disabled:opacity-30"
          >
            {feedbackSaved ? '✓' : 'Save'}
          </button>
        </div>
      </div>

      {/* Draft message preview */}
      {lead.draft_body && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="font-mono text-[9px] uppercase tracking-wide text-purple-400/70">
              Draft Message
            </p>
            <button
              onClick={handleCopyDraft}
              className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wide px-2 py-0.5 border border-purple-800/40 text-purple-400/70 hover:bg-purple-900/30 transition-colors"
            >
              {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          {lead.draft_subject && (
            <p className="font-mono text-[9px] text-white/40 mb-1">
              Subject: {lead.draft_subject}
            </p>
          )}
          <div className="bg-purple-900/10 border border-purple-800/20 rounded-[2px] p-2.5 text-xs text-white/55 leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto">
            {lead.draft_body}
          </div>
        </div>
      )}

      {/* Outreach status */}
      <div>
        <p className="font-mono text-[9px] uppercase tracking-wide text-white/30 mb-1.5">
          Outreach Status
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['pending', 'sent', 'replied', 'ignored'] as const).map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              className={cn(
                'font-mono text-[9px] uppercase tracking-wide px-2 py-1 border transition-colors',
                (lead.outreach_status ?? 'pending') === s
                  ? OUTREACH_STATUS_BADGE[s]
                  : 'border-white/[0.08] text-white/25 hover:border-white/[0.15] hover:text-white/50'
              )}
            >
              {OUTREACH_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Lead Card ────────────────────────────────────────────────────────────────

interface LeadCardProps {
  lead: ScoredLead;
  campaignId: string;
  onUpdated: (lead: ScoredLead) => void;
  onDraftWithStyle?: (leadId: string) => void;
  hasStyleModel?: boolean;
}

function LeadCard({ lead, campaignId, onUpdated, onDraftWithStyle, hasStyleModel }: LeadCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [drafting, setDrafting] = useState(false);

  const effectiveRank = lead.user_override_rank ?? lead.rank;
  const outreachStatus = lead.outreach_status ?? 'pending';

  // Build key signals from profile_data (top 2-3 non-empty, non-url values)
  const keySignals = Object.entries(lead.profile_data)
    .filter(([k, v]) => v && v.trim() && !v.startsWith('http') && !/url|link|id$/i.test(k))
    .slice(0, 3)
    .map(([, v]) => v.trim().slice(0, 25));

  const handleOverride = async (rank: 'high' | 'medium' | 'low') => {
    setOverriding(true);
    try {
      const res = await fetch(`/api/outreach/campaigns/${campaignId}/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_override_rank: rank === lead.rank ? null : rank }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdated(data.lead as ScoredLead);
      }
    } catch {
      // ignore
    } finally {
      setOverriding(false);
    }
  };

  const handleFeedback = async (text: string) => {
    try {
      const res = await fetch(`/api/outreach/campaigns/${campaignId}/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_feedback: text }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdated(data.lead as ScoredLead);
      }
    } catch {
      // ignore
    }
  };

  const handleStatusChange = async (status: 'pending' | 'sent' | 'replied' | 'ignored') => {
    // Optimistic update
    onUpdated({ ...lead, outreach_status: status });
    try {
      const res = await fetch(`/api/outreach/campaigns/${campaignId}/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outreach_status: status }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdated(data.lead as ScoredLead);
      }
    } catch {
      // ignore
    }
  };

  const handleDraftWithStyleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (drafting) return;
    setDrafting(true);
    try {
      if (onDraftWithStyle) {
        onDraftWithStyle(lead.id);
      } else {
        // Inline draft — call style/draft and save to lead
        const title =
          lead.profile_data['Title'] ?? lead.profile_data['title'] ?? '';
        const company =
          lead.profile_data['Company'] ?? lead.profile_data['company'] ?? '';
        const res = await fetch('/api/outreach/style/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead: {
              name: lead.name,
              title,
              company,
              profile_data: lead.profile_data,
            },
            purpose: 'introduce and connect',
            campaign_id: campaignId,
          }),
        });
        if (res.ok) {
          const draft = await res.json() as { subject: string; body: string };
          const patchRes = await fetch(
            `/api/outreach/campaigns/${campaignId}/leads/${lead.id}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                draft_subject: draft.subject || null,
                draft_body: draft.body || null,
              }),
            }
          );
          if (patchRes.ok) {
            const data = await patchRes.json();
            onUpdated(data.lead as ScoredLead);
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setDrafting(false);
    }
  };

  return (
    <div
      className={cn(
        'bg-white/[0.04] border rounded-[2px] p-3 cursor-pointer transition-colors',
        expanded
          ? 'border-white/[0.15] bg-white/[0.06]'
          : 'border-white/[0.08] hover:border-white/[0.14] hover:bg-white/[0.055]'
      )}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('text-[10px] flex-shrink-0', RANK_DOT[effectiveRank])}>⬤</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm text-white/80 font-medium leading-tight">
                {lead.name}
              </span>
              {lead.user_override_rank && (
                <span className="font-mono text-[8px] uppercase tracking-wide px-1 py-0.5 bg-blue-900/30 border border-blue-800/40 text-blue-400">
                  OVERRIDE
                </span>
              )}
              {lead.source === 'agent_discovery' && (
                <span className="font-mono text-[8px] uppercase tracking-wide px-1 py-0.5 bg-purple-900/20 border border-purple-800/30 text-purple-400/80">
                  🤖 Discovered
                </span>
              )}
              {lead.draft_body && (
                <span className="font-mono text-[8px] uppercase tracking-wide px-1 py-0.5 bg-purple-900/30 border border-purple-800/40 text-purple-400 flex items-center gap-0.5">
                  <Mail className="w-2 h-2" />
                  Draft
                </span>
              )}
            </div>
            {lead.profile_data['Title'] || lead.profile_data['title'] || lead.profile_data['Company'] ? (
              <p className="text-xs text-white/40 mt-0.5 truncate">
                {[
                  lead.profile_data['Title'] ?? lead.profile_data['title'],
                  lead.profile_data['Company'] ?? lead.profile_data['company'],
                ]
                  .filter(Boolean)
                  .join(' @ ')}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Outreach status badge — only show if not pending */}
          {outreachStatus !== 'pending' && (
            <span
              className={cn(
                'font-mono text-[8px] uppercase tracking-wide px-1.5 py-0.5 border',
                OUTREACH_STATUS_BADGE[outreachStatus]
              )}
            >
              {OUTREACH_STATUS_LABEL[outreachStatus]}
            </span>
          )}
          <span className={cn('font-mono text-[11px]', RANK_DOT[effectiveRank])}>
            {lead.score}/100
          </span>
          <span
            className={cn(
              'font-mono text-[9px] uppercase px-1.5 py-0.5 border',
              RANK_BADGE[effectiveRank]
            )}
          >
            {RANK_LABEL[effectiveRank]}
            {lead.user_override_rank && (
              <span className="opacity-50 ml-0.5">({RANK_LABEL[lead.rank]})</span>
            )}
          </span>
        </div>
      </div>

      {keySignals.length > 0 && (
        <p className="font-mono text-[9px] text-white/30 mt-1.5 truncate">
          {keySignals.join(' · ')}
        </p>
      )}

      {/* Draft with My Style row */}
      <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleDraftWithStyleClick}
          disabled={drafting}
          className={cn(
            'font-mono text-[8px] uppercase tracking-wide px-2 py-0.5 border transition-colors flex items-center gap-1',
            lead.draft_body
              ? 'border-indigo-800/40 text-indigo-400/70 hover:text-indigo-300 hover:border-indigo-700/60 bg-indigo-900/10'
              : 'border-white/[0.10] text-white/35 hover:text-white/60 hover:border-white/[0.20]'
          )}
        >
          {drafting ? (
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
          ) : (
            <Sparkles className="w-2.5 h-2.5" />
          )}
          {drafting ? 'Drafting…' : lead.draft_body ? 'Re-draft' : 'Draft with My Style'}
        </button>
        {hasStyleModel ? (
          <span className="font-mono text-[8px] text-indigo-400/50">✨ styled</span>
        ) : (
          <span className="font-mono text-[8px] text-white/20">💡 Add style examples in chat</span>
        )}
      </div>

      {expanded && (
        <div onClick={(e) => e.stopPropagation()}>
          <ExpandedLeadView
            lead={lead}
            onOverride={handleOverride}
            onFeedback={handleFeedback}
            onStatusChange={handleStatusChange}
            overriding={overriding}
          />
        </div>
      )}
    </div>
  );
}

// ─── Leads Panel (right panel results section) ────────────────────────────────

// ─── Discovery Stats Bar ──────────────────────────────────────────────────────

interface DiscoveryStatsBarProps {
  campaignId: string;
  refreshKey: number;
}

function DiscoveryStatsBar({ campaignId, refreshKey }: DiscoveryStatsBarProps) {
  const [stats, setStats] = useState<DiscoveryStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/outreach/campaigns/${campaignId}/discover`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: DiscoveryStats | null) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [campaignId, refreshKey]);

  // Only show when there are agent-discovered leads
  if (!stats || stats.by_source.agent_discovery === 0) return null;

  return (
    <div className="mx-4 mt-3 mb-0 px-3 py-2 bg-white/[0.03] border border-white/[0.07] rounded-[2px] flex items-center gap-3 flex-wrap">
      <span className="font-mono text-[9px] uppercase tracking-wide text-white/30">Lead Sources</span>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-[9px] text-white/50">
          Total: <span className="text-white/70">{stats.total_leads}</span>
        </span>
        <span className="text-white/15">|</span>
        <span className="font-mono text-[9px] text-white/50">
          📋 <span className="text-white/70">{stats.by_source.dataset}</span> from dataset
        </span>
        <span className="text-white/15">|</span>
        <span className="font-mono text-[9px] text-purple-400/80">
          🤖 <span className="text-purple-300">{stats.by_source.agent_discovery}</span> agent-discovered
        </span>
      </div>
    </div>
  );
}

// ─── Leads Panel ─────────────────────────────────────────────────────────────

interface LeadsPanelProps {
  campaignId: string;
  refreshKey: number;
  onDraftMessages?: () => void;
}

function LeadsPanel({ campaignId, refreshKey, onDraftMessages }: LeadsPanelProps) {
  const [leads, setLeads] = useState<ScoredLead[]>([]);
  const [stats, setStats] = useState<ScoringStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [rankFilter, setRankFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [overrideSummary, setOverrideSummary] = useState<{ total_overrides: number; has_enough_for_refinement: boolean } | null>(null);
  const [refineBannerDismissed, setRefineBannerDismissed] = useState(false);
  const [hasStyleModel, setHasStyleModel] = useState(false);

  const loadLeads = useCallback(async (filter: typeof rankFilter) => {
    setLoading(true);
    try {
      const url = filter === 'all'
        ? `/api/outreach/campaigns/${campaignId}/leads?limit=200`
        : `/api/outreach/campaigns/${campaignId}/leads?rank=${filter}&limit=200`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setLeads(data.leads ?? []);
      setStats({ scored: data.total, by_rank: data.by_rank });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  // Load override summary for refinement banner
  const loadOverrideSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/outreach/campaigns/${campaignId}/refine`);
      if (res.ok) {
        const data = await res.json();
        setOverrideSummary(data);
      }
    } catch {
      // ignore
    }
  }, [campaignId]);

  useEffect(() => {
    loadLeads(rankFilter);
    loadOverrideSummary();
    // Check if user has a style model
    fetch('/api/outreach/style')
      .then((r) => r.ok ? r.json() : null)
      .then((data: { has_style_model?: boolean } | null) => {
        if (data) setHasStyleModel(!!data.has_style_model);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, refreshKey, rankFilter]);

  const handleLeadUpdated = (updated: ScoredLead) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  };

  const totalScored = stats
    ? (stats.by_rank.high + stats.by_rank.medium + stats.by_rank.low)
    : 0;

  // Compute outreach progress
  const drafted = leads.filter((l) => l.draft_body).length;
  const sent = leads.filter((l) => l.outreach_status === 'sent').length;
  const replied = leads.filter((l) => l.outreach_status === 'replied').length;

  const showRefineBanner =
    !refineBannerDismissed &&
    overrideSummary?.has_enough_for_refinement &&
    totalScored > 0;

  const hasHighOrMedium = (stats?.by_rank.high ?? 0) + (stats?.by_rank.medium ?? 0) > 0;

  if (loading && leads.length === 0) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-white/[0.02] border border-white/[0.05] rounded-[2px] animate-pulse" />
        ))}
      </div>
    );
  }

  if (totalScored === 0 && !loading) {
    return (
      <p className="text-xs text-white/25 leading-relaxed">
        No leads scored yet. Click &quot;Score Leads&quot; to rank your dataset.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Refinement banner */}
      {showRefineBanner && (
        <div className="bg-blue-900/20 border border-blue-800/30 rounded-[3px] p-3 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-sm flex-shrink-0">💡</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-blue-300/80 leading-relaxed">
                <span className="font-medium">{overrideSummary?.total_overrides} leads</span> have been manually adjusted.
              </p>
              <p className="text-xs text-blue-400/60 mt-0.5">Refine criteria to improve future scoring?</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // Trigger refinement flow — bubble up via onDraftMessages parent prop
                // We use a custom event for simplicity
                window.dispatchEvent(new CustomEvent('outreach:refine', { detail: { campaignId } }));
              }}
              className="font-mono text-[9px] uppercase tracking-wide px-2.5 py-1 bg-blue-900/30 border border-blue-800/40 text-blue-400 hover:bg-blue-900/50 transition-colors"
            >
              Refine Criteria
            </button>
            <button
              onClick={() => setRefineBannerDismissed(true)}
              className="font-mono text-[9px] uppercase tracking-wide px-2.5 py-1 border border-white/[0.08] text-white/30 hover:text-white/50 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Summary bar */}
      {stats && totalScored > 0 && (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-[2px] p-3 space-y-2">
          <p className="font-mono text-[9px] uppercase tracking-wide text-white/50">
            {totalScored} Leads Scored
          </p>
          {/* Visual bar */}
          <div className="flex h-[4px] rounded-full overflow-hidden gap-px">
            {stats.by_rank.high > 0 && (
              <div
                className="bg-emerald-500 rounded-full"
                style={{ flex: stats.by_rank.high }}
              />
            )}
            {stats.by_rank.medium > 0 && (
              <div
                className="bg-amber-500 rounded-full"
                style={{ flex: stats.by_rank.medium }}
              />
            )}
            {stats.by_rank.low > 0 && (
              <div
                className="bg-white/20 rounded-full"
                style={{ flex: stats.by_rank.low }}
              />
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] text-emerald-400">
              ■ {stats.by_rank.high} High
            </span>
            <span className="font-mono text-[9px] text-amber-400">
              ■ {stats.by_rank.medium} Med
            </span>
            <span className="font-mono text-[9px] text-white/30">
              ■ {stats.by_rank.low} Low
            </span>
          </div>
          {/* Outreach progress */}
          {(drafted > 0 || sent > 0 || replied > 0) && (
            <div className="pt-1.5 border-t border-white/[0.06]">
              <p className="font-mono text-[9px] text-white/30">
                {drafted > 0 && `${drafted} drafted`}
                {sent > 0 && ` · ${sent} sent`}
                {replied > 0 && ` · ${replied} replied`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Draft messages button */}
      {hasHighOrMedium && onDraftMessages && (
        <button
          onClick={onDraftMessages}
          className="w-full flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-wide px-3 py-1.5 bg-purple-900/30 border border-purple-800/40 text-purple-400 hover:bg-purple-900/50 transition-colors"
        >
          <MessageSquare className="w-3 h-3" />
          Draft Messages
        </button>
      )}

      {/* Filter tabs */}
      {totalScored > 0 && (
        <div className="flex items-center gap-0.5 border-b border-white/[0.06] pb-2">
          {(['all', 'high', 'medium', 'low'] as const).map((f) => {
            const count =
              f === 'all'
                ? totalScored
                : stats?.by_rank[f] ?? 0;
            const isActive = rankFilter === f;
            return (
              <button
                key={f}
                onClick={() => setRankFilter(f)}
                className={cn(
                  'font-mono text-[9px] uppercase tracking-wide px-2 py-1 transition-colors border-b-2 -mb-2',
                  isActive
                    ? f === 'high'
                      ? 'text-emerald-400 border-emerald-600'
                      : f === 'medium'
                      ? 'text-amber-400 border-amber-600'
                      : f === 'low'
                      ? 'text-white/50 border-white/30'
                      : 'text-white/80 border-white/50'
                    : 'text-white/30 border-transparent hover:text-white/50'
                )}
              >
                {f} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Lead cards */}
      <div className="space-y-1.5">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            campaignId={campaignId}
            onUpdated={handleLeadUpdated}
            hasStyleModel={hasStyleModel}
          />
        ))}
        {leads.length === 0 && !loading && rankFilter !== 'all' && (
          <p className="text-xs text-white/25">No {rankFilter} leads.</p>
        )}
      </div>
    </div>
  );
}

// ─── Template Editor Modal ────────────────────────────────────────────────────

interface TemplateEditorModalProps {
  campaignId: string;
  onClose: () => void;
  onDrafted: (count: number) => void;
}

function TemplateEditorModal({ campaignId, onClose, onDrafted }: TemplateEditorModalProps) {
  const [channel, setChannel] = useState<'email' | 'linkedin'>('email');
  const [template, setTemplate] = useState<OutreachTemplate | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [generating, setGenerating] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState('');
  const [draftMsg, setDraftMsg] = useState('');

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch(`/api/outreach/campaigns/${campaignId}/outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_template', channel }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to generate template.');
        return;
      }
      const t = data.template as OutreachTemplate;
      setTemplate(t);
      setSubject(t.subject ?? '');
      setBody(t.body ?? '');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDraftAll = async () => {
    if (!body.trim()) return;
    setDrafting(true);
    setDraftMsg('');
    setError('');

    const activeTemplate: OutreachTemplate = template
      ? { ...template, subject, body, channel }
      : {
          id: crypto.randomUUID(),
          name: 'Custom Template',
          subject,
          body,
          channel,
          variables: [...(body.matchAll(/\{\{(\w+)\}\}/g))].map((m) => m[1]),
          created_at: new Date().toISOString(),
        };

    try {
      const res = await fetch(`/api/outreach/campaigns/${campaignId}/outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'personalize_all', template: activeTemplate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to draft messages.');
        return;
      }
      setDraftMsg(`✓ ${data.count} messages drafted`);
      onDrafted(data.count as number);
      setTimeout(() => onClose(), 2000);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setDrafting(false);
    }
  };

  // Auto-generate on mount
  useEffect(() => {
    handleGenerate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detectedVars = [...new Set([...(body.matchAll(/\{\{(\w+)\}\}/g))].map((m) => m[1]))];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-black/[0.6] backdrop-blur-[20px] border border-white/[0.12] rounded-[3px] w-full max-w-lg mx-4 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-mono text-[11px] uppercase tracking-wide text-white/70 flex items-center gap-2">
            <span>📝</span> Outreach Template
          </h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Channel selector */}
        <div className="mb-4">
          <label className="block font-mono text-[10px] uppercase tracking-wide text-white/40 mb-2">
            Channel
          </label>
          <div className="flex gap-2">
            {(['email', 'linkedin'] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                disabled={generating}
                className={cn(
                  'flex-1 py-2 font-mono text-[10px] uppercase tracking-wide border transition-colors',
                  channel === ch
                    ? 'bg-white/[0.08] border-white/[0.2] text-white/80'
                    : 'border-white/[0.08] text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
                )}
              >
                {ch === 'email' ? '✉ Email' : '🔗 LinkedIn'}
              </button>
            ))}
          </div>
        </div>

        {generating ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
            <p className="font-mono text-[10px] uppercase tracking-wide text-white/40">
              Generating template…
            </p>
          </div>
        ) : (
          <>
            {/* Subject (email only) */}
            {channel === 'email' && (
              <div className="mb-4">
                <label className="block font-mono text-[10px] uppercase tracking-wide text-white/40 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject line…"
                  className="w-full bg-white/[0.04] border border-white/[0.1] text-white/90 text-sm px-3 py-2.5 outline-none focus:border-white/[0.25] focus:bg-white/[0.06] transition-colors placeholder:text-white/20"
                />
              </div>
            )}

            {/* Body */}
            <div className="mb-4">
              <label className="block font-mono text-[10px] uppercase tracking-wide text-white/40 mb-2">
                Body
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                placeholder="Message body with {{variables}}…"
                className="w-full bg-white/[0.04] border border-white/[0.1] text-white/90 text-sm px-3 py-2.5 outline-none focus:border-white/[0.25] focus:bg-white/[0.06] transition-colors placeholder:text-white/20 resize-none font-mono"
              />
            </div>

            {/* Variables */}
            {detectedVars.length > 0 && (
              <div className="mb-4">
                <p className="font-mono text-[9px] uppercase tracking-wide text-white/30 mb-1">
                  Variables
                </p>
                <p className="font-mono text-[10px] text-purple-400/70">
                  {detectedVars.map((v) => `{{${v}}}`).join(', ')}
                </p>
              </div>
            )}

            {error && (
              <p className="mb-3 font-mono text-[10px] text-red-400/80 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            )}

            {draftMsg && (
              <p className="mb-3 font-mono text-[10px] text-emerald-400">
                {draftMsg}
              </p>
            )}

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
              <button
                onClick={() => handleGenerate()}
                disabled={generating}
                className="font-mono text-[10px] uppercase tracking-wide px-3 py-2 border border-white/[0.1] text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors disabled:opacity-40 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" />
                Regenerate
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="font-mono text-[10px] uppercase tracking-wide px-3 py-2 text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors border border-transparent hover:border-white/[0.08]"
                  disabled={drafting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDraftAll}
                  disabled={drafting || !body.trim()}
                  className="font-mono text-[10px] uppercase tracking-wide px-4 py-2 bg-purple-900/40 border border-purple-800/50 text-purple-300 hover:bg-purple-900/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {drafting ? (
                    <><Loader2 className="w-3 h-3 animate-spin" />Drafting…</>
                  ) : (
                    <><MessageSquare className="w-3 h-3" />Draft for All</>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Refinement Modal ─────────────────────────────────────────────────────────

interface RefinementModalProps {
  campaignId: string;
  onClose: () => void;
  onConfirmed: () => void;
}

function RefinementModal({ campaignId, onClose, onConfirmed }: RefinementModalProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<FeedbackAnalysis | null>(null);
  const [error, setError] = useState('');
  const [rescoring, setRescoring] = useState(false);

  const runRefinement = async () => {
    setAnalyzing(true);
    setError('');
    try {
      const res = await fetch(`/api/outreach/campaigns/${campaignId}/refine`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Refinement failed.');
        return;
      }
      setAnalysis(data.analysis as FeedbackAnalysis);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRescore = async () => {
    setRescoring(true);
    try {
      await fetch(`/api/outreach/campaigns/${campaignId}/leads`, { method: 'POST' });
      onConfirmed();
      onClose();
    } catch {
      // ignore
    } finally {
      setRescoring(false);
    }
  };

  // Auto-run on mount
  useEffect(() => {
    runRefinement();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-black/[0.6] backdrop-blur-[20px] border border-white/[0.12] rounded-[3px] w-full max-w-md mx-4 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-mono text-[11px] uppercase tracking-wide text-white/70 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            Criteria Refinement
          </h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {analyzing && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <p className="font-mono text-[10px] uppercase tracking-wide text-white/40">
              Analyzing corrections…
            </p>
          </div>
        )}

        {error && !analyzing && (
          <div className="py-4">
            <p className="font-mono text-[10px] text-red-400/80 flex items-center gap-1 mb-4">
              <AlertCircle className="w-3 h-3" />
              {error}
            </p>
            <div className="flex gap-2">
              <button
                onClick={runRefinement}
                className="font-mono text-[10px] uppercase tracking-wide px-3 py-2 bg-white/[0.06] border border-white/[0.1] text-white/60 hover:text-white/80 transition-colors"
              >
                Retry
              </button>
              <button
                onClick={onClose}
                className="font-mono text-[10px] uppercase tracking-wide px-3 py-2 text-white/40 hover:text-white/60 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {analysis && !analyzing && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-blue-900/10 border border-blue-800/20 rounded-[2px] p-3">
              <p className="text-xs text-blue-300/70 leading-relaxed">{analysis.summary}</p>
            </div>

            {/* Adjustments */}
            {analysis.adjustments.length > 0 && (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wide text-white/40 mb-2">
                  Adjusted Criteria
                </p>
                <div className="space-y-2">
                  {analysis.adjustments.map((adj: CriterionAdjustment) => (
                    <div key={adj.criterion_id} className="bg-white/[0.03] border border-white/[0.07] rounded-[2px] p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[10px] text-white/60">{adj.criterion_id}</span>
                        <span className="font-mono text-[10px] text-white/40">
                          {adj.old_importance.toFixed(2)} →{' '}
                          <span className={adj.new_importance > adj.old_importance ? 'text-emerald-400' : 'text-amber-400'}>
                            {adj.new_importance.toFixed(2)}
                          </span>
                        </span>
                      </div>
                      <p className="text-xs text-white/35 leading-relaxed">{adj.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New criteria */}
            {analysis.new_criteria.length > 0 && (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wide text-white/40 mb-2">
                  Discovered Criteria
                </p>
                <div className="space-y-1.5">
                  {analysis.new_criteria.map((c, i) => (
                    <div key={i} className="bg-amber-900/10 border border-amber-800/20 rounded-[2px] p-2">
                      <p className="text-xs text-amber-400/70">
                        ✦ {c.description}
                        <span className="text-amber-400/40 ml-1">(importance: {c.importance.toFixed(2)})</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New anti-patterns */}
            {analysis.new_anti_patterns.length > 0 && (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wide text-white/40 mb-2">
                  New Exclusions
                </p>
                {analysis.new_anti_patterns.map((ap, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-red-400/60">
                    <span>✕</span>
                    <span>{ap}</span>
                  </div>
                ))}
              </div>
            )}

            {analysis.adjustments.length === 0 && analysis.new_criteria.length === 0 && (
              <p className="text-xs text-white/40 text-center py-2">No changes to apply.</p>
            )}

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
              <button
                onClick={onClose}
                className="font-mono text-[10px] uppercase tracking-wide px-3 py-2 text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors border border-transparent hover:border-white/[0.08]"
              >
                Done
              </button>
              {(analysis.adjustments.length > 0 || analysis.new_criteria.length > 0) && (
                <button
                  onClick={handleRescore}
                  disabled={rescoring}
                  className="font-mono text-[10px] uppercase tracking-wide px-4 py-2 bg-blue-900/30 border border-blue-800/40 text-blue-400 hover:bg-blue-900/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {rescoring ? (
                    <><Loader2 className="w-3 h-3 animate-spin" />Re-Scoring…</>
                  ) : (
                    <><BarChart2 className="w-3 h-3" />Re-Score Leads</>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── New Campaign Modal ───────────────────────────────────────────────────────

interface NewCampaignModalProps {
  onClose: () => void;
  onCreated: (campaign: Campaign) => void;
}

function NewCampaignModal({ onClose, onCreated }: NewCampaignModalProps) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Campaign name is required.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/outreach/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create campaign.");
        return;
      }
      onCreated(data.campaign);
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }, [name, onCreated, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCreate();
    if (e.key === "Escape") onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-black/[0.6] backdrop-blur-[20px] border border-white/[0.12] rounded-[3px] w-full max-w-sm mx-4 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-mono text-[11px] uppercase tracking-wide text-white/70">
            New Campaign
          </h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mb-4">
          <label className="block font-mono text-[10px] uppercase tracking-wide text-white/40 mb-2">
            Campaign Name
          </label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. SF Series A founders"
            className="w-full bg-white/[0.04] border border-white/[0.1] text-white/90 text-sm px-3 py-2.5 outline-none focus:border-white/[0.25] focus:bg-white/[0.06] transition-colors placeholder:text-white/20"
            disabled={creating}
          />
          {error && (
            <p className="mt-2 font-mono text-[10px] text-red-400/80">{error}</p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="font-mono text-[10px] uppercase tracking-wide px-4 py-2 text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors border border-transparent hover:border-white/[0.08]"
            disabled={creating}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="font-mono text-[10px] uppercase tracking-wide px-4 py-2 bg-white/[0.08] border border-white/[0.15] text-white/80 hover:bg-white/[0.12] hover:text-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── User Model UI ────────────────────────────────────────────────────────────

interface UserMemory {
  id: string;
  memory: string;
  domain?: string;
  importance?: number;
}

interface UserModel {
  profile: UserMemory[];
  workflows: UserMemory[];
  communication: UserMemory[];
}

function UserModelPanel({ campaignSelected }: { campaignSelected: boolean }) {
  const [userModel, setUserModel] = useState<UserModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!campaignSelected) return;
    setLoading(true);
    fetch('/api/outreach/user-model')
      .then((r) => r.json())
      .then((d: UserModel) => setUserModel(d))
      .catch(() => setUserModel(null))
      .finally(() => setLoading(false));
  }, [campaignSelected]);

  const total =
    (userModel?.profile.length ?? 0) +
    (userModel?.workflows.length ?? 0) +
    (userModel?.communication.length ?? 0);

  const isEmpty = !loading && (!userModel || total === 0);

  // Top items across all domains for expanded view (up to 3 per domain)
  const topProfile = userModel?.profile.slice(0, 3) ?? [];
  const topWorkflows = userModel?.workflows.slice(0, 3) ?? [];
  const topCommunication = userModel?.communication.slice(0, 3) ?? [];

  return (
    <div className="mx-4 mb-4 bg-black/20 backdrop-blur border border-white/10 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-purple-400/70" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/50">
            User Model
          </span>
          <span className="font-mono text-[9px] text-white/25">(Cross-Campaign)</span>
        </div>
        {!isEmpty && !loading && (
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] text-white/30">
              Profile: {userModel?.profile.length ?? 0} · Workflows: {userModel?.workflows.length ?? 0} · Style: {userModel?.communication.length ?? 0}
            </span>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="font-mono text-[9px] text-white/40 hover:text-white/60 transition-colors flex items-center gap-1"
            >
              {expanded ? 'Collapse ▲' : 'View details ▼'}
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {loading && (
          <div className="flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin text-white/20" />
            <span className="font-mono text-[10px] text-white/20">Loading user model…</span>
          </div>
        )}

        {isEmpty && (
          <p className="text-xs text-white/30 leading-relaxed">
            Your preferences will be remembered across campaigns as you use the agent.
          </p>
        )}

        {!loading && !isEmpty && !expanded && (
          <p className="font-mono text-[10px] text-white/40">
            {total} pattern{total !== 1 ? 's' : ''} stored. Click &quot;View details&quot; to expand.
          </p>
        )}

        {!loading && !isEmpty && expanded && (
          <div className="space-y-3">
            {topProfile.length > 0 && (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-1.5">Evaluation patterns</p>
                <ul className="space-y-1">
                  {topProfile.map((m) => (
                    <li key={m.id} className="text-xs text-white/50 flex items-start gap-1.5">
                      <span className="text-white/20 mt-0.5">•</span>
                      {m.memory}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {topWorkflows.length > 0 && (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-1.5">Discovery methods</p>
                <ul className="space-y-1">
                  {topWorkflows.map((m) => (
                    <li key={m.id} className="text-xs text-white/50 flex items-start gap-1.5">
                      <span className="text-white/20 mt-0.5">•</span>
                      {m.memory}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {topCommunication.length > 0 && (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-1.5">Communication style</p>
                <ul className="space-y-1">
                  {topCommunication.map((m) => (
                    <li key={m.id} className="text-xs text-white/50 flex items-start gap-1.5">
                      <span className="text-white/20 mt-0.5">•</span>
                      {m.memory}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Workflow Tab UI ──────────────────────────────────────────────────────────

type WorkflowBadgeColors = Record<string, string>;

const WORKFLOW_BADGE_COLORS: WorkflowBadgeColors = {
  discovery: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  enrichment: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  outreach: 'bg-green-500/20 text-green-300 border-green-500/30',
  custom: 'bg-white/10 text-white/60 border-white/20',
};

function WorkflowToolIcon({ tool }: { tool: string }) {
  const cls = 'w-3.5 h-3.5 text-white/40 flex-shrink-0';
  if (tool === 'google_maps' || tool === 'web_search') return <Search className={cls} />;
  if (tool === 'linkedin') return <User className={cls} />;
  if (tool === 'email') return <Mail className={cls} />;
  return <CircleDot className={cls} />;
}

interface WorkflowTabContentProps {
  workflows: Workflow[];
  loading: boolean;
  onStartBrainDump: () => void;
  campaignSelected: boolean;
}

function WorkflowTabContent({ workflows, loading, onStartBrainDump, campaignSelected }: WorkflowTabContentProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
        <Loader2 className="w-5 h-5 text-white/20 animate-spin mb-3" />
        <p className="font-mono text-[10px] uppercase tracking-wide text-white/20">
          Loading workflows…
        </p>
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div className="flex flex-col">
        <div className="flex flex-col items-center justify-center px-8 py-12 text-center">
          <div className="w-10 h-10 bg-white/[0.04] border border-white/[0.08] rounded-lg flex items-center justify-center mx-auto mb-4">
            <Target className="w-5 h-5 text-white/20" />
          </div>
          <p className="text-sm text-white/50 mb-1">No workflows extracted yet.</p>
          <p className="font-mono text-[10px] uppercase tracking-wide text-white/20 mb-6 max-w-xs">
            Tell the agent how you find leads — it will extract your workflow automatically.
          </p>
          <button
            onClick={onStartBrainDump}
            className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide px-4 py-2 bg-white/[0.06] border border-white/[0.12] text-white/60 hover:bg-white/[0.10] hover:text-white/80 rounded transition-colors"
          >
            Start Brain Dump
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <UserModelPanel campaignSelected={campaignSelected} />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-3">
      {workflows.map((wf) => {
        const badgeClass = WORKFLOW_BADGE_COLORS[wf.type] ?? WORKFLOW_BADGE_COLORS.custom;
        return (
          <div
            key={wf.id}
            className="bg-black/20 backdrop-blur border border-white/10 rounded-lg p-4"
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className={cn(
                  'font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded border',
                  badgeClass
                )}
              >
                {wf.type}
              </span>
              <span className="text-sm font-medium text-white/80">{wf.name}</span>
              <span className="ml-auto font-mono text-[9px] text-white/30">
                {wf.source === 'user_stated' ? 'stated by you' : 'agent inferred'}
              </span>
            </div>

            {/* Steps */}
            {wf.steps.length > 0 && (
              <ol className="space-y-1.5 mb-3">
                {wf.steps.map((step) => (
                  <li key={step.order} className="flex items-start gap-2">
                    <span className="font-mono text-[9px] text-white/30 w-4 flex-shrink-0 mt-0.5">
                      {step.order}.
                    </span>
                    <WorkflowToolIcon tool={step.tool} />
                    <span className="text-xs text-white/60 leading-relaxed">
                      {step.description}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {/* Linked criteria chips */}
            {wf.linked_criteria.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {wf.linked_criteria.map((c) => (
                  <span
                    key={c}
                    className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-white/40"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <UserModelPanel campaignSelected={campaignSelected} />
    </div>
  );
}

// ─── Campaign Logs Panel ──────────────────────────────────────────────────────

interface CampaignLog {
  id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatLogEntry(log: CampaignLog): { icon: string; label: string; detail?: string } {
  const d = log.details;
  switch (log.action) {
    case 'lead_discovered':
      return {
        icon: '🤖',
        label: `Discovered ${d.count ?? '?'} leads via ${d.method ?? 'agent'}`,
        detail: d.high_count != null ? `${d.high_count} High` : undefined,
      };
    case 'scoring':
      return {
        icon: '📊',
        label: `Scored ${d.count ?? '?'} leads`,
        detail: d.high != null ? `${d.high} High, ${d.medium} Med, ${d.low} Low` : undefined,
      };
    case 'enrichment':
      return {
        icon: '🔍',
        label: `Enriched ${d.count ?? '?'} profiles${d.url_column ? ` from ${d.url_column} column` : ''}`,
      };
    case 'criteria_updated':
      return {
        icon: '✏️',
        label: `Criteria updated${d.criterion ? ` — ${d.criterion}` : ''}`,
        detail: d.old != null && d.new != null ? `${d.old} → ${d.new}` : undefined,
      };
    case 'dataset_connected':
      return {
        icon: '📋',
        label: `Dataset connected${d.source_name ? ` — ${d.source_name}` : ''}`,
        detail: d.row_count != null ? `${d.row_count} rows` : undefined,
      };
    case 'workflow_saved':
      return {
        icon: '🔄',
        label: `Workflow saved${d.name ? `: ${d.name}` : ''}`,
      };
    case 'style_extracted':
      return {
        icon: '🎨',
        label: `Style extracted${d.sample_count != null ? ` from ${d.sample_count} examples` : ''}`,
      };
    case 'draft_generated':
      return {
        icon: '✉️',
        label: `Draft generated${d.lead_name ? ` for ${d.lead_name}` : ''}`,
      };
    case 'feedback_processed':
      return {
        icon: '🔧',
        label: `Feedback processed${d.adjustment_count != null ? ` — ${d.adjustment_count} criteria adjusted` : ''}`,
      };
    default:
      return { icon: '📝', label: log.action };
  }
}

interface CampaignLogsPanelProps {
  campaignId: string;
  isActive: boolean;
}

function CampaignLogsPanel({ campaignId, isActive }: CampaignLogsPanelProps) {
  const [logs, setLogs] = useState<CampaignLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/outreach/campaigns/${campaignId}/logs?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (!isActive) return;
    setLoading(true);
    fetchLogs();
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [isActive, campaignId, fetchLogs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
        <div className="w-10 h-10 bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-5 h-5 text-white/20" />
        </div>
        <p className="text-sm text-white/40 mb-1">No activity yet.</p>
        <p className="font-mono text-[10px] uppercase tracking-wide text-white/20">
          Actions like enrichment, scoring, and discovery will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-wide text-white/30">
          Activity Log
        </p>
        {total > logs.length && (
          <p className="font-mono text-[10px] text-white/20">{total} total</p>
        )}
      </div>
      <div className="divide-y divide-white/[0.04]">
        {logs.map((log) => {
          const { icon, label, detail } = formatLogEntry(log);
          return (
            <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
              <span className="text-base leading-none mt-0.5 shrink-0">{icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-white/70 leading-snug">{label}</p>
                {detail && (
                  <p className="text-[11px] text-white/30 mt-0.5">{detail}</p>
                )}
              </div>
              <span className="text-[11px] text-white/25 shrink-0 mt-0.5 tabular-nums">
                {relativeTime(log.created_at)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main client ──────────────────────────────────────────────────────────────

interface OutreachClientProps {
  initialCampaigns: Campaign[];
  onCampaignsChange?: (campaigns: Campaign[]) => void;
}

export default function OutreachClient({
  initialCampaigns,
  onCampaignsChange,
}: OutreachClientProps) {
  const { user } = useUser();
  const { status: gatewayStatus } = useGateway();
  const pathname = usePathname();

  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialCampaigns.length > 0 ? initialCampaigns[0].id : null
  );

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelHidden, setRightPanelHidden] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [criteriaRefreshKey, setCriteriaRefreshKey] = useState(0);
  const [hasCriteria, setHasCriteria] = useState(false);
  const [dataset, setDataset] = useState<DatasetInfo | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanReport, setScanReport] = useState<AnalysisReport | null>(null);
  const [scoring, setScoring] = useState(false);
  const [scoringMsg, setScoringMsg] = useState('');
  const [leadsRefreshKey, setLeadsRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'workflow' | 'criteria' | 'dataset' | 'logs'>('workflow');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showRefinementModal, setShowRefinementModal] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);

  const isConnected = gatewayStatus === "connected";
  const isReconnecting =
    gatewayStatus === "reconnecting" ||
    gatewayStatus === "connecting" ||
    gatewayStatus === "checking";

  const selectedCampaign = campaigns.find((c) => c.id === selectedId) || null;

  const updateCampaigns = useCallback(
    (updated: Campaign[]) => {
      setCampaigns(updated);
      onCampaignsChange?.(updated);
    },
    [onCampaignsChange]
  );

  const handleCampaignCreated = useCallback(
    (campaign: Campaign) => {
      const updated = [campaign, ...campaigns];
      updateCampaigns(updated);
      setSelectedId(campaign.id);
      // Reset all stale state from previous campaign
      setMessageCount(0);
      setDataset(null);
      setScanReport(null);
      setScanning(false);
      setHasCriteria(false);
      setScoringMsg('');
      setLeadsRefreshKey((k) => k + 1);
      setShowTemplateModal(false);
      setShowRefinementModal(false);
      setActiveTab('workflow');
    },
    [campaigns, updateCampaigns]
  );

  const handleDeleteCampaign = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm("Delete this campaign?")) return;
      try {
        await fetch(`/api/outreach/campaigns/${id}`, { method: "DELETE" });
        const updated = campaigns.filter((c) => c.id !== id);
        updateCampaigns(updated);
        if (selectedId === id) {
          setSelectedId(updated.length > 0 ? updated[0].id : null);
        }
      } catch {
        // silently fail
      }
    },
    [campaigns, selectedId, updateCampaigns]
  );

  // When a new conversation is created for a campaign, persist conversation_id
  const handleConversationCreated = useCallback(
    async (conversationId: string) => {
      if (!selectedId) return;
      try {
        const campaign = campaigns.find((c) => c.id === selectedId);
        if (!campaign) return;
        const currentConfig = (campaign.config as Record<string, unknown>) || {};
        const res = await fetch(`/api/outreach/campaigns/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            config: { ...currentConfig, conversation_id: conversationId },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const updated = campaigns.map((c) =>
            c.id === selectedId ? data.campaign : c
          );
          updateCampaigns(updated);
        }
      } catch {
        // ignore
      }
    },
    [selectedId, campaigns, updateCampaigns]
  );

  const handleCriteriaRefresh = useCallback(() => {
    setCriteriaRefreshKey((k) => k + 1);
    setHasCriteria(true);
    if (rightPanelHidden) setRightPanelHidden(false);
  }, [rightPanelHidden]);

  const handleDatasetConnected = useCallback(async (info: DatasetInfo) => {
    setDataset(info);
  }, []);

  const handleScanTriggered = useCallback(async () => {
    if (!selectedId || scanning) return;
    setScanning(true);
    setScanReport(null);
    try {
      const res = await fetch(`/api/outreach/campaigns/${selectedId}/scan`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.report) {
        setScanReport(data.report);
        setCriteriaRefreshKey((k) => k + 1);
        // Refresh campaign status
        const campRes = await fetch(`/api/outreach/campaigns/${selectedId}`);
        if (campRes.ok) {
          const campData = await campRes.json();
          if (campData.campaign) {
            const updated = campaigns.map((c) =>
              c.id === selectedId ? campData.campaign : c
            );
            updateCampaigns(updated);
          }
        }
      }
    } catch {
      // scan failed silently
    } finally {
      setScanning(false);
    }
  }, [selectedId, scanning, campaigns, updateCampaigns]);

  const handleScoreLeads = useCallback(async () => {
    if (!selectedId || scoring) return;
    const rowCount = dataset?.row_count ?? 0;
    const criteriaCount = 0; // We'll just use a generic message
    setScoringMsg(`Scoring ${rowCount} leads${criteriaCount ? ` against ${criteriaCount} criteria` : ''}…`);
    setScoring(true);
    try {
      const res = await fetch(`/api/outreach/campaigns/${selectedId}/leads`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setScoringMsg(`✓ ${data.scored} leads scored — ${data.high} High, ${data.medium} Med, ${data.low} Low`);
        setLeadsRefreshKey((k) => k + 1);
        // Refresh campaign to pick up status change
        const campRes = await fetch(`/api/outreach/campaigns/${selectedId}`);
        if (campRes.ok) {
          const campData = await campRes.json();
          if (campData.campaign) {
            const updated = campaigns.map((c) =>
              c.id === selectedId ? campData.campaign : c
            );
            updateCampaigns(updated);
          }
        }
        setTimeout(() => setScoringMsg(''), 5000);
      } else {
        setScoringMsg(`Error: ${data.error ?? 'Scoring failed'}`);
        setTimeout(() => setScoringMsg(''), 4000);
      }
    } catch {
      setScoringMsg('Network error. Please try again.');
      setTimeout(() => setScoringMsg(''), 4000);
    } finally {
      setScoring(false);
    }
  }, [selectedId, scoring, dataset, campaigns, updateCampaigns]);

  // Listen for refinement trigger from LeadsPanel
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { campaignId: string };
      if (detail.campaignId === selectedId) {
        setShowRefinementModal(true);
      }
    };
    window.addEventListener('outreach:refine', handler);
    return () => window.removeEventListener('outreach:refine', handler);
  }, [selectedId]);

  // Reset state when switching campaigns
  const handleSelectCampaign = useCallback((id: string) => {
    setSelectedId(id);
    setMessageCount(0);
    setDataset(null);
    setScanReport(null);
    setScanning(false);
    setHasCriteria(false);
    setScoringMsg('');
    setLeadsRefreshKey((k) => k + 1);
    setShowTemplateModal(false);
    setShowRefinementModal(false);
    setActiveTab('workflow');
    setWorkflows([]);
  }, []);

  // Load dataset and criteria state when campaign changes
  useEffect(() => {
    if (!selectedId) {
      setDataset(null);
      setScanReport(null);
      setHasCriteria(false);
      return;
    }

    // Load dataset
    fetch(`/api/outreach/campaigns/${selectedId}/dataset`)
      .then((r) => r.json())
      .then((d) => {
        if (d.dataset) setDataset(d.dataset);
      })
      .catch(() => {});

    // Check if criteria exist
    fetch(`/api/outreach/campaigns/${selectedId}/criteria`)
      .then((r) => r.json())
      .then((d) => {
        if (d.criteria && d.criteria.criteria && d.criteria.criteria.length > 0) {
          setHasCriteria(true);
        }
      })
      .catch(() => {});

    // Load cached scan report from campaign config
    const campaign = campaigns.find((c) => c.id === selectedId);
    if (campaign) {
      const config = campaign.config as Record<string, unknown>;
      if (config.scan_report) {
        setScanReport(config.scan_report as AnalysisReport);
      } else {
        setScanReport(null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Load workflows when campaign changes or when user switches to workflow tab
  useEffect(() => {
    if (!selectedId || activeTab !== 'workflow') return;
    setWorkflowsLoading(true);
    fetch(`/api/outreach/campaigns/${selectedId}/workflows`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.workflows)) setWorkflows(d.workflows as Workflow[]);
      })
      .catch(() => {})
      .finally(() => setWorkflowsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, activeTab]);

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  }

  const navLinks = [
    { href: "/chat", label: "Chat" },
    { href: "/outreach", label: "Outreach" },
    { href: "/agents", label: "Agents" },
    { href: "/integrations", label: "Integrations" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex flex-col p-1 gap-1 md:p-[7px] md:gap-[7px] overflow-hidden"
        style={{
          backgroundImage: "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url('/img/landing_background.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
          willChange: "transform",
        }}
      >
        {/* ── Navbar ── */}
        <nav className="shrink-0 h-[48px] md:h-[56px] bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 overflow-hidden flex items-center px-3 md:px-6">
          <button
            onClick={() => setMobileSidebarOpen((v) => !v)}
            className="md:hidden w-8 h-8 flex items-center justify-center text-white/50 hover:text-white/80 mr-2"
          >
            {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="mr-4 md:mr-6">
            <WorkspaceSwitcher />
          </div>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href === "/chat" && pathname.startsWith("/chat"));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "text-sm px-3 py-1.5 transition-colors",
                    isActive
                      ? "text-white/90 font-semibold"
                      : "font-normal text-white/50 hover:text-white/80"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2 md:gap-4">
            {user && (
              <>
                <Link
                  href="/settings"
                  className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                >
                  {isConnected ? (
                    <>
                      <div className="w-2 h-2 bg-emerald-700 rounded-none block flex-shrink-0" />
                      <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wide text-emerald-600">
                        Online
                      </span>
                    </>
                  ) : isReconnecting ? (
                    <>
                      <div className="w-2 h-2 bg-amber-500 rounded-none block animate-pulse flex-shrink-0" />
                      <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wide text-amber-400">
                        Connecting
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-red-600 rounded-none block flex-shrink-0" />
                      <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wide text-red-500">
                        Offline
                      </span>
                    </>
                  )}
                </Link>
                <div className="h-4 w-px bg-white/[0.1]" />
              </>
            )}
            {user ? (
              <UserMenu user={user} />
            ) : (
              <Link
                href="/welcome"
                className="font-mono text-[10px] uppercase tracking-wide px-3 py-1.5 text-white/60 hover:bg-white/[0.1] hover:text-white/90 border border-white/[0.15] transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </nav>

        {/* ── Mobile Sidebar Overlay ── */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-[150] md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <div className="absolute inset-0 bg-black/40" />
            <aside
              className="absolute top-0 left-0 w-72 h-full bg-black/[0.15] backdrop-blur-[20px] border-r border-white/10 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-3 border-b border-white/[0.1] flex items-center justify-between">
                <button
                  onClick={() => {
                    setMobileSidebarOpen(false);
                    setShowNewModal(true);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-white/60 hover:text-white/90 border border-transparent hover:border-white/[0.1] transition-colors"
                >
                  <Plus className="w-4 h-4 flex-shrink-0" />
                  <span>New Campaign</span>
                </button>
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-white/80"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-3 py-2 border-b border-white/[0.08] flex flex-col gap-0.5">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileSidebarOpen(false)}
                      className={cn(
                        "text-sm px-3 py-2 rounded transition-colors",
                        isActive
                          ? "text-white/90 font-semibold bg-white/[0.06]"
                          : "text-white/50 hover:text-white/80"
                      )}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
              <CampaignList
                campaigns={campaigns}
                selectedId={selectedId}
                onSelect={(id) => {
                  handleSelectCampaign(id);
                  setMobileSidebarOpen(false);
                }}
                onDelete={handleDeleteCampaign}
                formatDate={formatDate}
              />
            </aside>
          </div>
        )}

        {/* ── Three-column content area ── */}
        <div className="flex-1 flex gap-[7px] min-h-0">
          {/* Left sidebar */}
          {!sidebarCollapsed && (
            <aside className="hidden md:flex shrink-0 w-72 bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 flex-col overflow-hidden">
              <div className="shrink-0 px-3 py-2.5 border-b border-white/[0.08] flex items-center gap-2">
                <button
                  onClick={() => setShowNewModal(true)}
                  className="flex-1 flex items-center gap-1.5 px-2 py-1.5 text-sm text-white/60 hover:text-white/90 border border-transparent hover:border-white/[0.1] transition-colors"
                >
                  <Plus className="w-4 h-4 flex-shrink-0" />
                  <span>New Campaign</span>
                </button>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="w-7 h-7 flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
                  title="Collapse sidebar"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
              <CampaignList
                campaigns={campaigns}
                selectedId={selectedId}
                onSelect={handleSelectCampaign}
                onDelete={handleDeleteCampaign}
                formatDate={formatDate}
              />
            </aside>
          )}

          {sidebarCollapsed && (
            <div className="hidden md:flex shrink-0">
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="h-full w-8 bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.1] transition-colors"
                title="Expand sidebar"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Center panel — Tabbed main view */}
          <div className="flex-1 flex flex-col min-h-0 bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 overflow-hidden">
            {/* Center panel header — tabs */}
            <div className="shrink-0 px-5 border-b border-white/[0.06] flex items-center justify-between">
              {/* Tab bar */}
              <div className="flex items-end h-full gap-0">
                {(['workflow', 'criteria', 'dataset', 'logs'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "font-mono text-[10px] uppercase tracking-wide px-4 py-3 border-b-2 transition-colors",
                      activeTab === tab
                        ? "text-white/80 border-white/40"
                        : "text-white/30 border-transparent hover:text-white/50"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              {/* Right controls */}
              <button
                onClick={() => setRightPanelHidden((v) => !v)}
                className="hidden md:flex items-center gap-1.5 text-white/30 hover:text-white/60 hover:bg-white/[0.04] px-2 py-1 transition-colors"
                title={rightPanelHidden ? "Show chat" : "Hide chat"}
              >
                <span className="font-mono text-[9px] uppercase tracking-wide">
                  {rightPanelHidden ? "Show Chat" : "Hide Chat"}
                </span>
                <ChevronRight
                  className={cn(
                    "w-3.5 h-3.5 transition-transform",
                    rightPanelHidden && "rotate-180"
                  )}
                />
              </button>
            </div>

            {/* Scoring status message */}
            {scoringMsg && (
              <div className={cn(
                'shrink-0 px-5 py-2 border-b border-white/[0.04] font-mono text-[10px]',
                scoringMsg.startsWith('✓')
                  ? 'text-emerald-400 bg-emerald-900/10'
                  : scoringMsg.startsWith('Error')
                  ? 'text-red-400 bg-red-900/10'
                  : 'text-blue-400 bg-blue-900/10'
              )}>
                {scoring && <Loader2 className="w-3 h-3 animate-spin inline mr-1.5" />}
                {scoringMsg}
              </div>
            )}

            {/* Center panel body — tab content */}
            {selectedCampaign ? (
              <div className="flex-1 overflow-y-auto" style={{ transform: 'translateZ(0)' }}>

                {/* ── Workflow tab ── */}
                {activeTab === 'workflow' && (
                  <WorkflowTabContent
                    workflows={workflows}
                    loading={workflowsLoading}
                    campaignSelected={!!selectedCampaign}
                    onStartBrainDump={() => {
                      window.dispatchEvent(
                        new CustomEvent('outreach:fill-chat', {
                          detail: { text: 'Let me tell you how I find leads for this campaign' },
                        })
                      );
                    }}
                  />
                )}

                {/* ── Criteria tab ── */}
                {activeTab === 'criteria' && (
                  <div className="px-4 py-4">
                    <CriteriaPanel
                      campaignId={selectedId}
                      refreshKey={criteriaRefreshKey}
                    />
                  </div>
                )}

                {/* ── Dataset tab ── */}
                {activeTab === 'dataset' && (
                  <div className="flex flex-col">
                    {/* Score Leads button */}
                    {(selectedCampaign.status === 'active' || selectedCampaign.status === 'scanning') &&
                      dataset &&
                      hasCriteria && (
                        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-end">
                          <button
                            onClick={handleScoreLeads}
                            disabled={scoring}
                            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide px-3 py-1.5 bg-blue-900/30 border border-blue-800/40 text-blue-400 hover:bg-blue-900/50 transition-colors disabled:opacity-50"
                          >
                            {scoring ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <BarChart2 className="w-3 h-3" />
                            )}
                            {scoring ? 'Scoring…' : 'Score Leads'}
                          </button>
                        </div>
                      )}

                    {/* Enrichment Status Card */}
                    {dataset && (
                      <EnrichmentStatusCard
                        dataset={dataset}
                        onStartEnrichment={() => {
                          // Fire a custom event to fill the chat input
                          window.dispatchEvent(
                            new CustomEvent('outreach:fill-chat', {
                              detail: { text: 'Enrich the remaining leads in the dataset' },
                            })
                          );
                          // Switch to workflow tab so user can see the chat panel or prompt them
                          setActiveTab('workflow');
                        }}
                      />
                    )}

                    {/* Dataset preview */}
                    {dataset ? (
                      <div className="px-4 py-4 border-b border-white/[0.08]">
                        <DatasetPreview dataset={dataset} />
                      </div>
                    ) : (
                      <div className="px-5 py-8 text-center">
                        <p className="font-mono text-[10px] uppercase tracking-wide text-white/20">
                          No dataset connected. Use the chat to connect a CSV or Google Sheet.
                        </p>
                      </div>
                    )}

                    {/* Discovery stats bar — shown when agent-discovered leads exist */}
                    <DiscoveryStatsBar
                      campaignId={selectedCampaign.id}
                      refreshKey={leadsRefreshKey}
                    />

                    {/* Leads panel */}
                    <div className="px-4 pb-6 pt-4">
                      <LeadsPanel
                        campaignId={selectedCampaign.id}
                        refreshKey={leadsRefreshKey}
                        onDraftMessages={() => setShowTemplateModal(true)}
                      />
                    </div>
                  </div>
                )}

                {/* ── Logs tab ── */}
                {activeTab === 'logs' && selectedCampaign && (
                  <CampaignLogsPanel campaignId={selectedCampaign.id} isActive={activeTab === 'logs'} />
                )}

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center px-8">
                <div className="w-10 h-10 bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
                  <Target className="w-5 h-5 text-white/20" />
                </div>
                <p className="text-sm text-white/40 mb-1">
                  Select or create a campaign to start
                </p>
                <p className="font-mono text-[10px] uppercase tracking-wide text-white/20 mt-1">
                  Campaigns help you find and reach your ideal leads
                </p>
                <button
                  onClick={() => setShowNewModal(true)}
                  className="mt-5 flex items-center gap-1.5 px-4 py-2 border border-white/[0.1] text-white/40 hover:text-white/70 hover:bg-white/[0.04] hover:border-white/[0.2] transition-colors mx-auto font-mono text-[10px] uppercase tracking-wide"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Campaign
                </button>
              </div>
            )}
          </div>

          {/* Right panel — Chat */}
          {!rightPanelHidden && (
            <aside className="hidden md:flex shrink-0 w-96 bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 flex-col overflow-hidden">
              <div className="shrink-0 px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wide text-white/40">
                  Chat
                </span>
                <button
                  onClick={() => setRightPanelHidden(true)}
                  className="w-6 h-6 flex items-center justify-center text-white/20 hover:text-white/60 transition-colors"
                  title="Hide chat"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div style={{ flex: '1 1 0%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {selectedCampaign ? (
                  <OutreachChat
                    key={selectedCampaign.id}
                    campaign={selectedCampaign}
                    onConversationCreated={handleConversationCreated}
                    onMessagesChange={setMessageCount}
                    onCriteriaRefresh={handleCriteriaRefresh}
                    hasCriteria={hasCriteria}
                    dataset={dataset}
                    scanning={scanning}
                    scanReport={scanReport}
                    onDatasetConnected={handleDatasetConnected}
                    onScanTriggered={handleScanTriggered}
                    onScanReportDismissed={() => setScanReport(null)}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center px-4">
                    <p className="text-xs text-white/25 text-center leading-relaxed">
                      Select a campaign to chat with your outreach agent.
                    </p>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      {showNewModal && (
        <NewCampaignModal
          onClose={() => setShowNewModal(false)}
          onCreated={handleCampaignCreated}
        />
      )}

      {showTemplateModal && selectedCampaign && (
        <TemplateEditorModal
          campaignId={selectedCampaign.id}
          onClose={() => setShowTemplateModal(false)}
          onDrafted={(count) => {
            setScoringMsg(`✓ ${count} draft messages generated`);
            setLeadsRefreshKey((k) => k + 1);
            setTimeout(() => setScoringMsg(''), 5000);
          }}
        />
      )}

      {showRefinementModal && selectedCampaign && (
        <RefinementModal
          campaignId={selectedCampaign.id}
          onClose={() => setShowRefinementModal(false)}
          onConfirmed={() => {
            setCriteriaRefreshKey((k) => k + 1);
            setLeadsRefreshKey((k) => k + 1);
            setScoringMsg('✓ Criteria refined and leads re-scored');
            setTimeout(() => setScoringMsg(''), 5000);
          }}
        />
      )}
    </>
  );
}

// ─── Campaign list ────────────────────────────────────────────────────────────

interface CampaignListProps {
  campaigns: Campaign[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  formatDate: (iso: string) => string;
}

function CampaignList({
  campaigns,
  selectedId,
  onSelect,
  onDelete,
  formatDate,
}: CampaignListProps) {
  if (campaigns.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 text-center">
        <div className="w-8 h-8 bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3">
          <Target className="w-4 h-4 text-white/15" />
        </div>
        <p className="text-xs text-white/30 leading-relaxed">
          No campaigns yet.
          <br />
          Create one to start finding leads.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-1" style={{ transform: 'translateZ(0)' }}>
      {campaigns.map((campaign) => {
        const isActive = campaign.id === selectedId;
        return (
          <button
            key={campaign.id}
            onClick={() => onSelect(campaign.id)}
            className={cn(
              "w-full text-left px-3 py-3 transition-colors group relative",
              isActive
                ? "bg-white/[0.08] border-l-2 border-l-emerald-800"
                : "hover:bg-white/[0.04] border-l-2 border-l-transparent"
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span
                className={cn(
                  "text-sm leading-tight truncate",
                  isActive ? "text-white/90 font-medium" : "text-white/60"
                )}
              >
                {campaign.name}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <StatusBadge status={campaign.status} />
                <button
                  onClick={(e) => onDelete(campaign.id, e)}
                  className="w-5 h-5 flex items-center justify-center text-white/20 hover:text-red-400/70 opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete campaign"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="font-mono text-[9px] uppercase tracking-wide text-white/25">
              {formatDate(campaign.created_at)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
