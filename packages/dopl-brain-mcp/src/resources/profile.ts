/**
 * src/resources/profile.ts
 *
 * MCP resource: brain://profile
 *
 * Returns the user's Dopl Brain profile including their name, total fact count,
 * and a breakdown of facts by domain.
 */

import { BrainApiClient, BrainApiError } from '../brain-api.js';

export async function handleProfileResource(
  client: BrainApiClient,
  uri: URL,
): Promise<{ contents: Array<{ uri: string; text: string; mimeType: string }> }> {
  try {
    const profile = await client.profile();

    const lines: string[] = [
      `# Dopl Brain Profile`,
      ``,
      `**Total Memories:** ${profile.fact_count ?? 0}`,
      `**Last Updated:** ${profile.last_updated ?? 'never'}`,
      ``,
    ];

    if (profile.domains && profile.domains.length > 0) {
      lines.push(`## Domains`);
      lines.push('');
      for (const domain of profile.domains) {
        lines.push(`- **${domain.domain}**: ${domain.fact_count} fact${domain.fact_count === 1 ? '' : 's'}`);
      }
    } else {
      lines.push('_No domains yet. Start adding memories with brain_remember!_');
    }

    return {
      contents: [
        {
          uri: uri.href,
          text: lines.join('\n'),
          mimeType: 'text/plain',
        },
      ],
    };
  } catch (err) {
    const message =
      err instanceof BrainApiError ? err.message : `Unexpected error: ${String(err)}`;
    return {
      contents: [
        {
          uri: uri.href,
          text: `Error loading Dopl Brain profile: ${message}`,
          mimeType: 'text/plain',
        },
      ],
    };
  }
}
