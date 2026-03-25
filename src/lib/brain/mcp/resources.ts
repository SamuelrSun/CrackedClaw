/**
 * MCP Resource definitions and handlers for the Dopl Brain.
 *
 * Defines 2 resources: brain://profile and brain://context.
 */

import { mem0GetCore, formatMemoriesForPrompt } from '@/lib/memory/mem0-client';
import { retrieveBrainContext } from '@/lib/brain/retriever/brain-retriever';
import { formatBrainContext } from '@/lib/brain/retriever/context-formatter';
import { loadBrainCriteriaByType } from '@/lib/brain/brain-store';

// ---------------------------------------------------------------------------
// Resource definitions (for resources/list)
// ---------------------------------------------------------------------------

export const BRAIN_RESOURCES = [
  {
    uri: "brain://profile",
    name: "User Brain Profile",
    description: "Core identity, personality preferences, and high-importance facts about this user",
    mimeType: "text/plain"
  },
  {
    uri: "brain://context",
    name: "Full Brain Context",
    description: "Complete formatted context block ready for system prompt injection. Includes all relevant memories and learned preferences.",
    mimeType: "text/plain"
  }
];

// ---------------------------------------------------------------------------
// Resource handler
// ---------------------------------------------------------------------------

export async function handleResourceRead(
  uri: string,
  userId: string
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  switch (uri) {
    case "brain://profile":
      return handleProfile(userId);
    case "brain://context":
      return handleContext(userId);
    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
}

// ---------------------------------------------------------------------------
// Individual handlers
// ---------------------------------------------------------------------------

async function handleProfile(
  userId: string
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  const [personalityCriteria, coreMemories] = await Promise.all([
    loadBrainCriteriaByType(userId, ['personality']),
    mem0GetCore(userId, { minImportance: 0.8, limit: 10 }),
  ]);

  const parts: string[] = ['# User Brain Profile', ''];

  if (personalityCriteria.length > 0) {
    parts.push('## Personality Preferences');
    for (const c of personalityCriteria) {
      const sign = c.weight >= 0 ? '+' : '';
      parts.push(`- ${c.description} (weight: ${sign}${c.weight.toFixed(2)})`);
    }
    parts.push('');
  }

  if (coreMemories.length > 0) {
    parts.push('## Core Facts');
    for (const m of coreMemories) {
      parts.push(`- ${m.memory || m.content}`);
    }
    parts.push('');
  }

  if (personalityCriteria.length === 0 && coreMemories.length === 0) {
    parts.push('No profile data available yet. The brain learns from interactions over time.');
  }

  return {
    contents: [{
      uri: "brain://profile",
      mimeType: "text/plain",
      text: parts.join('\n')
    }]
  };
}

async function handleContext(
  userId: string
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  const [criteria, coreMemories] = await Promise.all([
    retrieveBrainContext(userId, [], { maxCriteria: 20, includePersonality: true }),
    mem0GetCore(userId),
  ]);

  const parts: string[] = [];

  const brainBlock = formatBrainContext(criteria);
  if (brainBlock) {
    parts.push(brainBlock);
  }

  const memoriesBlock = formatMemoriesForPrompt(coreMemories);
  if (memoriesBlock) {
    parts.push(memoriesBlock);
  }

  if (parts.length === 0) {
    parts.push('No brain context available yet. The brain learns from interactions over time.');
  }

  return {
    contents: [{
      uri: "brain://context",
      mimeType: "text/plain",
      text: parts.join('\n\n')
    }]
  };
}
