"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: string;
  copyable?: boolean;
  className?: string;
}

export function CodeBlock({ code, language, copyable = true, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("relative group", className)}>
      <pre
        className={cn(
          "bg-forest text-mint p-4 font-mono text-sm overflow-x-auto rounded-none",
          "border border-forest/20"
        )}
      >
        {language && (
          <span className="absolute top-2 left-3 text-[10px] uppercase tracking-wide text-mint/50">
            {language}
          </span>
        )}
        <code className={language ? "block mt-4" : ""}>{code}</code>
      </pre>
      
      {copyable && (
        <button
          onClick={handleCopy}
          className={cn(
            "absolute top-2 right-2 px-2 py-1",
            "font-mono text-[10px] uppercase tracking-wide",
            "border border-mint/30 rounded-none transition-all",
            copied
              ? "bg-mint text-forest"
              : "bg-transparent text-mint/70 hover:bg-mint/10 hover:text-mint"
          )}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      )}
    </div>
  );
}
