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
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  // Add jitter (±20%)
  const jitter = cappedDelay * 0.2 * (Math.random() * 2 - 1);
  return Math.round(cappedDelay + jitter);
}

export function useGateway(reconnectConfig?: Partial<ReconnectConfig>): UseGatewayReturn {
  const config = { ...DEFAULT_RECONNECT_CONFIG, ...reconnectConfig };
  
  // Gateway connection (for backward compatibility)
  const [gateway, setGateway] = useState<GatewayConnection | null>(null);
  
  // Status state
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
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wasConnectedRef = useRef(false);
  
  // Memory state
  const [memoryEntries, setMemoryEntries] = useState<GatewayMemoryEntry[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [memorySource, setMemorySource] = useState<'live' | 'mock'>('mock');

  /**
   * Clear all reconnection timers
   */
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
   * Cancel reconnection attempts
   */
  const cancelReconnect = useCallback(() => {
    clearReconnectTimers();
    setReconnectAttempt(0);
    if (connectionStatus === 'reconnecting') {
      setConnectionStatus('disconnected');
    }
  }, [clearReconnectTimers, connectionStatus]);

  const refreshStatus = useCallback(async (isReconnect = false) => {
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
        
        // Clear reconnection state on successful connection
        clearReconnectTimers();
        setReconnectAttempt(0);
        
        // Create a mock gateway connection for backward compatibility
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearReconnectTimers]);

  /**
   * Handle disconnection and potentially trigger reconnection
   */
  const handleDisconnection = useCallback((errorMessage?: string) => {
    setIsConnected(false);
    setStatusInfo(null);
    setLatencyMs(null);
    setIsLive(false);
    setGateway(null);
    
    if (errorMessage) {
      setError(errorMessage);
    }
    
    // Only attempt reconnection if we were previously connected and auto-reconnect is enabled
    if (wasConnectedRef.current && config.enabled && reconnectAttempt < config.maxAttempts) {
      const nextAttempt = reconnectAttempt + 1;
      setReconnectAttempt(nextAttempt);
      setConnectionStatus('reconnecting');
      
      const delayMs = calculateBackoffDelay(reconnectAttempt, config);
      let countdown = Math.ceil(delayMs / 1000);
      setReconnectCountdown(countdown);
      
      // Update countdown every second
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
      
      // Schedule reconnection attempt
      reconnectTimeoutRef.current = setTimeout(() => {
        refreshStatus(true);
      }, delayMs);
    } else if (reconnectAttempt >= config.maxAttempts) {
      setConnectionStatus('error');
      setError('Maximum reconnection attempts reached. Click to retry.');
    } else {
      setConnectionStatus('disconnected');
    }
  }, [config, reconnectAttempt, refreshStatus]);

  /**
   * Force a reconnection attempt (resets attempt counter)
   */
  const forceReconnect = useCallback(() => {
    clearReconnectTimers();
    setReconnectAttempt(0);
    wasConnectedRef.current = true; // Enable reconnection logic
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
    setReconnectAttempt(0);
    wasConnectedRef.current = false;
    setIsConnected(false);
    setStatusInfo(null);
    setLatencyMs(null);
    setConnectionStatus('disconnected');
    setIsLive(false);
    setMemoryEntries([]);
    setMemorySource('mock');
    setGateway(null);
  }, [clearReconnectTimers]);

  // Initial fetch on mount
  useEffect(() => {
    refreshStatus();
    
    // Cleanup on unmount
    return () => {
      clearReconnectTimers();
    };
  }, [refreshStatus, clearReconnectTimers]);

  // Periodic health check when connected
  useEffect(() => {
    if (!isConnected) return;
    
    const healthCheckInterval = setInterval(() => {
      refreshStatus(true);
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(healthCheckInterval);
  }, [isConnected, refreshStatus]);

  // Handle visibility change (reconnect when tab becomes visible)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wasConnectedRef.current && !isConnected) {
        forceReconnect();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isConnected, forceReconnect]);

  return {
    // Backward compatible
    gateway,
    loading: isLoading,
    status: connectionStatus,
    
    // Extended
    isConnected,
    isLoading,
    statusInfo,
    latencyMs,
    connectionStatus,
    error,
    isLive,
    
    // Reconnection
    reconnectAttempt,
    reconnectCountdown,
    isReconnecting: connectionStatus === 'reconnecting',
    
    // Memory
    memoryEntries,
    memoryLoading,
    memoryError,
    memorySource,
    
    // Actions
    refreshStatus: () => refreshStatus(false),
    refreshMemory,
    disconnect,
    cancelReconnect,
    forceReconnect,
  };
}
