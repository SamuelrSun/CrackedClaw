/**
 * Template engine — generates outreach templates and personalizes messages.
 */

import type { CriteriaModel } from './criteria-engine';
import type { LeadScore } from './scoring-engine';

export interface OutreachTemplate {
  id: string;
  name: string;
  subject: string;       // email subject line (empty for LinkedIn)
  body: string;          // template with {{variables}}
  channel: 'email' | 'linkedin' | 'other';
  variables: string[];   // detected variable names
  created_at: string;
}

export interface PersonalizedMessage {
  lead_id: string;
  lead_name: string;
  subject: string;
  body: string;
  channel: string;
  variables_filled: Record<string, string>;
}

// ── Template generation ───────────────────────────────────────────────────────

export async function generateTemplate(
  criteria: CriteriaModel,
  campaignNotes: string,
  channel: 'email' | 'linkedin'
): Promise<OutreachTemplate> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const criteriaSummary = criteria.criteria
    .map((c) => `- ${c.description} (importance: ${c.importance.toFixed(2)})`)
    .join('\n');

  const systemPrompt = `Generate a concise, professional outreach message template for the following campaign.

Campaign purpose: ${campaignNotes || 'General outreach campaign'}
Target criteria:
${criteriaSummary}
Channel: ${channel}

The template should:
- Be warm but professional
- Reference something specific about the recipient (use {{variables}})
- Clearly state the purpose
- Be concise (under 150 words for LinkedIn, under 250 for email)
- Not feel automated or generic
- Include a clear, low-commitment call to action

Available variables: {{first_name}}, {{company}}, {{title}}, {{shared_interest}}, {{specific_detail}}

Return ONLY a JSON object:
{
  "name": "template name",
  "subject": "email subject (or empty string for LinkedIn)",
  "body": "the template text with {{variables}}",
  "channel": "${channel}",
  "variables": ["first_name", "company", ...]
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: 'Generate an outreach template for this campaign.',
      },
    ],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '{}';

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('Template generation failed: no JSON in response');
  }

  const parsed = JSON.parse(match[0]) as {
    name: string;
    subject: string;
    body: string;
    channel: string;
    variables: string[];
  };

  // Detect any additional {{variable}} patterns in the body
  const detectedVars = [...(parsed.body.matchAll(/\{\{(\w+)\}\}/g))].map(
    (m) => m[1]
  );
  const allVars = [...new Set([...(parsed.variables ?? []), ...detectedVars])];

  return {
    id: crypto.randomUUID(),
    name: parsed.name ?? 'Outreach Template',
    subject: parsed.subject ?? '',
    body: parsed.body ?? '',
    channel: (parsed.channel as 'email' | 'linkedin' | 'other') ?? channel,
    variables: allVars,
    created_at: new Date().toISOString(),
  };
}

// ── Message personalization ───────────────────────────────────────────────────

export async function personalizeMessage(
  template: OutreachTemplate,
  lead: LeadScore
): Promise<PersonalizedMessage> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const profileSummary = Object.entries(lead.profile_data)
    .filter(([, v]) => v && v.trim())
    .slice(0, 10)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n');

  const systemPrompt = `You are personalizing an outreach message template for a specific lead.

TEMPLATE:
Subject: ${template.subject}
Body:
${template.body}

Variables to fill: ${template.variables.join(', ')}

LEAD PROFILE:
Name: ${lead.name}
Score: ${lead.score}/100 (${lead.rank})
${profileSummary}

Fill in all {{variable}} placeholders with specific, contextual values based on the lead's profile.
- {{first_name}}: use their first name
- {{company}}: use their company name
- {{title}}: use their job title
- {{shared_interest}}: find a genuine connection point from their profile
- {{specific_detail}}: pick something impressive or notable from their background

Return ONLY a JSON object:
{
  "subject": "filled subject line",
  "body": "filled message body with all variables replaced",
  "variables_filled": {
    "first_name": "John",
    "company": "Acme Corp",
    ...
  }
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Personalize this template for ${lead.name}.`,
      },
    ],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '{}';

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`Personalization failed for ${lead.name}: no JSON in response`);
  }

  const parsed = JSON.parse(match[0]) as {
    subject: string;
    body: string;
    variables_filled: Record<string, string>;
  };

  return {
    lead_id: lead.lead_id,
    lead_name: lead.name,
    subject: parsed.subject ?? template.subject,
    body: parsed.body ?? template.body,
    channel: template.channel,
    variables_filled: parsed.variables_filled ?? {},
  };
}

// ── Batch personalization ─────────────────────────────────────────────────────

export async function personalizeMessages(
  template: OutreachTemplate,
  leads: LeadScore[],
  options?: { batchSize?: number }
): Promise<PersonalizedMessage[]> {
  const batchSize = options?.batchSize ?? 5;
  const results: PersonalizedMessage[] = [];

  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((lead) => personalizeMessage(template, lead))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.warn('Personalization error:', result.reason);
      }
    }
  }

  return results;
}
