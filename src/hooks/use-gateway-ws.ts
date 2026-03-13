"use client";

/**
 * useGatewayWS — Direct WebSocket connection to the OpenClaw gateway.
 *
 * Protocol (verified working against gateway 2026.3.8):
 *   1. Connect to wss://i-XXXXX.crackedclaw.com
 *   2. Receive: {type:"event", event:"connect.challenge", payload:{nonce,ts}}
 *   3. Send connect frame with auth token
 *   4. Receive: {type:"res", id:"c1", ok:true, payload:{type:"hello-ok",...}}
 *   5. Send chat.send / chat.history / chat.abort
 *
 * Streaming events:
 *   - {type:"event", event:"agent", payload:{stream:"assistant", data:{delta:"..."}, sessionKey, runId}}
 *   - {type:"event", event:"chat",  payload:{state:"final", message:{content:[{type:"text",text:"..."}]}, sessionKey, runId}}
 *   - {type:"event", event:"agent", payload:{stream:"lifecycle", data:{phase:"end"}, ...}}
 */

import { useState, useEffect, useRef, useCallback } from "react";

export interface WSChatEvent {
  type: "token" | "done" | "error" | "lifecycle_start" | "lifecycle_end";
  /** Incremental text delta (for type:"token") */
  delta?: string;
  /** Full message text (for type:"done") */
  fullText?: string;
  /** Error message (for type:"error") */
  message?: string;
  runId?: string;
  sessionKey?: string;
}

interface UseGatewayWSOptions {
  /** Called for every streaming event from the gateway */
  onEvent?: (event: WSChatEvent) => void;
  /** Set to false to disable the WS connection entirely */
  enabled?: boolean;
}

export interface UseGatewayWSReturn {
  /** True when WS handshake is complete and ready to send */
  connected: boolean;
  /** True while connecting or waiting for hello-ok */
  connecting: boolean;
  /** Error string if connection failed and auto-reconnect gave up */
  error: string | null;
  /** Send a chat message via WS */
  sendMessage: (text: string, opts?: { sessionKey?: string }) => void;
  /** Abort the current in-flight chat run */
  abortChat: (sessionKey?: string) => void;
  /** Manual reconnect (resets backoff, re-fetches token) */
  reconnect: () => void;
}

// Exponential backoff delays (ms): 1s, 2s, 5s, 15s, 30s, give up
const BACKOFF_MS = [1000, 2000, 5000, 15000, 30000];

