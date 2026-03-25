/**
 * CORS helper for Brain v1 API routes.
 * Wraps responses with Access-Control-Allow-Origin headers.
 */

import { NextResponse } from 'next/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

/**
 * Create a JSON response with CORS headers.
 */
export function corsJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: CORS_HEADERS,
  });
}

/**
 * Create an error response with CORS headers.
 */
export function corsError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, {
    status,
    headers: CORS_HEADERS,
  });
}

/**
 * OPTIONS preflight handler for Brain v1 routes.
 */
export function corsOptions(methods = 'GET, POST, OPTIONS'): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      'Access-Control-Allow-Methods': methods,
    },
  });
}
