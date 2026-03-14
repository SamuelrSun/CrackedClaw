"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Loader2 } from "lucide-react";

type ExportType = "conversations" | "memory" | "workflows";
type ExportFormat = "json" | "markdown";

interface ExportCounts {
  conversations?: number;
  memory?: number;
  workflows?: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function ExportCard() {
  // Export options
  const [selectedTypes, setSelectedTypes] = useState<ExportType[]>([
    "conversations",
    "memory",
    "workflows",
  ]);
  const [format, setFormat] = useState<ExportFormat>("json");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // State
  const [counts, setCounts] = useState<ExportCounts>({});
  const [estimatedSize, setEstimatedSize] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch export metadata
  const fetchMetadata = useCallback(async () => {
    if (selectedTypes.length === 0) {
      setCounts({});
      setEstimatedSize(0);
      setLoadingMeta(false);
      return;
    }

    setLoadingMeta(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          types: selectedTypes,
          from: fromDate || undefined,
          to: toDate || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCounts(data.counts);
        setEstimatedSize(data.estimatedSize);
      }
    } catch (err) {
      console.error("Failed to fetch export metadata:", err);
    } finally {
      setLoadingMeta(false);
    }
  }, [selectedTypes, fromDate, toDate]);

  useEffect(() => {
    const timeout = setTimeout(fetchMetadata, 300);
    return () => clearTimeout(timeout);
  }, [fetchMetadata]);

  // Toggle export type
  const toggleType = (type: ExportType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
    setSuccess(null);
    setError(null);
  };

  // Handle export
  const handleExport = async () => {
    if (selectedTypes.length === 0) {
      setError("Please select at least one data type to export");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const isAllSelected = selectedTypes.length === 3;
      const type = isAllSelected ? "all" : selectedTypes[0];
      
      const params = new URLSearchParams({
        type,
        format,
        ...(fromDate && { from: fromDate }),
        ...(toDate && { to: toDate }),
      });

      const res = await fetch(`/api/export?${params}`);

      if (!res.ok) {
        throw new Error("Export failed");
      }

      // Get filename from header or generate one
      const contentDisposition = res.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `openclaw-export-${new Date().toISOString().split("T")[0]}.${format === "markdown" ? "md" : "json"}`;

      // Download file
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess(`Export downloaded: ${filename}`);
    } catch (err) {
      console.error("Export error:", err);
      setError("Failed to export data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const totalItems =
    (counts.conversations || 0) + (counts.memory || 0) + (counts.workflows || 0);

  return (
    <Card label="Export Data" accentColor="#9EFFBF" bordered={false}>
      <div className="mt-2 space-y-6">
        {/* Description */}
        <p className="font-mono text-[11px] text-grid/60">
          Export your conversations, memory entries, and workflows for backup or analysis.
        </p>

        {/* Data Selection */}
        <div className="space-y-3">
          <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50 block">
            Select Data to Export
          </span>
          <div className="space-y-2">
            <Checkbox
              checked={selectedTypes.includes("conversations")}
              onChange={() => toggleType("conversations")}
              label="Conversations"
              description={
                loadingMeta
                  ? "Loading..."
                  : `${counts.conversations || 0} conversation${(counts.conversations || 0) !== 1 ? "s" : ""}`
              }
            />
            <Checkbox
              checked={selectedTypes.includes("memory")}
              onChange={() => toggleType("memory")}
              label="Memory Entries"
              description={
                loadingMeta
                  ? "Loading..."
                  : `${counts.memory || 0} entr${(counts.memory || 0) !== 1 ? "ies" : "y"}`
              }
            />
            <Checkbox
              checked={selectedTypes.includes("workflows")}
              onChange={() => toggleType("workflows")}
              label="Workflows"
              description={
                loadingMeta
                  ? "Loading..."
                  : `${counts.workflows || 0} workflow${(counts.workflows || 0) !== 1 ? "s" : ""}`
              }
            />
          </div>
        </div>

        {/* Format Selection */}
        <div className="space-y-3">
          <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50 block">
            Export Format
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setFormat("json")}
              className={`px-3 py-1.5 border border-white/[0.1] rounded-none font-mono text-[10px] uppercase tracking-wide transition-colors ${
                format === "json"
                  ? "bg-forest text-white"
                  : "bg-white text-forest hover:bg-forest/5"
              }`}
            >
              JSON
            </button>
            <button
              onClick={() => setFormat("markdown")}
              className={`px-3 py-1.5 border border-white/[0.1] rounded-none font-mono text-[10px] uppercase tracking-wide transition-colors ${
                format === "markdown"
                  ? "bg-forest text-white"
                  : "bg-white text-forest hover:bg-forest/5"
              }`}
            >
              Markdown
            </button>
          </div>
          <p className="font-mono text-[10px] text-grid/40">
            {format === "json"
              ? "JSON format is best for backups and importing."
              : "Markdown is human-readable and great for documentation."}
          </p>
        </div>

        {/* Date Range (Optional) */}
        <div className="space-y-3">
          <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50 block">
            Date Range (Optional)
          </span>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wide text-grid/40">
                From
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full bg-white border border-white/[0.1] rounded-none px-3 py-2 font-mono text-[11px] text-forest outline-none focus:border-forest"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wide text-grid/40">
                To
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full bg-white border border-white/[0.1] rounded-none px-3 py-2 font-mono text-[11px] text-forest outline-none focus:border-forest"
              />
            </div>
          </div>
        </div>

        {/* Estimated Size */}
        {estimatedSize > 0 && (
          <div className="p-3 border border-white/[0.08] bg-forest/5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-grid/60">
                Estimated export size
              </span>
              <span className="font-mono text-[11px] font-bold text-forest">
                {formatBytes(estimatedSize)}
              </span>
            </div>
            <div className="font-mono text-[10px] text-grid/40 mt-1">
              {totalItems} item{totalItems !== 1 ? "s" : ""} selected
            </div>
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className="p-3 border border-coral bg-coral/10">
            <span className="font-mono text-[11px] text-coral">{error}</span>
          </div>
        )}
        {success && (
          <div className="p-3 border border-mint bg-mint/10">
            <span className="font-mono text-[11px] text-forest">{success}</span>
          </div>
        )}

        {/* Export Button */}
        <Button
          variant="solid"
          size="md"
          onClick={handleExport}
          disabled={loading || selectedTypes.length === 0}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Download Export
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
