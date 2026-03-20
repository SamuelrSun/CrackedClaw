"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { cn } from "@/lib/utils";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;  // called with FULL accumulated text when stopped
  onInterimUpdate?: (fullText: string) => void;  // optional: live preview updates
  disabled?: boolean;
  variant?: 'default' | 'outreach';  // outreach variant for dark theme
  className?: string;
}

export function VoiceInputButton({ 
  onTranscript, 
  onInterimUpdate,
  disabled,
  variant = 'default',
  className,
}: VoiceInputButtonProps) {
  const {
    isListening,
    transcript,
    interimTranscript,
    fullText,
    wordCount,
    isSupported,
    startListening,
    stopListening,
    clearTranscript,
    error,
  } = useSpeechRecognition();

  const prevFullTextRef = useRef("");

  // Live preview updates (optional) — only call if text actually changed
  useEffect(() => {
    if (isListening && onInterimUpdate && fullText !== prevFullTextRef.current) {
      prevFullTextRef.current = fullText;
      onInterimUpdate(fullText);
    }
  }, [isListening, fullText, onInterimUpdate]);

  // When user stops recording, emit the full transcript
  const handleStop = useCallback(() => {
    stopListening();
    const finalText = fullText.trim();
    if (finalText) {
      onTranscript(finalText);
    }
    // Clear for next recording session
    setTimeout(() => {
      clearTranscript();
      prevFullTextRef.current = "";
    }, 100);
  }, [stopListening, fullText, onTranscript, clearTranscript]);

  const handleClick = () => {
    if (isListening) {
      handleStop();
    } else {
      clearTranscript();
      prevFullTextRef.current = "";
      startListening();
    }
  };

  if (!isSupported) return null;

  const isOutreach = variant === 'outreach';

  return (
    <div className={cn("relative group", className)}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={
          error
            ? error
            : isListening
            ? `Recording... (${wordCount} words) — Click to stop`
            : "Click to start voice input"
        }
        aria-label={isListening ? "Stop recording" : "Start voice input"}
        className={cn(
          "relative flex items-center justify-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
          // Size
          "w-10 h-10",
          // Variant-specific styles
          isOutreach ? (
            isListening
              ? "border border-red-500/50 bg-red-900/20 text-red-400"
              : "border border-white/[0.1] bg-white/[0.04] text-white/40 hover:text-white/70 hover:border-white/[0.2]"
          ) : (
            isListening
              ? "border border-red-400 bg-red-50 text-red-500"
              : "border border-white/[0.1] bg-white text-grid/60 hover:border-forest hover:text-forest"
          )
        )}
      >
        {/* Pulsing ring when recording */}
        {isListening && (
          <span 
            className={cn(
              "absolute inset-0 rounded-none pointer-events-none",
              isOutreach 
                ? "animate-ping border border-red-500/30 opacity-30"
                : "animate-ping border border-red-400 opacity-40"
            )} 
          />
        )}

        {isListening ? (
          // Recording: sound wave bars
          <span className="flex items-end gap-[2px] h-4">
            {[1, 2, 3, 4, 3].map((h, i) => (
              <span
                key={i}
                className={cn(
                  "w-[2px] rounded-full",
                  isOutreach ? "bg-red-400" : "bg-red-500"
                )}
                style={{
                  height: `${h * 3}px`,
                  animation: `voiceBar 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
                }}
              />
            ))}
          </span>
        ) : (
          // Idle: mic icon (SVG)
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
          >
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="8" y1="22" x2="16" y2="22" />
          </svg>
        )}
      </button>

      {/* Word count badge when recording (outreach variant) */}
      {isListening && isOutreach && wordCount > 0 && (
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="font-mono text-[9px] text-red-400/60">
            {wordCount}w
          </span>
        </div>
      )}

      {/* Error tooltip */}
      {error && (
        <div className={cn(
          "absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 text-xs px-2 py-1.5 rounded shadow-sm z-50 pointer-events-none",
          isOutreach
            ? "bg-red-900/80 border border-red-700/50 text-red-300"
            : "bg-red-50 border border-red-200 text-red-700"
        )}>
          {error}
        </div>
      )}

      <style jsx>{`
        @keyframes voiceBar {
          from { transform: scaleY(0.5); }
          to   { transform: scaleY(1.5); }
        }
      `}</style>
    </div>
  );
}

/**
 * Voice Info Dump Card — prominent voice input for long-form dictation
 * Used in outreach setup when user needs to describe what they're looking for
 */
interface VoiceInfoDumpCardProps {
  onComplete: (text: string) => void;
  onCancel?: () => void;
}

export function VoiceInfoDumpCard({ onComplete, onCancel }: VoiceInfoDumpCardProps) {
  const {
    isListening,
    fullText,
    wordCount,
    isSupported,
    startListening,
    stopListening,
    clearTranscript,
    error,
  } = useSpeechRecognition();

  const startTimeRef = useRef<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);

  // Timer for recording duration
  React.useEffect(() => {
    if (isListening) {
      startTimeRef.current = Date.now();
      const interval = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      startTimeRef.current = null;
      setElapsedSeconds(0);
    }
  }, [isListening]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const handleStart = () => {
    clearTranscript();
    startListening();
  };

  const handleStopAndSend = () => {
    stopListening();
    const finalText = fullText.trim();
    if (finalText) {
      onComplete(finalText);
    }
    clearTranscript();
  };

  const handleCancel = () => {
    stopListening();
    clearTranscript();
    onCancel?.();
  };

  if (!isSupported) {
    return (
      <div className="bg-white/[0.04] border border-white/[0.1] rounded-[3px] p-6 text-center">
        <p className="text-sm text-white/50">
          Voice input is not supported in this browser.
          <br />
          Please use Chrome for the best experience.
        </p>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "bg-white/[0.04] border rounded-[3px] p-6 transition-colors",
        isListening 
          ? "border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]" 
          : "border-white/[0.1]"
      )}
    >
      {!isListening ? (
        // Idle state — prompt to start recording
        <>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🎤</span>
            <span className="font-mono text-[11px] uppercase tracking-wide text-white/70">
              Voice Info Dump
            </span>
          </div>

          <p className="text-sm text-white/60 mb-2">
            Tell us about who you&apos;re looking for.
          </p>
          <p className="text-sm text-white/40 mb-6">
            Speak naturally — we&apos;ll capture everything.
          </p>

          <button
            onClick={handleStart}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white/[0.08] border border-white/[0.15] text-white/70 hover:bg-white/[0.12] hover:text-white/90 transition-colors font-mono text-[11px] uppercase tracking-wide"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="8" y1="22" x2="16" y2="22" />
            </svg>
            Start Recording
          </button>

          <p className="text-center text-xs text-white/30 mt-4">
            Or type in the chat below.
          </p>
        </>
      ) : (
        // Recording state — show live transcript
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="font-mono text-[11px] uppercase tracking-wide text-red-400/70">
                Recording
              </span>
            </div>
            <span className="font-mono text-[11px] text-red-400/70">
              {formatTime(elapsedSeconds)}
            </span>
          </div>

          {/* Live transcript preview */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-[2px] p-4 mb-4 max-h-40 overflow-y-auto">
            {fullText ? (
              <p className="text-sm text-white/60 italic leading-relaxed">
                &quot;{fullText}&quot;
              </p>
            ) : (
              <p className="text-sm text-white/30 italic">
                Listening...
              </p>
            )}
          </div>

          {/* Word count */}
          <p className="font-mono text-[10px] text-white/30 mb-4">
            {wordCount} {wordCount === 1 ? 'word' : 'words'} captured
          </p>

          {/* Error message */}
          {error && (
            <p className="text-xs text-red-400/70 mb-4">
              {error}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="flex-1 py-2.5 border border-white/[0.1] text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-colors font-mono text-[10px] uppercase tracking-wide"
            >
              Cancel
            </button>
            <button
              onClick={handleStopAndSend}
              disabled={!fullText.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-900/30 border border-red-800/40 text-red-400 hover:bg-red-900/50 transition-colors font-mono text-[10px] uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>⏹</span>
              Stop & Send
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Need React for useState in VoiceInfoDumpCard
import React from "react";
