/**
 * src/index.ts
 *
 * Entry point for the Dopl Brain MCP server.
 *
 * Creates and runs an MCP (Model Context Protocol) server that exposes Dopl
 * Brain's memory capabilities to any MCP-compatible AI client, including
 * Claude Desktop, OpenClaw, and Claude Cowork.
 *
 * Transport: stdio (standard input/output — required for Claude Desktop and OpenClaw)
 *
 * Environment variables:
 *   DOPL_BRAIN_TOKEN (required) — API token from https://usedopl.com/settings
 *   DOPL_BRAIN_URL   (optional) — Override the API base URL (default: https://usedopl.com)
 *
 * Tools registered:     brain_recall, brain_remember, brain_update, brain_forget, brain_import_memories
 * Resources registered: brain://profile, brain://recent, brain://domains
 * Prompts registered:   import-memories, recall-context
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { createClientFromEnv } from './brain-api.js';

// Tools
import { RECALL_TOOL_DEFINITION, handleRecall } from './tools/recall.js';
import { REMEMBER_TOOL_DEFINITION, handleRemember } from './tools/remember.js';
import { UPDATE_TOOL_DEFINITION, handleUpdate } from './tools/update.js';
import { FORGET_TOOL_DEFINITION, handleForget } from './tools/forget.js';
import { IMPORT_TOOL_DEFINITION, handleImport } from './tools/import.js';

// Resources
import { handleProfileResource } from './resources/profile.js';
import { handleRecentResource } from './resources/recent.js';
import { handleDomainsResource } from './resources/domains.js';

// Prompts
import { handleImportMemoriesPrompt } from './prompts/import-memories.js';
import { handleRecallContextPrompt } from './prompts/recall-context.js';

// ---------------------------------------------------------------------------
// Package metadata
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require('../package.json') as { version: string };

// ---------------------------------------------------------------------------
// Resource definitions (static metadata for ListResources)
// ---------------------------------------------------------------------------

const RESOURCES = [
  {
    uri: 'brain://profile',
    name: 'Brain Profile',
    description: "Summary of the user's Dopl Brain: name, fact count, domains, and last update.",
    mimeType: 'text/plain',
  },
  {
    uri: 'brain://recent',
    name: 'Recent Memories',
    description: 'Memories added or updated recently (last 20 by relevance).',
    mimeType: 'text/plain',
  },
  {
    uri: 'brain://domains',
    name: 'Brain Domains',
    description: 'Knowledge domains in the Dopl Brain with their fact counts.',
    mimeType: 'text/plain',
  },
] as const;

// Prompt definitions (static metadata for ListPrompts)
const PROMPTS = [
  {
    name: 'import-memories',
    description:
      'Import existing memories from OpenClaw workspace files into Dopl Brain. ' +
      'Reads MEMORY.md and the memory/ directory from the specified workspace path.',
    arguments: [
      {
        name: 'workspace_path',
        description:
          'Path to the OpenClaw workspace directory (defaults to current directory). ' +
          'Example: /Users/me/.openclaw/workspace',
        required: false,
      },
    ],
  },
  {
    name: 'recall-context',
    description:
      'Add a system instruction to check Dopl Brain before answering personal questions. ' +
      'Makes brain_recall automatic for context-sensitive responses.',
    arguments: [],
  },
] as const;

// ---------------------------------------------------------------------------
// Startup validation
// ---------------------------------------------------------------------------

function validateEnvironment(): void {
  const token = process.env.DOPL_BRAIN_TOKEN;
  if (!token) {
    process.stderr.write(
      [
        '❌ DOPL_BRAIN_TOKEN is not set.',
        '',
        'The Dopl Brain MCP server requires an API token to connect to your brain.',
        '',
        'To fix this:',
        '  1. Get your token at https://usedopl.com/settings',
        '  2. Add it to your MCP configuration:',
        '',
        '  Claude Desktop (~/Library/Application Support/Claude/claude_desktop_config.json):',
        '    "env": { "DOPL_BRAIN_TOKEN": "dpb_sk_your_token_here" }',
        '',
        '  OpenClaw (openclaw.json):',
        '    "env": { "DOPL_BRAIN_TOKEN": "dpb_sk_your_token_here" }',
        '',
        '  Or set the environment variable directly:',
        '    export DOPL_BRAIN_TOKEN=dpb_sk_your_token_here',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  validateEnvironment();

  const client = createClientFromEnv();

  const server = new Server(
    {
      name: 'dopl-brain',
      version: pkg.version,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
        logging: {},
      },
    },
  );

  // -------------------------------------------------------------------------
  // Tools
  // -------------------------------------------------------------------------

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      RECALL_TOOL_DEFINITION,
      REMEMBER_TOOL_DEFINITION,
      UPDATE_TOOL_DEFINITION,
      FORGET_TOOL_DEFINITION,
      IMPORT_TOOL_DEFINITION,
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const inputArgs = (args ?? {}) as Record<string, unknown>;

    // Helper: send progress logs to the client via MCP logging notification
    const log = (message: string): void => {
      server.sendLoggingMessage({ level: 'info', data: message }).catch(() => {
        // Logging is best-effort — ignore if the client doesn't support it
      });
    };

    switch (name) {
      case 'brain_recall':
        return handleRecall(client, inputArgs as unknown as Parameters<typeof handleRecall>[1]);

      case 'brain_remember':
        return handleRemember(client, inputArgs as unknown as Parameters<typeof handleRemember>[1]);

      case 'brain_update':
        return handleUpdate(client, inputArgs as unknown as Parameters<typeof handleUpdate>[1]);

      case 'brain_forget':
        return handleForget(client, inputArgs as unknown as Parameters<typeof handleForget>[1]);

      case 'brain_import_memories':
        return handleImport(
          client,
          inputArgs as unknown as Parameters<typeof handleImport>[1],
        );

      default:
        return {
          content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  });

  // -------------------------------------------------------------------------
  // Resources
  // -------------------------------------------------------------------------

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: RESOURCES,
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const uriObject = new URL(uri);

    switch (uri) {
      case 'brain://profile':
        return handleProfileResource(client, uriObject);

      case 'brain://recent':
        return handleRecentResource(client, uriObject);

      case 'brain://domains':
        return handleDomainsResource(client, uriObject);

      default:
        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: `Unknown resource: ${uri}`,
            },
          ],
        };
    }
  });

  // -------------------------------------------------------------------------
  // Prompts
  // -------------------------------------------------------------------------

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: PROMPTS,
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const promptArgs = (args ?? {}) as Record<string, string>;

    switch (name) {
      case 'import-memories':
        return handleImportMemoriesPrompt({
          workspace_path: promptArgs.workspace_path,
        });

      case 'recall-context':
        return handleRecallContextPrompt();

      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  });

  // -------------------------------------------------------------------------
  // Start server
  // -------------------------------------------------------------------------

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Startup log to stderr (stdout is reserved for the MCP protocol)
  process.stderr.write(`✅ Dopl Brain MCP server v${pkg.version} running (stdio)\n`);
}

main().catch((err) => {
  process.stderr.write(
    `Fatal error starting Dopl Brain MCP server: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
