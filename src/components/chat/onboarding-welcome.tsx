"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface OnboardingWelcomeAnimationProps {
  userName: string;
  agentName: string;
  onComplete: () => void;
}

export function OnboardingWelcomeAnimation({
  userName,
  agentName,
  onComplete,
}: OnboardingWelcomeAnimationProps) {
  const [phase, setPhase] = useState<"entering" | "visible" | "exiting">("entering");
  const [typedText, setTypedText] = useState("");
  
  const fullText = `I'm ${agentName} and you're ${userName}. I'm excited to be your personal helper!`;

  useEffect(() => {
    // Start typing after fade in
    const enterTimer = setTimeout(() => {
      setPhase("visible");
    }, 300);

    return () => clearTimeout(enterTimer);
  }, []);

  useEffect(() => {
    if (phase !== "visible") return;

    let idx = 0;
    const typeInterval = setInterval(() => {
      if (idx < fullText.length) {
        setTypedText(fullText.slice(0, idx + 1));
        idx++;
      } else {
        clearInterval(typeInterval);
        // Auto-progress after typing complete + pause
        setTimeout(() => {
          setPhase("exiting");
          setTimeout(onComplete, 300);
        }, 1500);
      }
    }, 35);

    return () => clearInterval(typeInterval);
  }, [phase, fullText, onComplete]);

  return (
    <div
      className={cn(
        "border border-[rgba(58,58,56,0.2)] rounded-none bg-white p-6 max-w-md transition-all duration-300",
        phase === "entering" && "opacity-0 translate-y-2",
        phase === "visible" && "opacity-100 translate-y-0",
        phase === "exiting" && "opacity-0 -translate-y-2"
      )}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 border border-[rgba(58,58,56,0.2)] flex items-center justify-center text-lg">
          👋
        </div>
        <div className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
          Welcome
        </div>
      </div>

      <p className="text-sm text-forest leading-relaxed min-h-[3em]">
        {typedText}
        {phase === "visible" && typedText.length < fullText.length && (
          <span className="inline-block w-0.5 h-4 bg-forest ml-0.5 animate-pulse" />
        )}
      </p>

      <div className="mt-4 flex justify-end">
        <span className="font-mono text-[9px] text-grid/40">
          {typedText.length < fullText.length ? "typing..." : "ready"}
        </span>
      </div>
    </div>
  );
}
