/**
 * MCP (Model Context Protocol) server — JSON-RPC 2.0 router.
 *
 * Handles initialize, tools/list, tools/call, resources/list, resources/read, ping.
 * Called directly from the Next.js API route.
 */

import { BRAIN_TOOLS, handleToolCall } from './tools';
import { BRAIN_RESOURCES, handleResourceRead } from './resources';

// ---------------------------------------------------------------------------
// JSON-RPC types
// ---------------------------------------------------------------------------

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

function rpcError(id: string | number | null | undefined, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

function rpcResult(id: string | number | null | undefined, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function handleMcpRequest(
  body: unknown,
  userId: string
): Promise<JsonRpcResponse | JsonRpcResponse[]> {
  // Batch support
  if (Array.isArray(body)) {
    const results = await Promise.all(
      body.map(item => handleSingleRequest(item as JsonRpcRequest, userId))
    );
    return results;
  }

  return handleSingleRequest(body as JsonRpcRequest, userId);
}

async function handleSingleRequest(
  req: unknown,
  userId: string
): Promise<JsonRpcResponse> {
  // Validate basic JSON-RPC structure
  if (!req || typeof req !== 'object') {
    return rpcError(null, -32600, 'Invalid request');
  }

  const request = req as JsonRpcRequest;

  if (request.jsonrpc !== '2.0') {
    return rpcError(request.id, -32600, 'Invalid request: jsonrpc must be "2.0"');
  }

  if (!request.method || typeof request.method !== 'string') {
    return rpcError(request.id, -32600, 'Invalid request: method is required');
  }

  try {
    switch (request.method) {
      case 'initialize':
        return rpcResult(request.id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {}, resources: {} },
          serverInfo: { name: "dopl-brain", version: "1.0.0" }
        });

      case 'notifications/initialized':
        return rpcResult(request.id, {});

      case 'tools/list':
        return rpcResult(request.id, { tools: BRAIN_TOOLS });

      case 'tools/call': {
        const params = request.params || {};
        const toolName = params.name as string;
        const toolArgs = (params.arguments || {}) as Record<string, unknown>;

        if (!toolName) {
          return rpcError(request.id, -32602, 'Invalid params: name is required');
        }

        const knownTool = BRAIN_TOOLS.find(t => t.name === toolName);
        if (!knownTool) {
          return rpcError(request.id, -32602, `Unknown tool: ${toolName}`);
        }

        const result = await handleToolCall(toolName, toolArgs, userId);
        return rpcResult(request.id, result);
      }

      case 'resources/list':
        return rpcResult(request.id, { resources: BRAIN_RESOURCES });

      case 'resources/read': {
        const params = request.params || {};
        const uri = params.uri as string;

        if (!uri) {
          return rpcError(request.id, -32602, 'Invalid params: uri is required');
        }

        const knownResource = BRAIN_RESOURCES.find(r => r.uri === uri);
        if (!knownResource) {
          return rpcError(request.id, -32002, `Resource not found: ${uri}`);
        }

        const result = await handleResourceRead(uri, userId);
        return rpcResult(request.id, result);
      }

      case 'ping':
        return rpcResult(request.id, {});

      default:
        return rpcError(request.id, -32601, `Method not found: ${request.method}`);
    }
  } catch (err) {
    console.error(`[mcp] Error handling ${request.method}:`, err);
    return rpcError(request.id, -32603, 'Internal error');
  }
}
