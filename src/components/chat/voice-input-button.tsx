"use client";

import { useEffect, useRef } from "react";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { cn } from "@/lib/utils";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInputButton({ onTranscript, disabled }: VoiceInputButtonProps) {
  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    error,
    clearTranscript,
  } = useSpeechRecognition();

  const prevTranscriptRef = useRef("");

  // When transcript finalizes (isListening stops), emit it
  useEffect(() => {
    if (!isListening && transcript && transcript !== prevTranscriptRef.current) {
      prevTranscriptRef.current = transcript;
      onTranscript(transcript);
      clearTranscript();
    }
  }, [isListening, transcript, onTranscript, clearTranscript]);

  // Show interim text while listening (for UX feedback)
  useEffect(() => {
    if (isListening && interimTranscript) {
      // Provide live preview without committing
      onTranscript(interimTranscript);
    }
  }, [interimTranscript, isListening, onTranscript]);

  if (!isSupported) return null;

  const handleClick = () => {
    if (isListening) {
      stopListening();
    } else {
      prevTranscriptRef.current = "";
      startListening();
    }
  };

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={
          error
            ? error
            : isListening
            ? "Click to stop recording"
            : "Click to start voice input"
        }
        aria-label={isListening ? "Stop recording" : "Start voice input"}
        className={cn(
          "relative flex items-center justify-center w-10 h-10 border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
          isListening
            ? "border-red-400 bg-red-50 text-red-500"
            : "border-[rgba(58,58,56,0.2)] bg-white text-grid/60 hover:border-forest hover:text-forest"
        )}
      >
        {/* Pulsing ring when recording */}
        {isListening && (
          <span className="absolute inset-0 rounded-none animate-ping border border-red-400 opacity-40 pointer-events-none" />
        )}

        {isListening ? (
          // Recording: sound wave bars
          <span className="flex items-end gap-[2px] h-4">
            {[1, 2, 3, 4, 3].map((h, i) => (
              <span
                key={i}
                className="w-[2px] bg-red-500 rounded-full"
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

      {/* Error tooltip */}
      {error && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 bg-red-50 border border-red-200 text-red-700 text-xs px-2 py-1.5 rounded shadow-sm z-50 pointer-events-none">
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
