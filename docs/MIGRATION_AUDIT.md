# Migration Audit - OpenClaw → CrackedClaw Native

> Generated: 2026-03-09
> New stack: AgentRuntime (Anthropic SDK) + companion.crackedclaw.com WebSocket + Supabase pgvector

---

## 🔴 Must Fix (blocking/broken)

### Broken API Routes — still call provisioning-client

- `src/app/api/settings/ai/route.ts:3,27,36` — imports `getInstanceConfig`/`updateInstanceConfig` from provisioning-client; PUT returns 400 "No instance provisioned" for all users. **AI settings page is broken.** Fix: read/write model directly from Supabase `organizations` table.

- `src/app/api/settings/channels/route.ts:3,25,38,103,118,170,177` — same pattern, all handlers gate on `openclaw_instance_id`. **Channel settings are broken.** Fix: store channel config in Supabase directly.

- `src/app/api/organizations/provision/route.ts` — entire file calls `provisionInstance`/`getInstanceStatus`/`deleteInstance`. "Create My Agent" onboarding button calls POST here — **onboarding flow will fail** if provisioning API is down. Fix: stub to return immediate success (serverless agent needs no provisioning) or remove.

- `src/app/api/node/pre-pair/route.ts:47,69` — calls `PROVISIONING_API_URL/instances/.../pre-pair`. Old node pairing path; will fail. Fix: implement pre-pair against companion WebSocket server.

- `src/lib/node/status.ts:24,28,46-53` — `getNodeStatus()` reads `openclaw_gateway_url`/`openclaw_auth_token` and calls `PROVISIONING_API_URL/instances/.../nodes/status`. New nodes connect via WebSocket — this will always return offline. Fix: query companion API or Supabase `node_connections` table.

- `src/lib/node/browser-session.ts:41,57-58` — `sendBrowserCommand()` POSTs to `${node.gatewayUrl}/tools/invoke`. Old gateway endpoint. Browser now runs on DO server. Fix: route through `companion.crackedclaw.com/api/tools/execute`.

- `src/app/api/gateway/browser/novnc/route.ts:17-65` — reads `openclaw_gateway_url`, constructs noVNC URL from old gateway hostname. Fix: return DO server noVNC URL directly.

- `src/app/api/gateway/browser/screenshot/route.ts:12-46` — proxies screenshot request to old gateway URL. Fix: call companion API.

- `src/app/(app)/settings/workflows/client.tsx:47-144` — `gatewayUrl`/`authToken` state; calls `listGatewayCronJobs`/`createGatewayCronJob` etc. from old cron-client. Shows "no gateway" error for all users. Fix: Supabase-backed cron management.

- `src/lib/gateway/cron-client.ts` — entire file talks to old gateway REST + OpenAI chat (`model: "openclaw:main"`). Needs full replacement with Supabase cron management.

- `src/app/api/nodes/status/route.ts:17-24` — proxies to `openclaw_gateway_url/api/nodes/status`. Old architecture. Fix: query companion.

- `src/app/api/nodes/describe/route.ts:24-31` — same, proxies to old gateway.

- `src/app/api/nodes/pending/route.ts:15-78` — proxies node approve/reject to old gateway. Likely fully obsolete.

- `src/lib/workflows/builder.ts:6` — imports `sendGatewayMessage` from gateway-client; uses old chat endpoint to build workflows. Fix: use AgentRuntime.

---

## 🟡 Should Fix (user-facing but not broken)

### Onboarding copy is entirely wrong

- `src/app/onboarding/page-content.tsx:39,133,148-176,200,231,343,500,538,640,739` — "Provision a cloud OpenClaw instance" / "Connect Existing OpenClaw" / "Enter your OpenClaw gateway URL and authentication token" / "Syncing with your OpenClaw gateway". Rewrite to describe serverless agent + crackedclaw-connect.

### Tunnel setup page is obsolete

- `src/app/(app)/settings/tunnel-setup/page.tsx` — entire page for ngrok/tailscale to expose "local OpenClaw instance (port 18789)". New arch doesn't need this. Delete or repurpose for crackedclaw-connect setup.

### Old gateway UI in settings/chat

- `src/app/(app)/settings/client.tsx:63,174,213,244,314,328,349,589-646,796-871` — "Cloud Instance" status panel showing `openclaw_instance_id`/`openclaw_status`, manual gateway URL form, Provision/Delete buttons. Replace with companion status display.

