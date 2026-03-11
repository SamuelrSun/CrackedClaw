"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getActiveWorkspaceId } from "@/components/layout/workspace-switcher";
import type { 
  GatewayStatusInfo, 
  GatewayStatusResponse,
  GatewayMemoryResponse,
  GatewayMemoryEntry,
  GatewayConnection
} from "@/types/gateway";

// Status type that includes 'checking' for backward compatibility
type GatewayHookStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'checking' | 'reconnecting';

// Reconnection configuration
interface ReconnectConfig {
  enabled: boolean;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  enabled: true,
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

interface UseGatewayReturn {
  // Backward compatible interface
  gateway: GatewayConnection | null;
  loading: boolean;
  status: GatewayHookStatus;
  
  // Extended interface
  isConnected: boolean;
  isLoading: boolean;
  statusInfo: GatewayStatusInfo | null;
  latencyMs: number | null;
  connectionStatus: GatewayHookStatus;
  error: string | null;
  isLive: boolean;
  
  // Reconnection state
  reconnectAttempt: number;
  reconnectCountdown: number | null;
  isReconnecting: boolean;
  isCanceled: boolean;
  
  // Memory state
  memoryEntries: GatewayMemoryEntry[];
  memoryLoading: boolean;
  memoryError: string | null;
  memorySource: 'live' | 'mock';
  
  // Actions
  refreshStatus: () => Promise<void>;
  refreshMemory: () => Promise<void>;
  disconnect: () => void;
  cancelReconnect: () => void;
  forceReconnect: () => void;
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoffDelay(attempt: number, config: ReconnectConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  const jitter = cappedDelay * 0.2 * (Math.random() * 2 - 1);
  return Math.round(cappedDelay + jitter);
}

export function useGateway(reconnectConfig?: Partial<ReconnectConfig>): UseGatewayReturn {
  // Stable config ref — never causes re-renders, always readable inside callbacks
  const configRef = useRef<ReconnectConfig>({ ...DEFAULT_RECONNECT_CONFIG, ...reconnectConfig });
  useEffect(() => {
    configRef.current = { ...DEFAULT_RECONNECT_CONFIG, ...reconnectConfig };
  }, [reconnectConfig]);

  const [gateway, setGateway] = useState<GatewayConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [statusInfo, setStatusInfo] = useState<GatewayStatusInfo | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<GatewayHookStatus>('checking');
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  
  // Reconnection state
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [reconnectCountdown, setReconnectCountdown] = useState<number | null>(null);
  const [isCanceled, setIsCanceled] = useState(false);
  
  // Refs for stable access inside async callbacks
  const isConnectedRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const isCanceledRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wasConnectedRef = useRef(false);

  // Keep isConnectedRef in sync
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);
  
