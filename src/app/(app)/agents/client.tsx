"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AgentCanvas } from "@/components/agents/agent-canvas";
import { AgentInstance } from "@/components/agents/agent-panel";

interface StreamEvent {
  type: 'token' | 'tool_start' | 'tool_end' | 'tool_progress' | 'done' | 'error';
  text?: string;
  tool?: string;
  input?: unknown;
  output?: unknown;
  message?: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export function AgentsClient() {
  const [agents, setAgents] = useState<AgentInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const streamControllers = useRef<Map<string, AbortController>>(new Map());

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      const data = await res.json();
      if (data.agents) {
        setAgents(prev => {
          // Merge server data with local streaming state
          const streamingIds = new Set<string>();
          for (const a of prev) {
            if (a.streamBuffer !== undefined || a.currentTool) {
              streamingIds.add(a.id);
            }
          }
          return data.agents.map((serverAgent: AgentInstance) => {
            const local = prev.find(a => a.id === serverAgent.id);
            if (local && streamingIds.has(serverAgent.id)) {
              // Preserve local streaming state
              return {
                ...serverAgent,
                currentTool: local.currentTool,
                streamBuffer: local.streamBuffer,
                startedAt: local.startedAt,
              };
            }
            return serverAgent;
          });
        });
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  // Cleanup streams on unmount
  useEffect(() => {
    return () => {
      streamControllers.current.forEach(c => c.abort());
    };
  }, []);

  const connectStream = useCallback(async (agentId: string, message?: string) => {
    // Cancel any existing stream for this agent
    streamControllers.current.get(agentId)?.abort();

    const controller = new AbortController();
    streamControllers.current.set(agentId, controller);

    // Set agent to running with streaming state
    setAgents(prev => prev.map(a =>
      a.id === agentId
        ? { ...a, status: 'running' as const, streamBuffer: '', currentTool: null, startedAt: Date.now() }
        : a
    ));

    let fullResponse = '';

    try {
      const res = await fetch(`/api/agents/${agentId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Stream failed: ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop()!;

        for (const part of parts) {
          const dataLine = part.split('\n').find(l => l.startsWith('data: '));
          if (!dataLine) continue;

          let evt: StreamEvent;
          try {
            evt = JSON.parse(dataLine.slice(6));
          } catch {
            continue;
          }

          switch (evt.type) {
            case 'token':
              fullResponse += evt.text || '';
              setAgents(prev => prev.map(a =>
                a.id === agentId
                  ? { ...a, streamBuffer: fullResponse, currentTool: null }
                  : a
              ));
              break;

            case 'tool_start':
              setAgents(prev => prev.map(a =>
                a.id === agentId
                  ? { ...a, currentTool: evt.tool || null }
                  : a
              ));
              break;

            case 'tool_end':
              setAgents(prev => prev.map(a =>
                a.id === agentId
                  ? { ...a, currentTool: null }
                  : a
              ));
              break;

            case 'done':
              setAgents(prev => prev.map(a =>
                a.id === agentId
                  ? {
                      ...a,
                      status: 'idle' as const,
                      currentTool: null,
                      streamBuffer: undefined,
                      startedAt: undefined,
                      lastActiveAt: new Date().toISOString(),
                      messages: fullResponse
                        ? [...a.messages, { role: 'assistant' as const, content: fullResponse, timestamp: new Date().toISOString() }]
                        : a.messages,
                    }
                  : a
              ));
              break;

            case 'error':
              setAgents(prev => prev.map(a =>
                a.id === agentId
                  ? {
                      ...a,
                      status: 'failed' as const,
                      currentTool: null,
                      streamBuffer: undefined,
                      startedAt: undefined,
                    }
                  : a
              ));
              break;
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Stream error:', err);
        setAgents(prev => prev.map(a =>
          a.id === agentId
            ? { ...a, status: 'failed' as const, currentTool: null, streamBuffer: undefined, startedAt: undefined }
            : a
        ));
      }
    } finally {
      streamControllers.current.delete(agentId);
    }
  }, []);

  // Reconnect streams for agents that are 'running' on initial load
  useEffect(() => {
    if (loading) return;
    agents.forEach(agent => {
      if (agent.status === 'running' && !streamControllers.current.has(agent.id) && !agent.streamBuffer) {
        // Agent was running before page load — it might be stale, just mark idle
        setAgents(prev => prev.map(a =>
          a.id === agent.id && a.status === 'running' && !streamControllers.current.has(a.id)
            ? { ...a, status: 'idle' as const }
            : a
        ));
      }
    });
    // Only run once after initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const handleSpawnAgent = useCallback(async (task: string) => {
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task }),
      });
      const data = await res.json();
      if (data.agent) {
        const agent: AgentInstance = {
          ...data.agent,
          startedAt: Date.now(),
          streamBuffer: '',
          currentTool: null,
        };
        setAgents(prev => [agent, ...prev]);
        // Fire and forget — connectStream manages its own state
        connectStream(agent.id);
      }
    } catch (err) {
      console.error('Failed to spawn agent:', err);
    }
  }, [connectStream]);

  const handleSendMessage = useCallback(async (agentId: string, message: string) => {
    // Optimistically add user message
    setAgents(prev => prev.map(a =>
      a.id === agentId
        ? {
            ...a,
            messages: [...a.messages, { role: 'user' as const, content: message, timestamp: new Date().toISOString() }],
          }
        : a
    ));
    // Start streaming response
    connectStream(agentId, message);
  }, [connectStream]);

  const handleStopAgent = useCallback(async (agentId: string) => {
    // Abort client-side stream
    streamControllers.current.get(agentId)?.abort();
    streamControllers.current.delete(agentId);

    // Update server
    try {
      await fetch(`/api/agents/${agentId}/stop`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to stop agent:', err);
    }

    setAgents(prev => prev.map(a =>
      a.id === agentId
        ? { ...a, status: 'idle' as const, currentTool: null, streamBuffer: undefined, startedAt: undefined }
        : a
    ));
  }, []);

  const handleDeleteAgent = useCallback(async (agentId: string) => {
    // Abort stream if running
    streamControllers.current.get(agentId)?.abort();
    streamControllers.current.delete(agentId);

    try {
      await fetch(`/api/agents/${agentId}`, { method: 'DELETE' });
      setAgents(prev => prev.filter(a => a.id !== agentId));
    } catch (err) {
      console.error('Failed to delete agent:', err);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-[#0d0d12]">
        <div className="font-mono text-[11px] text-white/25 animate-pulse">Loading agents...</div>
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
    />
  );
}
