# AUDIT: Database & Memory Integration
**Audited:** 2026-03-14  
**Scope:** Schema vs code alignment, Mem0/memory system, OAuth flows, token storage, chat push endpoint, agent tools

---

## 1. Schema vs Code — Table Coverage

**Tables in schema (35 total):**
```
account_deletion_log, activity_log, agent_instances, agent_messages, agent_tasks,
context_gathering_jobs, conversation_links, conversations, cron_jobs,
file_chunks, files, installed_skills, instructions, integrations,
memories, memory_entries, messages, oauth_flows, profiles,
scan_logs, token_usage, usage_history, user_context, user_gateways,
user_integrations, user_secrets, user_usage, worker_activity, workers,
workflow_memory, workflow_runs, workflows
```

**Tables referenced in code:** All of the above appear in `.from()` calls in `src/`.

**⚠️ DISCREPANCY — `memory_entries` vs `memories`:**
- Schema has BOTH `memories` and `memory_entries` tables.
- `mem0-client.ts` exclusively uses `memories` (with pgvector).
- `memory_entries` appears in `.from()` calls in code — likely a legacy/duplicate table.
- **Risk:** If any code paths write to `memory_entries` instead of `memories`, data will be split across two tables and vector search will miss it. Audit which files use `memory_entries` and whether it's intentional or a stale name.

---

## 2. Memory System (Mem0 / Self-Hosted)

**Was Mem0 cloud API — now self-hosted via pgvector.**

### Architecture
- `src/lib/memory/mem0-client.ts` — fully self-hosted, NO external Mem0 API calls
- Uses **Supabase pgvector** (`match_memories` RPC) for vector similarity search
- Embeddings via **OpenAI** (`text-embedding-3-small`) or **Voyage AI** as fallback
- Memory extraction uses **Claude** (`claude-sonnet-4-20250514`)
- Deduplication at 0.9 cosine similarity threshold

### Required Environment Variables
| Variable | Purpose | Required? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase endpoint | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin access | ✅ Yes |
| `ANTHROPIC_API_KEY` | Memory extraction via Claude | ✅ Yes |
| `OPENAI_API_KEY` | Embeddings (preferred) | ⚠️ Optional — degrades to text search |
| `VOYAGE_API_KEY` | Embedding alternative | ⚠️ Optional |

**No `MEM0_API_KEY` or `MEM0_BASE_URL` — this is 100% self-hosted.**

### Graceful Degradation
- `isMem0Enabled()` returns `true` always — memory is always on
- Without `OPENAI_API_KEY` or `VOYAGE_API_KEY`: falls back to `ILIKE` text search (no vector similarity)
- Memory extraction (Claude) will fail without `ANTHROPIC_API_KEY` — `mem0Add` will silently return `[]`

### Is memory called from system prompt?
- **No `system-prompt.ts` file found** — the `src/lib/agent/` directory only has `runtime.ts`, `subagent.ts`, and `tools/`
- Memory is injected at the **tool level**: agent calls `memory_search` / `memory_add` tools explicitly
- `autoAddMemory()` in `tools/memory.ts` can be called post-conversation to persist facts
- ✅ **Works**, but memory is agent-driven (tool calls), not auto-injected into every prompt context

### ⚠️ Issues
1. **`memory_entries` table** — never used by the current memory client; may be a leftover schema artifact or used elsewhere
2. **Claude model hardcoded** as `claude-sonnet-4-20250514` in `extractMemories()` — will break if this model is deprecated
3. **`mem0Add` silently fails** if `ANTHROPIC_API_KEY` missing — no user-visible error

---

## 3. OAuth Flow

### Providers Configured (14 providers)
`google`, `slack`, `notion`, `github`, `microsoft`, `linear`, `discord`, `zoom`, `twitter`, `hubspot`, `jira`, `figma`, `reddit`

### Flow Architecture
1. `GET /api/integrations/oauth/start` → validates provider, checks env credentials, generates state, redirects to provider
2. Provider → `GET /api/integrations/oauth/callback` → verifies state, exchanges code for tokens, fetches user info, stores in `user_integrations`

### Token Refresh
✅ **Token refresh is implemented** in `src/lib/agent/tools/integrations.ts`:
- Checks `token_expires_at` with a 5-minute buffer
- Calls `refreshOAuthToken()` if near-expiry before returning token
- Writes refreshed token back to `user_integrations`

**⚠️ Google-only refresh:** `refreshOAuthToken()` only handles `provider === 'google'`. Microsoft token refresh is stubbed with a comment ("Add Microsoft refresh here if needed") but **not implemented**. All other providers (Slack, GitHub, etc.) will fail silently if their access token expires.

