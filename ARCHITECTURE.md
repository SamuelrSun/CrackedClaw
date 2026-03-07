# OpenClaw Cloud — Architecture

## Dynamic Integrations System

### Core Principle
The UI is a **view** of database state, not a constraint on capabilities.
The agent can modify anything the user can click.

### Integration Types

| Type | Access Method | Examples |
|------|---------------|----------|
| `oauth` | Standard OAuth + API | Google, Slack, Notion, GitHub |
| `api_key` | API key authentication | OpenAI, Stripe |
| `browser` | Puppeteer/Playwright + CV | LinkedIn, Granola (no API) |
| `file` | Local/cloud file sync | Obsidian vault, Dropbox |
| `webhook` | Incoming webhooks | Stripe events, custom triggers |
| `hybrid` | Pipeline: scrape → transform → store | Granola → CV → Sheets → Memory |

### Integration Schema

```typescript
interface Integration {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  icon: string;  // emoji or URL
  type: "oauth" | "api_key" | "browser" | "file" | "webhook" | "hybrid";
  status: "disconnected" | "connected" | "error";
  
  config: {
    // OAuth
    oauth_provider?: string;
    scopes?: string[];
    
    // API Key
    api_key_name?: string;
    base_url?: string;
    
    // Browser automation
    target_url?: string;
    login_required?: boolean;
    scrape_instructions?: string;
    
    // Hybrid pipeline
    pipeline?: PipelineStep[];
  };
  
  accounts: IntegrationAccount[];
  created_at: timestamp;
  updated_at: timestamp;
}

interface PipelineStep {
  type: "browser_scrape" | "cv_extract" | "api_call" | "transform" | "store";
  config: Record<string, any>;
}
```

### Agent Capabilities

The agent can:
1. **Create integrations** — INSERT into integrations table
2. **Modify workflows** — Create/update workflow configs
3. **Edit memory** — Add/update memory entries
4. **Run pipelines** — Execute browser automation, CV extraction

### UI Components

1. **Connected Sources** — Dynamic list from DB, not hardcoded
2. **Add Source** — Wizard/chat to create any integration
3. **Pipeline Builder** — Visual editor for hybrid pipelines
4. **Credentials Vault** — Secure storage for API keys, OAuth tokens
