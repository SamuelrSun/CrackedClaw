/**
 * src/prompts/import-memories.ts
 *
 * MCP prompt: import-memories
 *
 * Returns a prompt instructing the AI to scan a workspace directory for
 * Markdown files and import their contents into the user's Dopl Brain.
 *
 * Arguments:
 *   - workspace_path (optional): Path to scan for .md files. Defaults to "."
 */

export interface ImportMemoriesArgs {
  workspace_path?: string;
}

export function handleImportMemoriesPrompt(args: ImportMemoriesArgs): {
  messages: Array<{
    role: 'user' | 'assistant';
    content: { type: 'text'; text: string };
  }>;
} {
  const workspacePath = args.workspace_path ?? '.';

  const text = `Please import my memories from the workspace directory: ${workspacePath}

Use the brain_import_memories tool to scan for Markdown files and import their contents into my Dopl Brain.

Steps to follow:
1. Call brain_import_memories with file_path="${workspacePath}"
2. Report how many files were processed, how many facts were extracted and imported
3. Mention any warnings or errors that occurred
4. Suggest any follow-up actions (e.g. verifying with brain_recall, tagging by domain)

Be concise but thorough in your report.`;

  return {
    messages: [
      {
        role: 'user',
        content: { type: 'text', text },
      },
    ],
  };
}
