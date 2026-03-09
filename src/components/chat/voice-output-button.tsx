"use client";

import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { cn } from "@/lib/utils";

interface VoiceOutputButtonProps {
  text: string;
  className?: string;
}

export function VoiceOutputButton({ text, className }: VoiceOutputButtonProps) {
  const { isSpeaking, isSupported, speak, stop } = useSpeechSynthesis();

  if (!isSupported) return null;

  const handleClick = () => {
    if (isSpeaking) {
      stop();
    } else {
      speak(text);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={isSpeaking ? "Stop playback" : "Read aloud"}
      aria-label={isSpeaking ? "Stop reading" : "Read message aloud"}
      className={cn(
        "inline-flex items-center justify-center w-6 h-6 transition-all duration-150 rounded-none",
        "text-grid/30 hover:text-forest opacity-0 group-hover:opacity-100",
        isSpeaking && "opacity-100 text-forest",
        className
      )}
    >
      {isSpeaking ? (
        // Animated speaker waves
        <span className="flex items-center gap-[1.5px]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3.5 h-3.5"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" className="animate-pulse" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" className="animate-pulse" style={{ animationDelay: "0.15s" }} />
          </svg>
        </span>
      ) : (
        // Static speaker icon
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-3.5 h-3.5"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      )}
    </button>
  );
}
