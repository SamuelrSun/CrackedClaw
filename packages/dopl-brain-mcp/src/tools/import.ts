/**
 * src/tools/import.ts
 *
 * MCP tool: brain_import_memories
 *
 * Reads markdown file(s) from the local disk, extracts structured facts from
 * each section, and batch-imports them into the user's Dopl Brain.
 *
 * Parameters:
 *   - file_path (required): Path to a .md file or a directory containing .md files
 */

import * as fs from 'fs';
import * as path from 'path';
import { BrainApiClient, BrainApiError, ExtractedFact } from '../brain-api.js';

export const IMPORT_TOOL_DEFINITION = {
  name: 'brain_import_memories',
  description:
    'Import memories from a Markdown file or directory of Markdown files into your Dopl Brain. ' +
    'Sections (split by "## " headings) are extracted into structured facts and batch-imported. ' +
    'Duplicates are automatically skipped.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      file_path: {
        type: 'string',
        description:
          'Path to a .md file or directory containing .md files to import ' +
          '(e.g. "/Users/you/notes" or "/Users/you/notes/preferences.md")',
      },
    },
    required: ['file_path'],
  },
} as const;

export interface ImportInput {
  file_path: string;
}

/**
 * Collect all .md files from a path (file or directory).
 */
function collectMarkdownFiles(filePath: string): string[] {
  const resolved = path.resolve(filePath);
  const stat = fs.statSync(resolved);

  if (stat.isFile()) {
    if (resolved.endsWith('.md')) {
      return [resolved];
    }
    throw new Error(`File "${resolved}" is not a Markdown (.md) file.`);
  }

  if (stat.isDirectory()) {
    const entries = fs.readdirSync(resolved);
    const mdFiles = entries
      .filter((e) => e.endsWith('.md'))
      .map((e) => path.join(resolved, e))
      .filter((f) => fs.statSync(f).isFile());

    if (mdFiles.length === 0) {
      throw new Error(`No .md files found in directory "${resolved}".`);
    }
    return mdFiles;
  }

  throw new Error(`"${resolved}" is neither a file nor a directory.`);
}

/**
 * Split markdown content into sections by "## " headings.
 * Returns an array of non-empty section strings.
 */
function splitIntoSections(content: string): string[] {
  const rawSections = content.split(/^## /m);
  return rawSections
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function handleImport(
  client: BrainApiClient,
  input: ImportInput,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    // 1. Collect files
    let files: string[];
    try {
      files = collectMarkdownFiles(input.file_path);
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ brain_import_memories failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }

    // 2. Extract facts from each file's sections
    const allFacts: ExtractedFact[] = [];
    const errors: string[] = [];

    for (const filePath of files) {
      let content: string;
      try {
        content = fs.readFileSync(filePath, 'utf-8');
      } catch (err) {
        errors.push(`Could not read "${filePath}": ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }

      const sections = splitIntoSections(content);
      if (sections.length === 0) continue;

      for (const section of sections) {
        if (section.length < 10) continue; // skip trivially short sections

        try {
          const extractResponse = await client.extract({
            text: section,
            max_facts: 20,
          });

          if (extractResponse.facts && extractResponse.facts.length > 0) {
            allFacts.push(...extractResponse.facts);
          }
        } catch (err) {
          // Log extraction error but continue processing other sections
          errors.push(
            `Extract failed for section in "${path.basename(filePath)}": ` +
              (err instanceof BrainApiError ? err.message : String(err)),
          );
        }
      }
    }

    if (allFacts.length === 0) {
      const errMsg = errors.length > 0 ? `\n\nErrors:\n${errors.join('\n')}` : '';
      return {
        content: [
          {
            type: 'text',
            text: `No facts could be extracted from ${files.length} file(s).${errMsg}`,
          },
        ],
      };
    }

    // 3. Batch import all collected facts
    const importResponse = await client.import({
      facts: allFacts,
      deduplicate: true,
    });

    const lines = [
      `✅ Import complete!`,
      `   Files processed: ${files.length}`,
      `   Facts extracted: ${allFacts.length}`,
      `   Facts imported:  ${importResponse.imported}`,
      `   Duplicates skipped: ${importResponse.skipped_duplicates}`,
    ];

    if (errors.length > 0) {
      lines.push('', `⚠️  ${errors.length} warning(s) during extraction:`, ...errors.map((e) => `   • ${e}`));
    }

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  } catch (err) {
    const message =
      err instanceof BrainApiError ? err.message : `Unexpected error: ${String(err)}`;
    return {
      content: [{ type: 'text', text: `❌ brain_import_memories failed: ${message}` }],
    };
  }
}
