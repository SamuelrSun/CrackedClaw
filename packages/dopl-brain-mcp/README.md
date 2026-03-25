# dopl-brain-mcp

**MCP server for Dopl Brain — portable AI memory across tools.**

Dopl Brain is a persistent, semantic memory layer for AI assistants. It lets you store facts, preferences, decisions, and personal context in one place, then recall them across any tool that supports MCP. This package exposes Dopl Brain's capabilities as an [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server, making your memories available inside Claude Desktop, OpenClaw, and any other MCP-compatible client.

---

## Quick Setup

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dopl-brain": {
      "command": "npx",
      "args": ["-y", "dopl-brain-mcp"],
      "env": {
        "DOPL_BRAIN_TOKEN": "dpb_sk_your_token_here"
      }
    }
  }
}
```

Restart Claude Desktop. You'll see the Dopl Brain tools available in the tool picker.

### OpenClaw

Edit your `openclaw.json` (or per-instance config):

```json
{
  "mcpServers": {
    "dopl-brain": {
      "command": "npx",
      "args": ["-y", "dopl-brain-mcp"],
      "env": {
        "DOPL_BRAIN_TOKEN": "dpb_sk_your_token_here"
      }
    }
  }
}
```

Or if installed globally (`npm install -g dopl-brain-mcp`):

```json
{
  "mcpServers": {
    "dopl-brain": {
      "command": "dopl-brain-mcp",
      "env": {
        "DOPL_BRAIN_TOKEN": "dpb_sk_your_token_here"
      }
    }
  }
}
```

---

## Available Tools

| Tool | Description |
|------|-------------|
| `brain_recall` | Semantic search across all stored memories. Accepts `query`, optional `domain`, optional `limit`. |
| `brain_remember` | Store a new fact. Accepts `fact`, optional `domain`, optional `source`. |
| `brain_update` | Update an existing memory by ID. Accepts `id`, `content`. |
| `brain_forget` | Permanently delete a memory by ID. Accepts `id`. |
| `brain_import_memories` | Read local Markdown/text files, extract facts, and batch-import into the brain. Accepts `file_path` (file or directory), optional `max_facts_per_section`. |

---

## Available Resources

| Resource URI | Description |
|--------------|-------------|
| `brain://profile` | User profile: name, total fact count, domains, last updated. |
| `brain://recent` | 20 most recently relevant memories. |
| `brain://domains` | All knowledge domains with per-domain fact counts. |

---

## Available Prompts

| Prompt | Description |
|--------|-------------|
| `import-memories` | Guided prompt to import workspace files (MEMORY.md, memory/) into Dopl Brain. Accepts optional `workspace_path`. |
| `recall-context` | System instruction prompt: tells the AI to check Dopl Brain before answering personal questions. |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DOPL_BRAIN_TOKEN` | ✅ Yes | — | API token from [usedopl.com/settings](https://usedopl.com/settings). Format: `dpb_sk_xxx` |
| `DOPL_BRAIN_URL` | No | `https://usedopl.com` | Override the API base URL for local/self-hosted deployments |

---

## Memory Import Guide

### Import from OpenClaw workspace

The most common use case is importing your existing OpenClaw memory files:

```
User: Use the import-memories prompt
```

Or directly with the tool:

```
User: Use brain_import_memories to import /Users/me/.openclaw/workspace/MEMORY.md
User: Use brain_import_memories to import /Users/me/.openclaw/workspace/memory/
```

### How it works

1. **File reading**: The tool reads `.md` and `.txt` files from the specified path
2. **Splitting**: Content is split into sections by `## ` headers (H2), or by `---` separators if no H2s
3. **Extraction**: Each section is sent to the Dopl Brain extract API to pull out structured facts
4. **Import**: All extracted facts are batch-imported with automatic deduplication
5. **Summary**: Returns counts of imported facts, skipped duplicates, and any errors

### Supported file formats

- Markdown files (`.md`) — recommended
- Plain text files (`.txt`)
- Directories — all `.md` and `.txt` files are processed (non-recursive)

---

## Troubleshooting

### "DOPL_BRAIN_TOKEN is not set"

The server requires your Dopl Brain API token. Get it at [usedopl.com/settings](https://usedopl.com/settings) and add it to your MCP config's `env` block.

### "Network error reaching Dopl Brain API"

Check your internet connection. If you're behind a proxy or corporate firewall, you may need to configure it for `usedopl.com`.

### Tools not appearing in Claude Desktop

1. Check the `claude_desktop_config.json` syntax (it must be valid JSON)
2. Restart Claude Desktop completely (quit from the menu bar, not just close the window)
3. Check Claude Desktop logs at `~/Library/Logs/Claude/` for error details

### "Error loading profile" or similar resource errors

This usually means the token is invalid or expired. Verify your token at [usedopl.com/settings](https://usedopl.com/settings).

### Import found 0 facts

- Make sure the files contain actual text (not just headers/whitespace)
- Sections shorter than 50 characters are skipped automatically
- Try a specific file path instead of a directory

---

## Development

```bash
# Install dependencies
cd packages/dopl-brain-mcp
npm install

# Build
npm run build

# Run locally
DOPL_BRAIN_TOKEN=dpb_sk_xxx npm start
```

---

## License

MIT
