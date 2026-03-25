/**
 * src/resources/domains.ts
 *
 * MCP resource: brain://domains
 *
 * Returns a list of all knowledge domains in the user's Dopl Brain,
 * each with its fact count.
 */

import { BrainApiClient, BrainApiError } from '../brain-api.js';

export async function handleDomainsResource(
  client: BrainApiClient,
  uri: URL,
): Promise<{ contents: Array<{ uri: string; text: string; mimeType: string }> }> {
  try {
    const profile = await client.profile();

    const domains = profile.domains ?? [];

    if (domains.length === 0) {
      return {
        contents: [
          {
            uri: uri.href,
            text: 'No domains found in your Dopl Brain.\n\nStart adding memories with brain_remember to create domains.',
            mimeType: 'text/plain',
          },
        ],
      };
    }

    const lines: string[] = [
      `# Dopl Brain Domains`,
      ``,
      `${domains.length} domain${domains.length === 1 ? '' : 's'} found:`,
      ``,
    ];

    // Sort by fact count descending
    const sorted = [...domains].sort((a, b) => b.fact_count - a.fact_count);
    for (const domain of sorted) {
      lines.push(`- **${domain.domain}** (${domain.fact_count} fact${domain.fact_count === 1 ? '' : 's'})`);

    }

    const totalFacts = domains.reduce((sum, d) => sum + d.fact_count, 0);
    lines.push('', `**Total across all domains:** ${totalFacts} facts`);

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
          text: `Error loading domains: ${message}`,
          mimeType: 'text/plain',
        },
      ],
    };
  }
}
