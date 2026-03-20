/**
 * Communication style extractor.
 * Analyzes sample messages to extract Sam's writing patterns.
 * Results stored in user:communication mem0 domain.
 */

import { mem0GetAll } from '@/lib/memory/mem0-client';

export interface StyleModel {
  tone: 'formal' | 'casual' | 'direct' | 'warm' | 'mixed';
  avg_length: 'one_liner' | 'short_paragraph' | 'detailed';
  structure: 'hook_then_ask' | 'question_first' | 'context_then_ask' | 'direct_ask';
  personalization_depth: 'generic' | 'role_aware' | 'company_aware' | 'personal_signal';
  opener_patterns: string[];      // e.g. ["Hey {name},", "Hi {name} —"]
  avoided_phrases: string[];      // e.g. ["I hope this finds you well", "reaching out because"]
  cta_style: string;              // e.g. "15 min call", "quick chat", "thoughts?"
  signature: string;              // e.g. "Best, Sam" or "— Sam"
  sample_count: number;           // how many messages were analyzed
  extracted_at: string;
}

/**
 * Extract style model from sample messages using Claude.
 */
export async function extractStyleFromSamples(
  samples: string[],
  context?: string
): Promise<StyleModel> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const samplesText = samples
    .map((s, i) => `--- Message ${i + 1} ---\n${s}`)
    .join('\n\n');

  const systemPrompt = `You are a writing-style analyst. Analyze the provided message samples and extract the author's actual communication style patterns.

CRITICAL: Extract what is ACTUALLY THERE in the samples, not what generic "good outreach" looks like.
- If messages are casual, say casual. If they're formal, say formal.
- If messages are short, say one_liner or short_paragraph. Don't assume they should be long.
- Find the REAL opener patterns — exact phrasing the person uses.
- Find phrases they ACTUALLY DON'T USE (by absence) or explicitly avoid.
- Look at the actual CTA phrasing — what do they ask for?
- What's the real signature they use?

${context ? `Context about these messages: ${context}` : ''}

Analyze these dimensions:
1. **tone**: formal / casual / direct / warm / mixed — based on word choice, formality level, emoji use
2. **avg_length**: one_liner (1-2 sentences) / short_paragraph (3-6 sentences) / detailed (7+ sentences or multi-paragraph)
3. **structure**: how do messages flow?
   - hook_then_ask: opens with a hook/observation, then makes the ask
   - question_first: opens with a question
   - context_then_ask: provides context/intro first, then asks
   - direct_ask: immediately asks for what they want
4. **personalization_depth**:
   - generic: uses name but no company/role-specific info
   - role_aware: references their job title
   - company_aware: references their company specifically
   - personal_signal: references a specific thing they did/said/wrote/posted
5. **opener_patterns**: EXACT phrases used to open (preserve the style, use {name} as placeholder for names)
6. **avoided_phrases**: phrases that are conspicuously absent or would clash with this style
7. **cta_style**: the actual ask — "15 min call", "quick chat?", "open to connecting?", "thoughts?" etc.
8. **signature**: how do they sign off — "Best, Sam", "— Sam", no signature, etc.

Return ONLY a valid JSON object matching this exact schema:
{
  "tone": "casual",
  "avg_length": "short_paragraph",
  "structure": "hook_then_ask",
  "personalization_depth": "personal_signal",
  "opener_patterns": ["Hey {name},", "Hi {name} —"],
  "avoided_phrases": ["I hope this finds you well", "I wanted to reach out", "touching base"],
  "cta_style": "15-min call",
  "signature": "— Sam",
  "sample_count": ${samples.length},
  "extracted_at": "${new Date().toISOString()}"
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Analyze these ${samples.length} message sample(s) and extract the style model:\n\n${samplesText}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('Style extraction failed: no JSON in response');
  }

  const parsed = JSON.parse(match[0]) as Partial<StyleModel>;

  return {
    tone: parsed.tone ?? 'casual',
    avg_length: parsed.avg_length ?? 'short_paragraph',
    structure: parsed.structure ?? 'hook_then_ask',
    personalization_depth: parsed.personalization_depth ?? 'company_aware',
    opener_patterns: parsed.opener_patterns ?? [],
    avoided_phrases: parsed.avoided_phrases ?? [
      'I hope this message finds you well',
      'I wanted to reach out',
      'I came across your profile',
      'touching base',
      'circle back',
      'synergies',
      'leverage',
    ],
    cta_style: parsed.cta_style ?? 'quick chat',
    signature: parsed.signature ?? '',
    sample_count: samples.length,
    extracted_at: new Date().toISOString(),
  };
}

/**
 * Apply style model to draft a personalized message for a lead.
 */
export async function draftWithStyle(
  style: StyleModel,
  lead: {
    name: string;
    title: string;
    company: string;
    profile_data: Record<string, string>;
  },
  purpose: string,
  campaignContext?: string
): Promise<{ subject: string; body: string }> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const profileLines = Object.entries(lead.profile_data)
    .filter(([, v]) => v && v.trim() && !v.startsWith('http'))
    .slice(0, 8)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n');

  const openerPatternsStr = style.opener_patterns.length > 0
    ? style.opener_patterns.map((p) => `"${p}"`).join(' or ')
    : 'your natural opener';

  const avoidedStr = style.avoided_phrases.length > 0
    ? style.avoided_phrases.map((p) => `"${p}"`).join(', ')
    : 'none specified';

  const systemPrompt = `You are drafting an outreach message for ${lead.name} that sounds EXACTLY like a specific person's writing style.

