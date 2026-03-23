/**
 * Brain context classifier — LLM-based domain classification for conversations.
 *
 * Classifies a conversation into {domain, subdomain, context} for the brain system.
 * Uses Claude Haiku for cost efficiency since this runs on every chat session.
 */

import type { BrainContext } from './types';

const DEFAULT_CONTEXT: BrainContext = { domain: 'general' };

/**
 * Classify a conversation into a brain context using an LLM.
 *
 * Returns structured {domain, subdomain, context} for hierarchical
 * preference matching.
 */
export async function classifyBrainContext(
  messages: Array<{ role: string; content: string }>
): Promise<BrainContext> {
  if (!messages.length) return DEFAULT_CONTEXT;

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    // Take last few messages for classification (keep it cheap)
    const recentMessages = messages.slice(-6);
    const convoText = recentMessages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const response = await client.messages.create({
      model: 'claude-haiku-4-20250414',
      max_tokens: 256,
      system: `Classify this conversation into a domain context. Return ONLY valid JSON with this structure:
{
  "domain": "<main topic area>",
  "subdomain": "<optional narrower category>",
  "context": "<optional specific situation>"
}

Common domains: email, scheduling, coding, sales, recruiting, writing, research, finance, health, education, general
Subdomains are optional narrower categories within the domain.
Context is an optional specific situation or project.

Examples:
- Drafting a fundraising email → {"domain": "email", "subdomain": "professional", "context": "fundraising"}
- Debugging React code → {"domain": "coding", "subdomain": "frontend", "context": "react"}
- Planning a meeting → {"domain": "scheduling"}
- General chat → {"domain": "general"}

Return ONLY the JSON object, nothing else.`,
      messages: [{ role: 'user', content: convoText }],
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return DEFAULT_CONTEXT;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    // Validate the result
    if (typeof parsed.domain !== 'string' || !parsed.domain) {
      return DEFAULT_CONTEXT;
    }

    const result: BrainContext = {
      domain: parsed.domain.toLowerCase(),
    };
    if (typeof parsed.subdomain === 'string' && parsed.subdomain) {
      result.subdomain = parsed.subdomain.toLowerCase();
    }
    if (typeof parsed.context === 'string' && parsed.context) {
      result.context = parsed.context.toLowerCase();
    }

    return result;
  } catch (err) {
    console.error('[brain] classifyBrainContext failed:', err);
    return DEFAULT_CONTEXT;
  }
}