### Missing Env Var Check
`getCallbackUrl()` logs a `console.error` if `NEXT_PUBLIC_APP_URL` is not set but does NOT throw — OAuth redirect will use `VERCEL_URL` or `localhost:3000` as fallback. ✅ Acceptable but worth setting explicitly.

---

## 4. `user_integrations` Table Usage

### How tokens are stored
- Tokens stored in `user_integrations` with columns: `access_token`, `refresh_token`, `token_expires_at`, `account_email`, `is_default`, `status`, `metadata`
- Multiple accounts per provider supported (multi-account OAuth)
- `is_default` flag used to pick the primary account

### How tokens are retrieved
- `src/lib/agent/tools/integrations.ts` → `getValidToken()` and `getAllAccountTokens()` 
- Fetches from `user_integrations` where `status = 'connected'`
- Refreshes Google tokens inline before returning
- `token-bridge` endpoint (`/api/gateway/token-bridge/route.ts`) also reads/updates `user_integrations` for OpenClaw gateway use

### ⚠️ Issues
1. **Non-Google providers have no token refresh** — if Slack/GitHub/etc. tokens expire, agent will get a 401 from the provider API with no auto-recovery
2. **Token stored in plaintext** in Supabase — consider Supabase Vault or `user_secrets` table for encryption (schema has `user_secrets` but integrations.ts doesn't use it)

---

## 5. Chat Push Endpoint (`/api/chat/push`)

✅ **EXISTS** at `src/app/api/chat/push/route.ts`

### How it works
- `POST /api/chat/push` accepts: `conversation_id`, `content`, `push_secret`, `task_label`, `task_id`, `user_id`
- Validates against `CHAT_PUSH_SECRET` env var (required — throws if missing)
- Inserts message into `messages` table with role `assistant`
- Updates `conversations.updated_at` to trigger Supabase Realtime
- Updates `agent_tasks` record to `completed` status (by `task_id` or by matching `task_label + user_id`)

### ⚠️ Issues
1. **`CHAT_PUSH_SECRET` is required** — if not set, every push request will 500. Must be in env.
2. **Supabase Realtime** must be enabled on the `messages` table for UI to update live
3. No authentication beyond the shared secret — anyone who knows the secret can inject messages into any conversation

---

## 6. Agent Tools

### Tool Registry (`src/lib/agent/tools/index.ts`)
All tools are **real implementations** (not just prompt descriptions):

| Tool | File | Implementation |
|---|---|---|
| `exec` | `tools/exec.ts` | Shell execution |
| `browser` | `tools/browser.ts` | Browser automation |
| `file_read` / `file_write` | `tools/files.ts` | File I/O |
| `web_search` / `web_fetch` | `tools/web.ts` | Web access |
| `memory_search` / `memory_add` | `tools/memory.ts` | → `mem0-client.ts` |
| `get_integration_token` | `tools/integrations.ts` | Token fetch + refresh |
| `list_integrations` | `tools/integrations.ts` | Lists connected accounts |
| `scan_integration` | `tools/integrations.ts` | Deep scan via `engine/v2` |
| `gmail_*` (4 tools) | `tools/gmail.ts` | Gmail-specific operations |

**These are actual tool implementations**, not OpenClaw gateway stubs. The agent runtime dispatches them directly.

---

## Summary: Critical Issues

| # | Issue | Severity |
|---|---|---|
| 1 | Token refresh only works for Google — all other providers will fail silently on expiry | 🔴 High |
| 2 | `memory_entries` table in schema unused by memory client — potential data split | 🟡 Medium |
| 3 | `CHAT_PUSH_SECRET` env var required but undocumented — will 500 if missing | 🟡 Medium |
| 4 | Access tokens stored plaintext — `user_secrets` table exists but unused | 🟡 Medium |
| 5 | Claude model hardcoded in `extractMemories()` — breaks if model deprecated | 🟡 Medium |
| 6 | Without `OPENAI_API_KEY`: memory degrades to text search, no semantic matching | 🟢 Low (by design) |
| 7 | No system-prompt-level memory injection — memory only available via explicit tool calls | 🟢 Low (by design) |

## Required Environment Variables (Full List for DB/Memory to function)
```
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
OPENAI_API_KEY          # or VOYAGE_API_KEY for embeddings
CHAT_PUSH_SECRET        # required for subagent push endpoint
NEXT_PUBLIC_APP_URL     # for OAuth callbacks
GOOGLE_CLIENT_ID/SECRET # if Google OAuth used
# ... other provider keys as needed
```