- `src/app/(app)/chat/client.tsx:336-381,554-1607` — "Gateway Status" panel, "No Gateway Connected" banner, reconnect logic, `useGateway` hook. Since chat is now serverless/always connected, this entire flow is misleading. Replace with companion connection indicator.

- `src/app/(app)/settings/nodes/client.tsx:76,84,103,104` — `parseGatewayUrl()` defaults to `gateway.openclaw.io:443`. Reads `openclaw_gateway_url`. Update to read from companion.

### System prompt still references old CLI

- `src/lib/gateway/system-prompt.ts:22,27,28,50,72,73` — tells agent to run `openclaw skills list` and `openclaw skills install <name>`. Update to crackedclaw CLI commands or remove.

- `src/lib/gateway/system-prompt.ts:259,318-330` — fetches `openclaw_gateway_url` to build `gatewayHost` context. Update to companion URL.

### Branding fixes

- `src/components/layout/nav.tsx:28` — nav item text: "OpenClaw". Fix: "CrackedClaw".
- `src/components/layout/workspace-switcher.tsx:13-35,272` — type has `openclaw_*` fields; text "A new OpenClaw instance will be provisioned". Fix text.
- `src/components/empty-states/no-gateway.tsx:8` — title "Connect Your OpenClaw". Fix: "Connect Your Node".
- `src/app/dashboard-client.tsx:130,172` — "Connect OpenClaw" button, `agentName !== 'OpenClaw Agent'` check.
- `src/app/(app)/integrations/add/page-content.tsx:214` — webhook URL uses `api.openclaw.ai`. Fix: `api.crackedclaw.com`.
- `src/app/api/integrations/route.ts:31` — hardcoded `sam@openclaw.ai`. Remove.
- `src/app/api/gateway/connect/route.ts:94` — default name "My OpenClaw". Fix: "My CrackedClaw".
- `src/app/api/export/route.ts:73,101` and `src/app/(app)/settings/export/page.tsx:67` — filenames `openclaw-export-*`. Fix: `crackedclaw-export-*`.
- `src/lib/export.ts:147` — export type `"openclaw-export"`. Fix.
- `src/lib/ingestion/providers/messaging.ts:38,40,52,64` — scan instructions reference `~/openclaw.json`. Fix: update config path.
- `src/components/activity/activity-feed.tsx:41` — "start using OpenClaw". Fix: "CrackedClaw".
- `src/app/login/page.tsx:14` — demo email `demo@openclaw.cloud`.

### Companion status route uses localhost

- `src/app/api/companion/status/route.ts:5` — `RELAY_STATUS_URL = 'http://127.0.0.1:3201/status'`. This only works if relay runs on the same host as Next.js. For Vercel deployment, this should be `https://companion.crackedclaw.com/api/companion/status`. **Likely broken in production.**

### Minor

- `src/hooks/use-gateway.ts:227` — fallback `NEXT_PUBLIC_OPENCLAW_GATEWAY_URL` env var — probably not set.
- `src/app/api/gateway/chat/route.ts:54,60` and `stream/route.ts:59,65` — keep "Welcome to OpenClaw" as legacy title lookup (OK for backward compat, document it).
- `src/types/gateway.ts`, `src/types/nodes.ts`, `src/types/integration.ts`, `src/types/onboarding.ts` — file comments say "OpenClaw Cloud". Cosmetic.

---

## 🟢 OK (already migrated or not relevant)

