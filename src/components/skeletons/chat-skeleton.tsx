"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ChatSkeletonProps {
  className?: string;
  messages?: number;
}

// Deterministic widths/lines based on index (no Math.random)
const CHAT_CONFIGS = [
  { width: 55, lines: 2 },
  { width: 65, lines: 1 },
  { width: 50, lines: 2 },
  { width: 70, lines: 1 },
  { width: 60, lines: 2 },
  { width: 48, lines: 1 },
  { width: 62, lines: 2 },
  { width: 58, lines: 1 },
];

export function ChatSkeleton({ className, messages = 4 }: ChatSkeletonProps) {
  return (
    <div className={cn("space-y-4 p-6", className)}>
      {Array.from({ length: messages }).map((_, i) => {
        const config = CHAT_CONFIGS[i % CHAT_CONFIGS.length];
        return (
          <ChatMessageSkeleton
            key={i}
            isUser={i % 2 === 0}
            width={config.width}
            lines={config.lines}
          />
        );
      })}
    </div>
  );
}

interface ChatMessageSkeletonProps {
  isUser?: boolean;
  width?: number;
  lines?: number;
}

export function ChatMessageSkeleton({
  isUser = false,
  width = 60,
  lines = 2,
}: ChatMessageSkeletonProps) {
  return (
    <div
      className={cn("max-w-[70%]", isUser ? "ml-auto" : "mr-auto")}
      style={{ width: `${width}%` }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Skeleton className="h-2.5 w-12" />
        <Skeleton className="h-2 w-10" />
      </div>

      {/* Message bubble */}
      <div
        className={cn(
          "border border-[rgba(58,58,56,0.2)] p-4",
          isUser ? "bg-forest/10" : "bg-white"
        )}
      >
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-3"
              style={{
                width: i === lines - 1 && lines > 1 ? "70%" : "100%",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Typing indicator skeleton
export function TypingIndicatorSkeleton() {
  return (
    <div className="max-w-[70%] mr-auto">
      <div className="flex items-center gap-2 mb-1">
        <Skeleton className="h-2.5 w-16" />
      </div>
      <div className="border border-[rgba(58,58,56,0.2)] p-4 bg-white">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-[#E5E5E3] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 bg-[#E5E5E3] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 bg-[#E5E5E3] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
