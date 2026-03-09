# Environment Variables

This document lists all environment variables required for CrackedClaw (openclaw-cloud).

## Required

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public, safe for client) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public, safe for client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (**server-only**, never expose to client) |
| `ANTHROPIC_API_KEY` | Anthropic API key — used by AgentRuntime to call Claude directly on Vercel (serverless) |
| `NEXT_PUBLIC_APP_URL` | Full app URL, e.g. `https://crackedclaw.com` — used for OAuth callbacks and node setup scripts |

## Optional / Feature-Specific

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI key for embeddings (memory/search features). Optional if not using embeddings. |
| `BRAVE_API_KEY` | Brave Search API key for the `web_search` agent tool. Optional — web search gracefully degrades. |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID for Gmail/Calendar/Drive integrations |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `SLACK_CLIENT_ID` | Slack OAuth for Slack integration |
| `SLACK_CLIENT_SECRET` | Slack OAuth secret |
| `NOTION_CLIENT_ID` | Notion OAuth for Notion integration |
| `NOTION_CLIENT_SECRET` | Notion OAuth secret |

## Legacy / OpenClaw Provisioning (Can Be Removed)

These were used when CrackedClaw provisioned external OpenClaw instances.
The agent runtime now runs directly on Vercel — these are **no longer needed** unless
the provisioning flow is still active.

| Variable | Description | Status |
|---|---|---|
| `PROVISIONING_API_URL` | URL of the OpenClaw provisioning API server | **Legacy** — remove when provisioning flow is removed |
| `PROVISIONING_API_SECRET` | Bearer token for provisioning API | **Legacy** |
| `OPENCLAW_GATEWAY_URL` | Fallback gateway URL env var used in status/memory routes | **Legacy** |
| `OPENCLAW_GATEWAY_TOKEN` | Fallback gateway token env var | **Legacy** |

## DO Server (Companion/Tools)

| Variable | Description |
|---|---|
| `DO_SERVER_URL` | DigitalOcean server URL — agent tools (exec, browser) route here when companion is connected |
| `DO_SERVER_SECRET` | Shared secret for authenticating requests to the DO server |

## Stripe (Billing)

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key for billing |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRO_PRICE_ID` | Stripe price ID for the Pro plan |

## Mem0 (Optional Memory Layer)

| Variable | Description |
|---|---|
| `MEM0_API_KEY` | Mem0 API key for intelligent memory. Optional — memory works without it. |

---

## Notes

- Variables prefixed `NEXT_PUBLIC_` are bundled into the client-side JS. Never put secrets there.
- The app runs on Vercel (serverless). Set all secrets in the Vercel dashboard, not `.env.local` (which is local dev only).
- `.env.local` is gitignored. Never commit real secrets.
