/**
 * MCP Tool definitions and handlers for the Dopl Brain.
 *
 * Defines 4 tools: brain_recall, brain_remember, brain_ingest, brain_preferences.
 * Handlers call brain engine functions directly (no HTTP round-trips).
 */

import { mem0Search, mem0Write, mem0Add } from '@/lib/memory/mem0-client';
import { retrieveBrainContext } from '@/lib/brain/retriever/brain-retriever';
import { formatBrainContext } from '@/lib/brain/retriever/context-formatter';
import { loadBrainCriteria, loadBrainCriteriaByType } from '@/lib/brain/brain-store';
import { collectBrainSignals } from '@/lib/brain/signals/collector';
import type { PreferenceType } from '@/lib/brain/types';

// ---------------------------------------------------------------------------
// Tool definitions (for tools/list)
// ---------------------------------------------------------------------------

export const BRAIN_TOOLS = [
  {
    name: "brain_recall",
    description: "Search the user's brain for relevant memories and learned preferences. Call this before responding to understand user context, preferences, and past interactions. Returns both factual memories and behavioral preferences.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "What to search for in the user's brain" },
        domain: { type: "string", description: "Optional domain filter: email, coding, scheduling, writing, etc." },
        limit: { type: "number", description: "Max results (default 10)" }
      },
      required: ["query"]
    }
  },
  {
    name: "brain_remember",
    description: "Store an important fact, preference, or detail about the user in their brain. Use when you learn something new that should persist across sessions and tools.",
    inputSchema: {
      type: "object" as const,
      properties: {
        content: { type: "string", description: "The fact or preference to remember" },
        domain: { type: "string", description: "Category: identity, projects, contacts, preferences, work, coding, email, general" },
        importance: { type: "number", description: "0.0-1.0 importance score (default 0.7)" }
      },
      required: ["content"]
    }
  },
  {
    name: "brain_ingest",
    description: "Process a conversation to automatically extract memories and learn preferences. Call after important conversations to feed the brain's learning pipeline.",
    inputSchema: {
      type: "object" as const,
      properties: {
        messages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              role: { type: "string", description: "user or assistant" },
              content: { type: "string" }
            },
            required: ["role", "content"]
          },
          description: "Conversation messages to process"
        },
        session_id: { type: "string", description: "Optional session identifier for grouping signals" }
      },
      required: ["messages"]
    }
  },
  {
    name: "brain_preferences",
    description: "Get the user's learned preferences for a specific domain or topic. Returns weighted preferences learned from past behavior.",
    inputSchema: {
      type: "object" as const,
      properties: {
        domain: { type: "string", description: "Domain like email, coding, writing, scheduling" },
        type: { type: "string", description: "Filter by preference type: personality, process, style, criteria, knowledge, general" }
      }
    }
  }
];

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

export async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  switch (toolName) {
    case "brain_recall":
      return handleRecall(args, userId);
    case "brain_remember":
      return handleRemember(args, userId);
    case "brain_ingest":
      return handleIngest(args, userId);
    case "brain_preferences":
      return handlePreferences(args, userId);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// ---------------------------------------------------------------------------
// Individual handlers
// ---------------------------------------------------------------------------

async function handleRecall(
  args: Record<string, unknown>,
  userId: string
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const query = args.query as string;
  const limit = (args.limit as number) || 10;
  const domain = args.domain as string | undefined;

  const [searchResults, criteria] = await Promise.all([
    mem0Search(query, userId, { limit, domain }),
    retrieveBrainContext(userId, [{ role: 'user', content: query }], {
      maxCriteria: limit,
    }),
  ]);

  const parts: string[] = [];

  if (searchResults.length > 0) {
    parts.push('## Memories');
    for (const m of searchResults) {
      const simStr = m.similarity ? ` (relevance: ${(m.similarity * 100).toFixed(0)}%)` : '';
      parts.push(`- ${m.memory || m.content}${simStr}`);
    }
  }

  if (criteria.length > 0) {
    parts.push('');
    parts.push(formatBrainContext(criteria));
  }

  if (parts.length === 0) {
    parts.push('No relevant memories or preferences found.');
  }

  return { content: [{ type: "text", text: parts.join('\n') }] };
}

async function handleRemember(
  args: Record<string, unknown>,
  userId: string
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const content = args.content as string;
  const domain = args.domain as string | undefined;
  const importance = (args.importance as number) ?? 0.7;

  const memoryId = await mem0Write(userId, content, {
    domain,
    importance,
    source: 'mcp',
  });

  const text = memoryId
    ? `Remembered: "${content}" (id: ${memoryId}, importance: ${importance})`
    : `Failed to store memory. Please try again.`;

  return { content: [{ type: "text", text }] };
}

async function handleIngest(
  args: Record<string, unknown>,
  userId: string
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const messages = args.messages as Array<{ role: string; content: string }>;
  const sessionId = args.session_id as string | undefined;

  // Extract memories from the conversation
  await mem0Add(messages, userId);

  // Also collect brain signals from the last user+assistant pair
  const userMsgs = messages.filter(m => m.role === 'user');
  const assistantMsgs = messages.filter(m => m.role === 'assistant');
  const lastUser = userMsgs[userMsgs.length - 1];
  const lastAssistant = assistantMsgs[assistantMsgs.length - 1];

  if (lastUser && lastAssistant) {
    void collectBrainSignals({
      userId,
      userMessage: lastUser.content,
      aiMessage: lastAssistant.content,
      sessionId,
      brainEnabled: true,
    });
  }

  return {
    content: [{
      type: "text",
      text: `Ingested ${messages.length} messages. Memories extracted and brain signals collected.`
    }]
  };
}

async function handlePreferences(
  args: Record<string, unknown>,
  userId: string
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const domain = args.domain as string | undefined;
  const type = args.type as PreferenceType | undefined;

  let criteria;
  if (type) {
    criteria = await loadBrainCriteriaByType(userId, [type]);
  } else {
    criteria = await loadBrainCriteria(
      userId,
      domain ? { domain } : undefined
    );
  }

  if (criteria.length === 0) {
    const qualifier = domain ? ` for domain "${domain}"` : type ? ` of type "${type}"` : '';
    return {
      content: [{
        type: "text",
        text: `No learned preferences found${qualifier}. Preferences are built over time from interactions.`
      }]
    };
  }

  const lines = criteria.map(c => {
    const sign = c.weight >= 0 ? '+' : '';
    return `- [${c.preference_type}] ${c.description} (weight: ${sign}${c.weight.toFixed(2)}, domain: ${c.domain})`;
  });

  return {
    content: [{
      type: "text",
      text: `## Learned Preferences\n${lines.join('\n')}`
    }]
  };
}