- `src/lib/agent/runtime.ts` — ✅ Direct Anthropic SDK, no gateway
- `src/lib/agent/subagent.ts` — ✅ SDK subagent spawning
- `src/lib/agent/tools/` (all 7 files) — ✅ Direct integrations, no gateway
- `src/lib/memory/mem0-client.ts` — ✅ Supabase pgvector
- `src/lib/memory/service.ts` — ✅ Uses mem0-client
- `src/app/api/gateway/chat/route.ts` — ✅ Uses AgentRuntime (misleading name, correct impl)
- `src/app/api/gateway/chat/stream/route.ts` — ✅ Uses AgentRuntime with SSE streaming
- `src/app/api/gateway/status/route.ts` — ✅ Returns serverless "always connected" + companion check
- `src/app/api/gateway/subagents/route.ts` — ✅ Reads Supabase `agent_tasks`
- `src/app/api/gateway/messages/route.ts` — ✅ Reads Supabase
- `src/app/(app)/settings/connect/client.tsx` — ✅ Shows new `crackedclaw-connect` CLI with correct companion WebSocket URL
- `src/app/(app)/settings/node/page.tsx` — ✅ New node setup UI with correct connect command
- `src/app/api/cron/` — ✅ Supabase-backed cron
- `src/app/api/memory/` — ✅ Supabase memory
- `src/app/api/billing/` — ✅ Stripe, no gateway
- `src/app/api/auth/` — ✅ Supabase auth
- `src/lib/supabase/` (all) — ✅
- `src/lib/integrations/` (all) — ✅ OAuth-based
- `src/app/(app)/agents/` — ✅ New agents canvas
- `src/app/(app)/memory/` — ✅ Supabase memory
- `src/components/chat/` (most) — ✅ (chat/browser-popup.tsx, etc.)
- `src/app/api/conversations/` — ✅ Supabase
- `src/app/api/files/` — ✅ Supabase storage
- `src/app/api/search/` — ✅ Supabase
- `src/app/api/usage/` — ✅ Supabase
- `src/app/api/workflows/[id]/` — ✅ Supabase-backed
- `src/middleware.ts` — ✅ Supabase auth middleware
- `src/hooks/` (most) — OK except use-gateway.ts (has stale fallback)

---

## 📦 Files to Delete (unused / obsolete)

- **`src/lib/gateway-client.ts`** — OpenClaw HTTP gateway client. Callers: `api/gateway/memory`, `api/gateway/sync`, `lib/workflows/builder.ts`. Fix callers, then delete.

- **`src/lib/provisioning-client.ts`** — Instance provisioning API client. Callers: `api/settings/ai`, `api/settings/channels`, `api/organizations/provision`, `api/account/delete`. Fix callers, then delete.

- **`src/app/api/gateway/memory/route.ts`** — proxies to old gateway for memory. Memory is Supabase now. Delete.

- **`src/app/api/gateway/sync/route.ts`** — syncs integrations from old gateway. Integrations are OAuth in Supabase. Delete.

- **`src/app/api/gateway/test/route.ts`** — tests old gateway URL connection. No external gateway to test. Delete or return 410.

- **`src/app/(app)/settings/tunnel-setup/page.tsx`** — ngrok/tailscale guide for old local instance. Fully obsolete. Delete (and remove nav link).

- **`src/lib/gateway/cron-client.ts`** — old gateway cron REST/chat client. Replace with Supabase cron management.

- **`src/lib/gateway/subagent-client.ts`** — old gateway session proxy. Not used by new subagents route. Verify no imports, then delete.

- **`src/app/api/node/pre-pair/route.ts`** — old provisioning pre-pair. Assess if needed; likely not with new crackedclaw-connect flow.

- **`src/app/api/node/setup/route.ts`** — old node setup via `openclaw_auth_token`. Likely replaced by crackedclaw-connect. Verify and delete.

- **`src/app/api/nodes/pending/route.ts`** — node approve/reject via old gateway. Likely fully obsolete.

---

## Recommended Fix Order

1. `src/app/api/companion/status/route.ts` — fix localhost → companion.crackedclaw.com URL (**likely broken in prod now**)
2. `src/app/api/settings/ai/route.ts` — drop provisioning-client, use Supabase model field
3. `src/app/api/settings/channels/route.ts` — same
4. `src/app/api/organizations/provision/route.ts` — stub or remove
5. `src/lib/node/status.ts` — query companion instead of provisioning API
6. `src/lib/node/browser-session.ts` — route through companion tool server
7. `src/app/api/gateway/browser/novnc/route.ts` + `screenshot/route.ts` — use companion
8. `src/lib/gateway/system-prompt.ts` — remove openclaw CLI references, fix gatewayHost
9. `src/lib/workflows/builder.ts` — use AgentRuntime instead of sendGatewayMessage
10. Delete: `gateway-client.ts`, `provisioning-client.ts`, `gateway/memory`, `gateway/sync`, `gateway/test`, `tunnel-setup page`, `cron-client.ts`
11. Rewrite onboarding copy
12. Fix remaining branding (nav, empty states, export filenames, etc.)
