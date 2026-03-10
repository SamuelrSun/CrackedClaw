import Anthropic from '@anthropic-ai/sdk';
import type { ExtractedEntity, UnifiedEntity } from './types';

export async function correlateEntities(
  allEntities: ExtractedEntity[],
  apiKey: string,
): Promise<UnifiedEntity[]> {
  if (allEntities.length === 0) return [];

  const client = new Anthropic({ apiKey });
  const entityList = JSON.stringify(allEntities, null, 2);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: 'You are an entity resolution engine. Given these entities extracted from a user\'s integrations (email, calendar, etc.), identify which ones refer to the SAME real-world thing and merge them into unified entities.\n\nENTITIES:\n' + entityList.substring(0, 50000) + '\n\nRules:\n- Same person with different email addresses = one entity\n- Same project mentioned in different contexts = one entity\n- Same company referenced by name and domain = one entity\n- Preserve ALL attributes from all sources\n- Note which sources confirm each entity\n- Identify relationships BETWEEN entities (person works at company, person works on project)\n\nOutput a JSON array:\n<unified>[{\"name\":\"...\",\"type\":\"...\",\"sources\":[\"gmail\",\"calendar\"],\"attributes\":{},\"relationships\":[{\"entity\":\"...\",\"relation\":\"...\"}],\"description\":\"...\"}]</unified>',
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  try {
    // Try XML tag format
    const xmlMatch = text.match(/<unified>([\s\S]*?)<\/unified>/);
    if (xmlMatch) {
      const parsed = JSON.parse(xmlMatch[1].trim());
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* continue to fallback */ }
  try {
    // Try markdown code block
    const codeMatch = text.match(/```(?:json)?\n([\s\S]*?)```/);
    if (codeMatch) {
      const parsed = JSON.parse(codeMatch[1].trim());
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* continue to fallback */ }
  try {
    // Try raw JSON array
    const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* all parsing failed */ }
  return [];
}