## Style Constraints (follow EXACTLY)
- Tone: ${style.tone}
- Length: ${style.avg_length === 'one_liner' ? '1-2 sentences max' : style.avg_length === 'short_paragraph' ? '3-6 sentences, 1-2 short paragraphs' : 'detailed, multi-paragraph'}
- Structure: ${style.structure === 'hook_then_ask' ? 'Open with a specific hook or observation, then make the ask' : style.structure === 'question_first' ? 'Open with a question' : style.structure === 'context_then_ask' ? 'Provide brief context/intro, then make the ask' : 'Get straight to the ask'}
- Personalization: ${style.personalization_depth === 'personal_signal' ? 'Reference a SPECIFIC thing about this person — what they did, wrote, or posted' : style.personalization_depth === 'company_aware' ? 'Reference their specific company' : style.personalization_depth === 'role_aware' ? "Reference their role/title" : 'Keep it general but use their name'}
- Opener: Use a pattern like ${openerPatternsStr} (replace {name} with "${lead.name.split(' ')[0]}")
- CTA style: Ask for "${style.cta_style}" — use this exact phrasing or very close to it
- Signature: End with "${style.signature || '(no signature)'}"

## NEVER Use These Phrases
${avoidedStr}

## Lead Profile
Name: ${lead.name}
Title: ${lead.title || 'N/A'}
Company: ${lead.company || 'N/A'}
${profileLines ? `Additional info:\n${profileLines}` : ''}

## Purpose of Message
${purpose}
${campaignContext ? `\nCampaign context: ${campaignContext}` : ''}

Draft a message that sounds like the SAME PERSON who wrote those samples. Mirror their voice completely.
Do NOT sound like a generic AI. Do NOT pad the message. Keep exactly to the length constraints.

Return ONLY a JSON object:
{
  "subject": "subject line (short, conversational — or empty string for LinkedIn DMs)",
  "body": "the full message body"
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Draft a "${purpose}" message for ${lead.name} at ${lead.company || 'their company'}.`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('Draft generation failed: no JSON in response');
  }

  const parsed = JSON.parse(match[0]) as { subject: string; body: string };
  return {
    subject: parsed.subject ?? '',
    body: parsed.body ?? '',
  };
}

/**
 * Build a generic fallback style model for when no style has been extracted yet.
 */
export function buildFallbackStyle(): StyleModel {
  return {
    tone: 'casual',
    avg_length: 'short_paragraph',
    structure: 'hook_then_ask',
    personalization_depth: 'company_aware',
    opener_patterns: ['Hey {name},', 'Hi {name} —'],
    avoided_phrases: [
      'I hope this message finds you well',
      'I wanted to reach out',
      'I came across your profile',
      'touching base',
      'circle back',
      'synergies',
      'leverage',
    ],
    cta_style: 'quick chat',
    signature: '',
    sample_count: 0,
    extracted_at: new Date().toISOString(),
  };
}

/**
 * Parse a StyleModel from mem0 memories.
 * The style model is stored as a single JSON blob prefixed with "style_model:".
 */
export async function loadStyleModel(
  userId: string
): Promise<StyleModel | null> {
  try {
    const memories = await mem0GetAll(userId, 'user:communication');
    const styleEntry = memories.find((m) => {
      const content = m.memory ?? m.content ?? '';
      return content.startsWith('style_model:');
    });
    if (!styleEntry) return null;

    const content = styleEntry.memory ?? styleEntry.content ?? '';
    const jsonPart = content.slice('style_model:'.length);
    return JSON.parse(jsonPart) as StyleModel;
  } catch {
    return null;
  }
}
