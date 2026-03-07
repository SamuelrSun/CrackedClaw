"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Play, AlertCircle } from "lucide-react";

interface RunButtonProps {
  workflowId: string;
  workflowName: string;
  disabled?: boolean;
  lastRun?: string;
  onSuccess?: (response: string) => void;
  onError?: (error: string) => void;
}

export function RunButton({
  workflowId,
  workflowName,
  disabled = false,
  lastRun,
  onSuccess,
  onError,
}: RunButtonProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setIsRunning(true);
    setError(null);

    try {
      const response = await fetch(`/api/workflows/${workflowId}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || "Failed to run workflow";
        setError(errorMessage);
        onError?.(errorMessage);
        return;
      }

      if (data.success) {
        onSuccess?.(data.run?.response || "Workflow completed successfully");
      } else {
        const errorMessage = data.run?.error || "Workflow execution failed";
        setError(errorMessage);
        onError?.(errorMessage);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to run workflow";
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="solid"
        size="sm"
        onClick={handleRun}
        disabled={disabled || isRunning}
        title={lastRun ? `Last run: ${lastRun}` : "Run this workflow"}
      >
        {isRunning ? (
          <>
            <Loader2 size={12} className="mr-1 animate-spin" />
            Running
          </>
        ) : error ? (
          <>
            <AlertCircle size={12} className="mr-1" />
            Retry
          </>
        ) : (
          <>
            <Play size={12} className="mr-1" />
            Run
          </>
        )}
      </Button>
      {error && (
        <div 
          className="absolute right-0 top-full mt-1 z-10 max-w-xs p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded shadow-sm"
          title={error}
        >
          {error.length > 50 ? `${error.substring(0, 50)}...` : error}
        </div>
      )}
    </div>
  );
}
