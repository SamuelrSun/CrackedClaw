"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  const config = { ...DEFAULT_RECONNECT_CONFIG, ...reconnectConfig };
  
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
  
  // Refs for accurate values inside async callbacks (avoids stale closure bugs)
  const reconnectAttemptRef = useRef(0);
  const isCanceledRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wasConnectedRef = useRef(false);
  
  const [memoryEntries, setMemoryEntries] = useState<GatewayMemoryEntry[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [memorySource, setMemorySource] = useState<'live' | 'mock'>('mock');

  const clearReconnectTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setReconnectCountdown(null);
  }, []);

  /**
   * Cancel reconnection — stops all retries immediately and prevents future auto-reconnects.
   * Bug 1 fix: sets isCanceledRef so handleDisconnection won't schedule more retries.
   */
  const cancelReconnect = useCallback(() => {
    isCanceledRef.current = true;
    setIsCanceled(true);
    clearReconnectTimers();
    reconnectAttemptRef.current = 0;
    setReconnectAttempt(0);
    setConnectionStatus('disconnected');
  }, [clearReconnectTimers]);

  // Forward declare so handleDisconnection can reference it
  const refreshStatusRef = useRef<(isReconnect?: boolean) => Promise<void>>(async () => {});

  const handleDisconnection = useCallback((errorMessage?: string) => {
    setIsConnected(false);
    setStatusInfo(null);
    setLatencyMs(null);
    setIsLive(false);
    setGateway(null);
    
    if (errorMessage) {
      setError(errorMessage);
    }

    // Bug 1 fix: don't reconnect if user explicitly canceled
    if (isCanceledRef.current) {
      setConnectionStatus('disconnected');
      return;
    }
    
    const currentAttempt = reconnectAttemptRef.current;
    if (wasConnectedRef.current && config.enabled && currentAttempt < config.maxAttempts) {
      const nextAttempt = currentAttempt + 1;
      reconnectAttemptRef.current = nextAttempt;
      // Bug 2 fix: cap display at maxAttempts
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
        // Double-check not canceled before firing
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
  }, [config]);

  const refreshStatus = useCallback(async (isReconnect = false) => {
    // Bug 1 fix: abort auto-reconnect if user canceled
    if (isCanceledRef.current && isReconnect) {
      return;
    }

    if (!isReconnect) {
      setIsLoading(true);
      setConnectionStatus('checking');
    }
    setError(null);
    
    try {
      const res = await fetch('/api/gateway/status');
      const data: GatewayStatusResponse = await res.json();
      
      if (data.connected && data.status) {
        setIsConnected(true);
        setStatusInfo(data.status);
        setLatencyMs(data.latencyMs ?? null);
        setConnectionStatus('connected');
        setIsLive(data.isLive);
        wasConnectedRef.current = true;
        
        clearReconnectTimers();
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
  }, [clearReconnectTimers, handleDisconnection]);

  // Keep the ref in sync
  useEffect(() => {
    refreshStatusRef.current = refreshStatus;
  }, [refreshStatus]);

  /**
   * Force a reconnection attempt — resets canceled state and attempt counter.
   * Bug 3 fix: allows user to reconnect after canceling.
   */
  const forceReconnect = useCallback(() => {
    clearReconnectTimers();
    isCanceledRef.current = false;
    setIsCanceled(false);
    reconnectAttemptRef.current = 0;
    setReconnectAttempt(0);
    wasConnectedRef.current = true;
    refreshStatus();
  }, [clearReconnectTimers, refreshStatus]);

  const refreshMemory = useCallback(async () => {
    setMemoryLoading(true);
    setMemoryError(null);
    
    try {
      const res = await fetch('/api/gateway/memory');
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
  }, []);

  const disconnect = useCallback(() => {
    clearReconnectTimers();
    reconnectAttemptRef.current = 0;
    setReconnectAttempt(0);
    wasConnectedRef.current = false;
    isCanceledRef.current = false;
    setIsCanceled(false);
    setIsConnected(false);
    setStatusInfo(null);
    setLatencyMs(null);
    setConnectionStatus('disconnected');
    setIsLive(false);
    setMemoryEntries([]);
    setMemorySource('mock');
    setGateway(null);
  }, [clearReconnectTimers]);

  useEffect(() => {
    refreshStatus();
    return () => {
      clearReconnectTimers();
    };
  }, [refreshStatus, clearReconnectTimers]);

  useEffect(() => {
    if (!isConnected) return;
    const healthCheckInterval = setInterval(() => {
      refreshStatus(true);
    }, 30000);
    return () => clearInterval(healthCheckInterval);
  }, [isConnected, refreshStatus]);

  // Only auto-reconnect on visibility change if not canceled
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wasConnectedRef.current && !isConnected && !isCanceledRef.current) {
        forceReconnect();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isConnected, forceReconnect]);

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
    refreshStatus: () => refreshStatus(false),
    refreshMemory,
    disconnect,
    cancelReconnect,
    forceReconnect,
  };
}
