"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ToolCallDetailProps {
  tool: string;
  input?: Record<string, unknown>;
  result?: string;
}

function formatInputAsYaml(input: Record<string, unknown>): string {
  return Object.entries(input)
    .map(([key, value]) => {
      if (typeof value === "object" && value !== null) {
        return `${key}: ${JSON.stringify(value, null, 2)}`;
      }
      return `${key}: ${value}`;
    })
    .join("\n");
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy to clipboard"
      className={cn(
        "absolute top-2 right-2 text-sm transition-colors border-0 bg-transparent p-0.5 cursor-pointer",
        copied ? "text-forest" : "text-grid/30 hover:text-forest"
      )}
    >
      {copied ? "✓" : "📋"}
    </button>
  );
}

function CodeBlock({ content }: { content: string }) {
  return (
    <div className="relative">
      <pre
        className={cn(
          "bg-grid/[0.06] p-3 font-mono text-[12px] text-grid/70",
          "whitespace-pre-wrap overflow-x-auto border border-[rgba(58,58,56,0.1)]"
        )}
      >
        {content}
      </pre>
      <CopyButton text={content} />
    </div>
  );
}

const RESULT_MAX_CHARS = 500;

export function ToolCallDetail({ tool, input, result }: ToolCallDetailProps) {
  const inputText = input ? formatInputAsYaml(input) : "";
  const resultText =
    result && result.length > RESULT_MAX_CHARS
      ? result.slice(0, RESULT_MAX_CHARS) + "... (truncated)"
      : result ?? "";

  return (
    <div className="space-y-3 mt-2">
      <div className="font-mono text-[10px] uppercase tracking-wide text-grid/40 mb-0.5">
        {tool}
      </div>

      {input && Object.keys(input).length > 0 && (
        <div className="space-y-1">
          <div className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
            Arguments:
          </div>
          <CodeBlock content={inputText} />
        </div>
      )}

      {result !== undefined && (
        <div className="space-y-1">
          <div className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
            Result:
          </div>
          <CodeBlock content={resultText} />
        </div>
      )}
    </div>
  );
}
