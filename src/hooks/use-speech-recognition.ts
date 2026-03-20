"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

/**
 * Long-form dictation speech recognition hook.
 * 
 * Design principles:
 * - Accumulates everything — final transcript builds up continuously
 * - Auto-restarts on session end (browser limits ~60s per session)
 * - No silence timer that kills the session — user controls when to stop
 * - Clean separation of final vs interim text
 * - Robust error recovery
 */
export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");           // accumulated final text
  const [interimTranscript, setInterimTranscript] = useState(""); // current in-progress fragment
  const [error, setError] = useState<string | null>(null);

  // Refs for use in event handlers (avoid stale closures)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTranscriptRef = useRef("");          // accumulated final text
  const isListeningRef = useRef(false);           // ref version for event handlers
  const shouldRestartRef = useRef(false);         // controls auto-restart behavior
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartAttemptRef = useRef(0);            // track restart attempts for backoff

  const isSupported =
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    // Clear any pending restart
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    setError(null);

    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      isListeningRef.current = true;
      restartAttemptRef.current = 0; // reset on successful start
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let newFinal = "";

      // Process results from resultIndex onwards
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        
        if (result.isFinal) {
          // Append to accumulated final text
          newFinal += text;
        } else {
          // This is interim (in-progress) text
          interim += text;
        }
      }

      // If we have new final text, append it
      if (newFinal) {
        const trimmedNew = newFinal.trim();
        if (trimmedNew) {
          finalTranscriptRef.current = finalTranscriptRef.current
            ? finalTranscriptRef.current + " " + trimmedNew
            : trimmedNew;
          setTranscript(finalTranscriptRef.current);
        }
      }

      // Always update interim transcript (shows what's currently being spoken)
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Handle different error types
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        // Permission error — stop and show error, don't restart
        setError("Microphone access denied. Please allow microphone access and try again.");
        shouldRestartRef.current = false;
        isListeningRef.current = false;
        setIsListening(false);
        return;
      }

      if (event.error === "no-speech") {
        // No speech detected — this is NORMAL during pauses
        // Don't show error, just let onend handle restart
        return;
      }

      if (event.error === "aborted") {
        // Aborted — restart if we should
        if (shouldRestartRef.current && isListeningRef.current) {
          scheduleRestart();
        }
        return;
      }

      if (event.error === "network") {
        // Network error — try to restart with backoff
        if (shouldRestartRef.current && restartAttemptRef.current < 3) {
          scheduleRestart();
        } else {
          setError("Network error. Please check your connection.");
          shouldRestartRef.current = false;
          isListeningRef.current = false;
          setIsListening(false);
        }
        return;
      }

      // Other errors — try to restart once, then stop
      if (shouldRestartRef.current && restartAttemptRef.current < 2) {
        scheduleRestart();
      } else {
        setError("Speech recognition error: " + event.error);
        shouldRestartRef.current = false;
        isListeningRef.current = false;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Browser ended the session (happens every ~60s in Chrome)
      // If we should still be listening, restart seamlessly
      if (shouldRestartRef.current && isListeningRef.current) {
        scheduleRestart();
      } else {
        setIsListening(false);
        isListeningRef.current = false;
        setInterimTranscript(""); // clear interim on stop
      }
    };

    const scheduleRestart = () => {
      // Debounce restart to prevent rapid cycling
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }

      // Exponential backoff: 100ms, 200ms, 400ms, etc.
      const delay = Math.min(100 * Math.pow(2, restartAttemptRef.current), 2000);
      restartAttemptRef.current++;

      restartTimeoutRef.current = setTimeout(() => {
        if (shouldRestartRef.current && isListeningRef.current) {
          try {
            recognitionRef.current?.start();
          } catch {
            // If start fails, try creating a new instance
            startListening();
          }
        }
      }, delay);
    };

    recognitionRef.current = recognition;
    shouldRestartRef.current = true;
    isListeningRef.current = true;

    try {
      recognition.start();
    } catch {
      setError("Failed to start speech recognition.");
      setIsListening(false);
      isListeningRef.current = false;
      shouldRestartRef.current = false;
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    // Prevent auto-restart
    shouldRestartRef.current = false;
    isListeningRef.current = false;

    // Clear any pending restart
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    // Stop recognition
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimTranscript(""); // clear interim, keep final
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    finalTranscriptRef.current = "";
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      isListeningRef.current = false;
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      recognitionRef.current?.abort();
    };
  }, []);

  // Convenience: full text combines final + interim
  const fullText = useMemo(() => {
    if (!transcript && !interimTranscript) return "";
    if (!interimTranscript) return transcript;
    if (!transcript) return interimTranscript;
    return transcript + " " + interimTranscript;
  }, [transcript, interimTranscript]);

  // Word count helper
  const wordCount = useMemo(() => {
    const text = fullText.trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  }, [fullText]);

  return {
    isListening,
    transcript,              // accumulated final text (everything said so far)
    interimTranscript,       // current in-progress words (not yet finalized)
    fullText,                // convenience: transcript + " " + interimTranscript (trimmed)
    wordCount,               // convenience: word count of fullText
    isSupported,
    startListening,
    stopListening,
    clearTranscript,
    error,
  };
}
