"use client";

import { useState, useEffect, useCallback } from "react";
import { AgentCanvas } from "@/components/agents/agent-canvas";
import { AgentInstance } from "@/components/agents/agent-panel";

export function AgentsClient() {
  const [agents, setAgents] = useState<AgentInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      const data = await res.json();
      if (data.agents) setAgents(data.agents);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    // Poll for updates on running agents
    const interval = setInterval(() => {
      setAgents((prev) => {
        if (prev.some((a) => a.status === 'running')) {
          fetchAgents();
        }
        return prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  const handleSpawnAgent = async (task: string) => {
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task }),
      });
      const data = await res.json();
      if (data.agent) {
        setAgents((prev) => [data.agent, ...prev]);
      }
    } catch (err) {
      console.error('Failed to spawn agent:', err);
    }
  };

  const handleSendMessage = async (agentId: string, message: string) => {
    // Optimistically add user message
    setAgents((prev) =>
      prev.map((a) =>
        a.id === agentId
          ? {
              ...a,
              status: 'running' as const,
              messages: [...a.messages, { role: 'user' as const, content: message, timestamp: new Date().toISOString() }],
            }
          : a
      )
    );

    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (data.message) {
        setAgents((prev) =>
          prev.map((a) =>
            a.id === agentId
              ? {
                  ...a,
                  status: 'idle' as const,
                  lastActiveAt: new Date().toISOString(),
                  messages: [
                    ...a.messages,
                    { role: 'assistant' as const, content: data.message, timestamp: new Date().toISOString() },
                  ],
                }
              : a
          )
        );
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, status: 'failed' as const } : a))
      );
    }
  };

  const handleStopAgent = async (agentId: string) => {
    try {
      await fetch(`/api/agents/${agentId}/stop`, { method: 'POST' });
      setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, status: 'idle' as const } : a)));
    } catch (err) {
      console.error('Failed to stop agent:', err);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    try {
      await fetch(`/api/agents/${agentId}`, { method: 'DELETE' });
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
    } catch (err) {
      console.error('Failed to delete agent:', err);
    }
  };

  const handleMoveAgent = async (agentId: string, position: { x: number; y: number }) => {
    setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, position } : a)));
    try {
      await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position }),
      });
    } catch {
      // non-critical
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-[#FAFAF8]"
        style={{
          backgroundImage: 'radial-gradient(circle, #ccc 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        <div className="font-mono text-xs text-gray-400 animate-pulse">Loading agents...</div>
      </div>
    );
  }

  return (
    <AgentCanvas
      agents={agents}
      onSpawnAgent={handleSpawnAgent}
      onSendMessage={handleSendMessage}
      onStopAgent={handleStopAgent}
      onDeleteAgent={handleDeleteAgent}
      onMoveAgent={handleMoveAgent}
    />
  );
}
