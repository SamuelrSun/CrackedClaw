# Dopl Brain MCP Server

Portable AI memory that works across tools. Connect your [Dopl Brain](https://usedopl.com) to Claude Desktop, Claude Cowork, OpenClaw, and any MCP-compatible AI client.

Your Brain remembers your preferences, decisions, and context — and makes them available everywhere you use AI.

## Quick Start

### Claude Desktop / Claude Cowork

1. Get your API token at [usedopl.com/settings](https://usedopl.com/settings)
2. Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

3. Restart Claude Desktop

### OpenClaw

Add to your `openclaw.json`:

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

## Tools

| Tool | Description |
|------|-------------|
| `brain_recall` | Search your Brain for relevant memories, preferences, or context |
| `brain_remember` | Store a new fact or preference |
| `brain_update` | Update an existing memory |
| `brain_forget` | Delete a memory |
| `brain_import_memories` | Import memories from local Markdown files (MEMORY.md, etc.) |

## Resources

| Resource | URI | Description |
|----------|-----|-------------|
| Profile | `brain://profile` | Your identity, preferences, and memory statistics |
| Recent | `brain://recent` | Memories added in the last 48 hours |
| Domains | `brain://domains` | Knowledge domains and fact counts |

## Prompts

| Prompt | Description |
|--------|-------------|
| `import-memories` | Guided flow to import existing OpenClaw workspace memories |
| `recall-context` | Instruction to check Brain before answering personal questions |

## Memory Import

If you have an existing OpenClaw workspace with `MEMORY.md` and `memory/*.md` files, you can import them:

1. Tell your AI: "Import my memories from /path/to/workspace"
2. The tool reads your local files, extracts structured facts, and imports them to your Brain
3. Duplicates are automatically detected and skipped
4. Your original files are **never modified** — Brain is additive

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DOPL_BRAIN_TOKEN` | Yes | — | API token from usedopl.com/settings |
| `DOPL_BRAIN_URL` | No | `https://usedopl.com` | Override API base URL |

## How It Works

The MCP server runs locally on your machine and communicates with the Dopl Brain API over HTTPS. Your AI client (Claude, OpenClaw, etc.) talks to the MCP server via stdio.

```
AI Client ←→ dopl-brain-mcp (local) ←→ Dopl Brain API (usedopl.com)
```

- Your files are read locally — only extracted facts are sent to the API
- All data is stored in your personal Brain on Dopl's servers
- One Brain, accessible from any MCP-compatible tool

## License

MIT
