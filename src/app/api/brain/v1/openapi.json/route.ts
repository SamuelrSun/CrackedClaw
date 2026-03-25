/**
 * GET /api/brain/v1/openapi.json
 * Returns the OpenAPI 3.0 spec for the Brain API.
 * Used for ChatGPT Custom GPT Actions and other OpenAPI-compatible integrations.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const SPEC = {
  openapi: '3.0.0',
  info: {
    title: 'Dopl Brain API',
    version: '1.0.0',
    description: 'Portable AI memory API. Store and retrieve memories, preferences, and context across any AI tool.',
  },
  servers: [{ url: 'https://usedopl.com/api/brain/v1', description: 'Production' }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Dopl Brain API key (starts with dpb_sk_)',
      },
    },
  },
  paths: {
    '/recall': {
      post: {
        operationId: 'recallMemories',
        summary: 'Search the brain for relevant memories and preferences',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['query'],
                properties: {
                  query: { type: 'string', description: 'What to search for' },
                  domain: { type: 'string', description: 'Optional domain filter' },
                  limit: { type: 'integer', default: 10 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Matching memories and preferences with formatted context' },
        },
      },
    },
    '/remember': {
      post: {
        operationId: 'rememberFact',
        summary: 'Store a new memory or fact in the brain',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['content'],
                properties: {
                  content: { type: 'string' },
                  domain: { type: 'string' },
                  importance: { type: 'number', minimum: 0, maximum: 1 },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Memory stored' } },
      },
    },
    '/ingest': {
      post: {
        operationId: 'ingestConversation',
        summary: 'Process a conversation to extract and store memories',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['messages'],
                properties: {
                  messages: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        role: { type: 'string' },
                        content: { type: 'string' },
                      },
                    },
                  },
                  session_id: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Conversation processed' } },
      },
    },
    '/context': {
      get: {
        operationId: 'getContext',
        summary: 'Get full formatted brain context for system prompt injection',
        responses: { 200: { description: 'Formatted context block' } },
      },
    },
    '/memories': {
      get: {
        operationId: 'listMemories',
        summary: 'List stored memories',
        parameters: [
          { name: 'domain', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } },
        ],
        responses: { 200: { description: 'List of memories' } },
      },
    },
    '/preferences': {
      get: {
        operationId: 'listPreferences',
        summary: 'Get learned preferences',
        parameters: [
          { name: 'domain', in: 'query', schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'List of preferences' } },
      },
    },
    '/signal': {
      post: {
        operationId: 'submitSignal',
        summary: 'Submit a behavioral signal to the brain',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type', 'data'],
                properties: {
                  type: { type: 'string', enum: ['correction', 'accept', 'reject', 'edit_delta', 'engagement'] },
                  data: { type: 'object' },
                  domain: { type: 'string' },
                  session_id: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Signal recorded' } },
      },
    },
    '/summarize': {
      post: {
        operationId: 'summarizeConversation',
        summary: 'Generate and store a session summary',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['messages'],
                properties: {
                  messages: { type: 'array', items: { type: 'object' } },
                  session_id: { type: 'string' },
                  title: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Summary generated and stored' } },
      },
    },
    '/export': {
      get: {
        operationId: 'exportBrain',
        summary: 'Export entire brain as JSON',
        responses: { 200: { description: 'Full brain export JSON file' } },
      },
    },
  },
};

export async function GET() {
  return new NextResponse(JSON.stringify(SPEC, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