export function useGatewayWS({
  onEvent,
  enabled = true,
}: UseGatewayWSOptions = {}): UseGatewayWSReturn {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const wsUrlRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  });

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const connect = useCallback(async () => {
    if (!mountedRef.current || !enabled) return;

    setConnecting(true);
    setError(null);

    // Fetch WS credentials if we don't have them cached
    if (!wsUrlRef.current || !tokenRef.current) {
      try {
        const res = await fetch("/api/gateway/ws-token");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
        }
        const data = await res.json() as { wsUrl: string; token: string };
        wsUrlRef.current = data.wsUrl;
        tokenRef.current = data.token;
      } catch (err) {
        if (mountedRef.current) {
          setConnecting(false);
          setError(err instanceof Error ? err.message : "Failed to fetch WS token");
        }
        return;
      }
    }

    if (!wsUrlRef.current) {
      setConnecting(false);
      return;
    }

    try {
      const ws = new WebSocket(wsUrlRef.current);
      wsRef.current = ws;

      ws.onopen = () => {
        // Challenge will arrive; do nothing yet
      };

      ws.onmessage = (evt: MessageEvent) => {
        if (!mountedRef.current) return;

        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(evt.data as string) as Record<string, unknown>;
        } catch {
          return;
        }

        const type = msg.type as string;
        const event = msg.event as string | undefined;
        const payload = msg.payload as Record<string, unknown> | undefined;

        // ── Step 2: Challenge → send auth ──────────────────────────────────
        if (type === "event" && event === "connect.challenge") {
          ws.send(
            JSON.stringify({
              type: "req",
              id: "c1",
              method: "connect",
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                  id: "webchat",
                  version: "1.0.0",
                  platform: "web",
                  mode: "webchat",
                },
                role: "operator",
                scopes: ["operator.admin"],
                auth: { token: tokenRef.current },
              },
            })
          );
          return;
        }

        // ── Step 4: hello-ok → connected ───────────────────────────────────
        if (
          type === "hello-ok" ||
          (type === "res" && payload?.type === "hello-ok")
        ) {
          attemptRef.current = 0;
          if (mountedRef.current) {
            setConnected(true);
            setConnecting(false);
            setError(null);
          }
          return;
        }

        // ── Agent streaming token ──────────────────────────────────────────
        if (type === "event" && event === "agent") {
          const stream = payload?.stream as string;
          const data = payload?.data as Record<string, unknown>;

          if (stream === "assistant" && data?.delta) {
            onEventRef.current?.({
              type: "token",
              delta: data.delta as string,
              runId: payload?.runId as string,
              sessionKey: payload?.sessionKey as string,
            });
          }

          if (stream === "lifecycle") {
            const phase = data?.phase as string;
            if (phase === "start") {
              onEventRef.current?.({
                type: "lifecycle_start",
                runId: payload?.runId as string,
                sessionKey: payload?.sessionKey as string,
              });
            } else if (phase === "end") {
              onEventRef.current?.({
                type: "lifecycle_end",
                runId: payload?.runId as string,
                sessionKey: payload?.sessionKey as string,
              });
            }
          }
          return;
        }

        // ── Final message state ────────────────────────────────────────────
        if (type === "event" && event === "chat") {
          const state = payload?.state as string;
          if (state === "final") {
            const message = payload?.message as Record<string, unknown>;
            const contentArr = message?.content as Array<{ type: string; text: string }> | undefined;
            const fullText =
              contentArr?.find((c) => c.type === "text")?.text ?? "";
            onEventRef.current?.({
              type: "done",
              fullText,
              runId: payload?.runId as string,
              sessionKey: payload?.sessionKey as string,
            });
          }
          return;
        }

        // ── Error response (not from connect) ─────────────────────────────
        if (type === "res" && !(msg.ok as boolean) && msg.id !== "c1") {
          const errPayload = msg.error as Record<string, unknown>;
          onEventRef.current?.({
            type: "error",
            message: (errPayload?.message as string) ?? "Unknown error",
          });
          return;
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        wsRef.current = null;
        setConnected(false);
        setConnecting(false);

        // Exponential back-off reconnect
        const attempt = attemptRef.current;
        if (attempt < BACKOFF_MS.length) {
          attemptRef.current = attempt + 1;
          const delay = BACKOFF_MS[attempt];
          timerRef.current = setTimeout(() => {
            if (mountedRef.current) connect();
          }, delay);
        } else {
          setError("Gateway disconnected. Click reconnect to retry.");
        }
      };

      ws.onerror = () => {
        // onclose fires right after; handled there
        if (mountedRef.current) setConnecting(false);
      };
    } catch (err) {
      if (mountedRef.current) {
        setConnecting(false);
        setError(err instanceof Error ? err.message : "WebSocket error");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Mount / unmount
  useEffect(() => {
    mountedRef.current = true;
    if (enabled) connect();
    return () => {
      mountedRef.current = false;
      clearTimer();
      if (wsRef.current) {
        wsRef.current.onclose = null; // suppress reconnect on clean unmount
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-connect if enabled flips on
  useEffect(() => {
    if (enabled && !connected && !connecting && mountedRef.current) {
      connect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const sendMessage = useCallback(
    (text: string, opts?: { sessionKey?: string }) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        onEventRef.current?.({
          type: "error",
          message: "WebSocket not connected — falling back",
        });
        return;
      }

      const sessionKey = opts?.sessionKey ?? `webchat-${Date.now()}`;
      const idempotencyKey = `${sessionKey}-${Date.now()}`;

      ws.send(
        JSON.stringify({
          type: "req",
          id: `chat-${Date.now()}`,
          method: "chat.send",
          params: {
            sessionKey,
            idempotencyKey,
            message: text,
          },
        })
      );
    },
    []
  );

  const abortChat = useCallback((sessionKey?: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        type: "req",
        id: `abort-${Date.now()}`,
        method: "chat.abort",
        params: sessionKey ? { sessionKey } : {},
      })
    );
  }, []);

  const reconnect = useCallback(() => {
    clearTimer();
    attemptRef.current = 0;
    // Clear cached credentials so we re-fetch a fresh token
    wsUrlRef.current = null;
    tokenRef.current = null;
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setError(null);
    if (mountedRef.current) connect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect]);

  return { connected, connecting, error, sendMessage, abortChat, reconnect };
}
