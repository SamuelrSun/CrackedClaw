"use client";
import { useMemo } from "react";

interface NarrationLineProps {
  text: string;
}

export function NarrationLine({ text }: NarrationLineProps) {
  const lastSentence = useMemo(() => {
    if (!text) return "";
    // Split on sentence boundaries, take the last meaningful one
    const sentences = text.split(/(?<=[.!?:…])\s+|\n+/).filter(s => s.trim().length > 5);
    return sentences[sentences.length - 1]?.trim() || text.trim().slice(-100);
  }, [text]);

  if (!lastSentence) return null;

  return (
    <p className="font-mono text-[12px] text-white/30 italic transition-all duration-300 ease-in-out">
      {lastSentence}
    </p>
  );
}
