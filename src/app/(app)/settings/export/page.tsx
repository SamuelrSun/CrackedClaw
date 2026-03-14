"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Download, FileJson, FileText, Loader2 } from "lucide-react";

type ExportFormat = "json" | "csv";

interface ExportOption {
  id: string;
  label: string;
  description: string;
  icon: typeof FileJson;
  formats: ExportFormat[];
}

const exportOptions: ExportOption[] = [
  {
    id: "workflows",
    label: "Workflows",
    description: "Export all workflow configurations",
    icon: FileJson,
    formats: ["json"],
  },
  {
    id: "activity",
    label: "Activity Log",
    description: "Export your activity history",
    icon: FileText,
    formats: ["json", "csv"],
  },
  {
    id: "memory",
    label: "Memory",
    description: "Export stored memory data",
    icon: FileJson,
    formats: ["json"],
  },
  {
    id: "settings",
    label: "Settings",
    description: "Export account and integration settings",
    icon: FileJson,
    formats: ["json"],
  },
];

export default function ExportPage() {
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (optionId: string, format: ExportFormat) => {
    setExporting(`${optionId}-${format}`);
    
    try {
      // Simulate export - in real implementation, this would call the API
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      // Mock download
      const blob = new Blob([JSON.stringify({ export: optionId, format, timestamp: new Date().toISOString() }, null, 2)], {
        type: format === "json" ? "application/json" : "text/csv",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `openclaw-${optionId}-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Breadcrumbs 
        items={[
          { label: "Home", href: "/" },
          { label: "Settings", href: "/settings" },
          { label: "Export" },
        ]} 
      />

      <div className="mb-8">
        <h1 className="font-header text-3xl font-bold tracking-tight leading-tight text-forest">
          Export Data
        </h1>
        <p className="font-mono text-[11px] text-grid/60 mt-2">
          Download your data in various formats for backup or migration.
        </p>
      </div>

      <div className="space-y-4">
        {exportOptions.map((option) => {
          const Icon = option.icon;
          
          return (
            <Card key={option.id} className="p-0">
              <div className="flex items-start gap-4 p-4">
                <div className="w-10 h-10 border border-white/[0.1] flex items-center justify-center flex-shrink-0">
                  <Icon size={20} className="text-forest" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-header text-lg font-bold text-forest">
                    {option.label}
                  </h3>
                  <p className="font-mono text-[11px] text-grid/60 mt-1">
                    {option.description}
                  </p>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  {option.formats.map((format) => {
                    const isExporting = exporting === `${option.id}-${format}`;
                    
                    return (
                      <Button
                        key={format}
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExport(option.id, format)}
                        disabled={exporting !== null}
                      >
                        {isExporting ? (
                          <Loader2 size={14} className="animate-spin mr-1" />
                        ) : (
                          <Download size={14} className="mr-1" />
                        )}
                        {format.toUpperCase()}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card label="Full Backup" accentColor="#9EFFBF" className="mt-8">
        <div className="mt-2">
          <p className="font-mono text-[11px] text-grid/60 mb-4">
            Export all your data as a single ZIP archive containing all exportable content.
          </p>
          <Button
            variant="solid"
            onClick={() => handleExport("all", "json")}
            disabled={exporting !== null}
          >
            {exporting === "all-json" ? (
              <Loader2 size={14} className="animate-spin mr-1" />
            ) : (
              <Download size={14} className="mr-1" />
            )}
            Download Full Backup
          </Button>
        </div>
      </Card>
    </div>
  );
}