  const [memoryEntries, setMemoryEntries] = useState<GatewayMemoryEntry[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [memorySource, setMemorySource] = useState<'live' | 'mock'>('mock');

  // Forward-declare so handleDisconnection can call refreshStatus
  const refreshStatusRef = useRef<(isReconnect?: boolean) => Promise<void>>(async () => {});

  /**
   * handleDisconnection — STABLE (empty deps).
   * Reads config, counts, and flags from refs only.
   */
  const handleDisconnection = useCallback((errorMessage?: string) => {
    setIsConnected(false);
    isConnectedRef.current = false;
    setStatusInfo(null);
    setLatencyMs(null);
    setIsLive(false);
    setGateway(null);
    
    if (errorMessage) {
      setError(errorMessage);
    }

    if (isCanceledRef.current) {
      setConnectionStatus('disconnected');
      return;
    }

    const config = configRef.current;
    const currentAttempt = reconnectAttemptRef.current;

    if (wasConnectedRef.current && config.enabled && currentAttempt < config.maxAttempts) {
      const nextAttempt = currentAttempt + 1;
      reconnectAttemptRef.current = nextAttempt;
      setReconnectAttempt(Math.min(nextAttempt, config.maxAttempts));
      setConnectionStatus('reconnecting');
      
      const delayMs = calculateBackoffDelay(currentAttempt, config);
      let countdown = Math.ceil(delayMs / 1000);
      setReconnectCountdown(countdown);
      
      countdownIntervalRef.current = setInterval(() => {
        countdown -= 1;
        if (countdown <= 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          setReconnectCountdown(null);
        } else {
          setReconnectCountdown(countdown);
        }
      }, 1000);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        if (!isCanceledRef.current) {
          refreshStatusRef.current(true);
        }
      }, delayMs);
    } else if (currentAttempt >= config.maxAttempts) {
      setConnectionStatus('error');
      setError('Maximum reconnection attempts reached. Click Reconnect to try again.');
    } else {
      setConnectionStatus('disconnected');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * refreshStatus — STABLE (handleDisconnection is stable).
   * Reads all values from refs; never re-created.
   */
  const refreshStatus = useCallback(async (isReconnect = false) => {
    if (isCanceledRef.current && isReconnect) {
      return;
    }

    if (!isReconnect) {
      setIsLoading(true);
      setConnectionStatus('checking');
    }
    setError(null);
    
    try {
      const orgId = getActiveWorkspaceId();
      const statusUrl = orgId ? `/api/gateway/status?org_id=${orgId}` : '/api/gateway/status';
      const res = await fetch(statusUrl);
      const data: GatewayStatusResponse = await res.json();
      
      if (data.connected && data.status) {
        setIsConnected(true);
        isConnectedRef.current = true;
        setStatusInfo(data.status);
        setLatencyMs(data.latencyMs ?? null);
        setConnectionStatus('connected');
        setIsLive(data.isLive);
        wasConnectedRef.current = true;
        
        // Clear reconnect timers
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setReconnectCountdown(null);

        reconnectAttemptRef.current = 0;
        setReconnectAttempt(0);
        isCanceledRef.current = false;
        setIsCanceled(false);
        
        setGateway({
          id: 'default',
          user_id: '',
          gateway_url: process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL || '',
          auth_token: '',
          name: data.status.agentName,
          status: 'connected',
          last_ping: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } else {
        handleDisconnection(data.error);
      }
    } catch (err) {
      handleDisconnection(err instanceof Error ? err.message : 'Failed to connect to gateway');
    } finally {
      setIsLoading(false);
    }
  }, [handleDisconnection]); // handleDisconnection is stable → refreshStatus is stable

  // Keep the ref in sync
  useEffect(() => {
    refreshStatusRef.current = refreshStatus;
  }, [refreshStatus]);

  /**
   * cancelReconnect — STABLE (empty deps).
   */
  const cancelReconnect = useCallback(() => {
    isCanceledRef.current = true;
    setIsCanceled(true);
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setReconnectCountdown(null);
    reconnectAttemptRef.current = 0;
    setReconnectAttempt(0);
    setConnectionStatus('disconnected');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * forceReconnect — STABLE (refreshStatus is stable).
   */
  const forceReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setReconnectCountdown(null);
    isCanceledRef.current = false;
    setIsCanceled(false);
    reconnectAttemptRef.current = 0;
    setReconnectAttempt(0);
    wasConnectedRef.current = true;
    refreshStatus();
  }, [refreshStatus]); // refreshStatus is stable → forceReconnect is stable

  const refreshMemory = useCallback(async () => {
    setMemoryLoading(true);
    setMemoryError(null);
    
    try {
      const res = await fetch('/api/memory');
      const data: GatewayMemoryResponse = await res.json();
      
      setMemoryEntries(data.entries);
      setMemorySource(data.source);
      
      if (data.error) {
        setMemoryError(data.error);
      }
    } catch (err) {
      setMemoryError(err instanceof Error ? err.message : 'Failed to fetch memory');
    } finally {
      setMemoryLoading(false);
    }
  }, []); // stable

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setReconnectCountdown(null);
    reconnectAttemptRef.current = 0;
    setReconnectAttempt(0);
    wasConnectedRef.current = false;
    isCanceledRef.current = false;
    setIsCanceled(false);
    setIsConnected(false);
    isConnectedRef.current = false;
    setStatusInfo(null);
    setLatencyMs(null);
    setConnectionStatus('disconnected');
    setIsLive(false);
    setMemoryEntries([]);
    setMemorySource('mock');
    setGateway(null);
  }, []); // stable

  // Initial fetch — runs once (refreshStatus is stable)
  useEffect(() => {
    refreshStatus();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [refreshStatus]); // stable → runs once on mount

  // Health-check + initial connection polling
  // For connected users: health check every 30s
  // For new users who were never connected: poll every 8s for up to ~60s (provisioning race)
  useEffect(() => {
    let initialRetries = 0;
    const MAX_INITIAL_RETRIES = 8;
    let timerId: ReturnType<typeof setTimeout>;
    
    function scheduleNext() {
      const delay = isConnectedRef.current ? 30000 : 8000;
      timerId = setTimeout(() => {
        if (isConnectedRef.current) {
          // Already connected — standard health check
          refreshStatus(true).then(scheduleNext);
        } else if (!wasConnectedRef.current && !isCanceledRef.current && initialRetries < MAX_INITIAL_RETRIES) {
          // Never connected — keep polling (provisioning may still be running)
          initialRetries++;
          refreshStatus(true).then(scheduleNext);
        } else {
          // Give up initial polling, but keep scheduling for reconnect scenarios
          scheduleNext();
        }
      }, delay);
    }
    
    scheduleNext();
    return () => clearTimeout(timerId);
  }, [refreshStatus]); // refreshStatus is stable → effect runs once

  // Visibility change — stable deps
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        wasConnectedRef.current &&
        !isConnectedRef.current &&
        !isCanceledRef.current
      ) {
        forceReconnect();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [forceReconnect]); // forceReconnect is stable → effect runs once

  // Stable public refreshStatus wrapper (no isReconnect param exposed)
  const publicRefreshStatus = useCallback(() => refreshStatus(false), [refreshStatus]);

  return {
    gateway,
    loading: isLoading,
    status: connectionStatus,
    isConnected,
    isLoading,
    statusInfo,
    latencyMs,
    connectionStatus,
    error,
    isLive,
    reconnectAttempt,
    reconnectCountdown,
    isReconnecting: connectionStatus === 'reconnecting',
    isCanceled,
    memoryEntries,
    memoryLoading,
    memoryError,
    memorySource,
    refreshStatus: publicRefreshStatus,
    refreshMemory,
    disconnect,
    cancelReconnect,
    forceReconnect,
  };
}
