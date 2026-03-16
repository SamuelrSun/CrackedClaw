"use client";

import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

// Strip leading emojis from text (e.g. "🌅 1. Daily Briefing" → "1. Daily Briefing")
// Handles emoji + optional variation selector + optional space after
function stripLeadingEmojis(text: string): string {
  // Match one or more emoji characters (including ZWJ sequences, variation selectors) at the start
  return text.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u{FE0F}\u{20E3}\u{200D}]+\s*/gu, "").trim();
}

// Pre-process markdown to strip leading emojis from headings and list items
function cleanMarkdown(content: string): string {
  return content
    // Strip leading emojis from ATX headings: ## 🌅 Title → ## Title
    .replace(/^(#{1,6}\s*)[\p{Emoji_Presentation}\p{Extended_Pictographic}][\uFE0F\u20E3\u200D\p{Emoji_Presentation}\p{Extended_Pictographic}]*\s*/gmu, "$1")
    // Strip leading emojis from unordered list items: - 🌅 Item → - Item
    .replace(/^(\s*[-*+]\s*)[\p{Emoji_Presentation}\p{Extended_Pictographic}][\uFE0F\u20E3\u200D\p{Emoji_Presentation}\p{Extended_Pictographic}]*\s*/gmu, "$1")
    // Strip leading emojis from ordered list items: 1. 🌅 Item → 1. Item
    .replace(/^(\s*\d+\.\s*)[\p{Emoji_Presentation}\p{Extended_Pictographic}][\uFE0F\u20E3\u200D\p{Emoji_Presentation}\p{Extended_Pictographic}]*\s*/gmu, "$1");
}

// Custom heading components — same font size as body, bold only, no size scaling
const headingComponents: Partial<Components> = {
  h1: ({ children }) => <p className="font-bold text-white/90 mt-3 mb-1">{children}</p>,
  h2: ({ children }) => <p className="font-bold text-white/90 mt-3 mb-1">{children}</p>,
  h3: ({ children }) => <p className="font-semibold text-white/90 mt-2 mb-1">{children}</p>,
  h4: ({ children }) => <p className="font-semibold text-white/80 mt-2 mb-0.5">{children}</p>,
  h5: ({ children }) => <p className="font-semibold text-white/80 mt-2 mb-0.5">{children}</p>,
  h6: ({ children }) => <p className="font-semibold text-white/70 mt-2 mb-0.5">{children}</p>,
};

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  const cleaned = cleanMarkdown(content);

  return (
    <div className={`prose prose-base max-w-none prose-p:my-0 prose-p:mb-3 prose-p:leading-[26px] prose-headings:font-semibold prose-headings:text-white/90 prose-strong:text-white/90 prose-strong:font-semibold prose-code:text-sm prose-code:bg-white/[0.08] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-white/[0.06] prose-pre:rounded-lg prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 text-white/[0.88] prose-h1:text-[13px] prose-h2:text-[13px] prose-h3:text-[13px] prose-h4:text-[13px] prose-h5:text-[13px] prose-h6:text-[13px] prose-h1:font-bold prose-h2:font-bold prose-h3:font-semibold prose-h4:font-semibold prose-h5:font-semibold prose-h6:font-semibold prose-h1:mt-3 prose-h2:mt-3 prose-h3:mt-2 ${className ?? ""}`}>
      <ReactMarkdown components={headingComponents}>{cleaned}</ReactMarkdown>
    </div>
  );
}
