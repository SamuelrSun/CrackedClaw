# CrackedClaw OpenClaw Dependency Audit Report

**Date:** 2026-03-09
**Status:** Audit complete — no code removed yet (pending review)

---

## Summary

The codebase is in a **mixed state**. The core agent runtime has been migrated away from OpenClaw proxying — both chat routes now use `AgentRuntime` directly with Anthropic SDK. However, many **peripheral features still depend on OpenClaw gateway connections** (settings UI, workflows, node management, gateway sync) and the **provisioning flow still creates OpenClaw instances**.

**TypeScript: ✅ Passes clean (0 errors)**

---

## Step 1 & 2: OpenClaw Reference Audit

### ✅ ALREADY MIGRATED (No Action Needed)

**`src/app/api/gateway/chat/route.ts`**
- Uses `AgentRuntime` + `getTools()` directly
- No OpenClaw proxy code
- Saves to Supabase ✅

**`src/app/api/gateway/chat/stream/route.ts`**
- Uses `AgentRuntime` + streaming ✅
- No OpenClaw proxy

**`src/lib/agent/runtime.ts`** — Pure Anthropic SDK wrapper ✅
**`src/lib/agent/tools/index.ts`** — Clean tool registry ✅

---

### ⚠️ STILL PROXYING TO OPENCLAW

**`src/app/api/gateway/subagents/route.ts`**
- Reads `openclaw_gateway_url` + `openclaw_auth_token` from org
- Calls `listSubagents(gatewayUrl, gatewayToken)` — proxies to gateway
- **Issue:** Subagents panel will show empty/disconnected for most users
- **Fix needed:** Either remove, or source subagents from AgentRuntime/Supabase

**`src/app/api/gateway/status/route.ts`**
- Proxies to OpenClaw gateway for status
- Falls back to `OPENCLAW_GATEWAY_URL` env var
- **Issue:** "gateway not connected" still surfaced to UI
- **Fix:** Return always-connected mock since runtime is local (or check DO server)

**`src/app/api/gateway/messages/route.ts`**
- Proxies to `openclaw_gateway_url/api/messages`
- **Issue:** Will fail for all cloud users
- **Fix:** Read messages from Supabase `messages` table directly

**`src/app/api/gateway/sync/route.ts`**
- Syncs integrations from OpenClaw gateway
- Returns 400 "Please connect your OpenClaw first" if no gateway
- **Fix:** Either disable or read from Supabase integrations table

**`src/app/api/nodes/status/route.ts`**, **`describe/route.ts`**, **`pending/route.ts`**
- All proxy to `openclaw_gateway_url`
- These are for the paired node feature — fine to keep if gateway connection is optional

**`src/app/api/gateway/browser/screenshot/route.ts`**, **`novnc/route.ts`**
- Proxy to gateway for browser features
- Only work when node is connected — acceptable

**`src/lib/node/browser-session.ts`**
- Routes browser actions to `node.gatewayUrl`
- Fine — node-based feature

---

## Step 3: Provisioning Flow

**`src/app/api/organizations/provision/route.ts`**
- Still calls `provisionInstance()` from `provisioning-client.ts`
- Creates orgs with `openclaw_status`, `openclaw_instance_id`, `openclaw_gateway_url`
- **`PROVISIONING_API_URL`** env var is required and throws if missing at module load time (line 9: `throw new Error(...)`)
- **Issue:** This will crash at build/startup if `PROVISIONING_API_URL` is not set
- `.env.local` has it set to `http://164.92.75.153:3100` — currently operational

**Decision needed:** Keep provisioning (for cloud-hosted instances) or remove entirely?
- Current model appears to be: provision a remote OpenClaw instance → get gateway URL → use it
- This conflicts with "agent runtime runs on Vercel" — unless provisioning is for node pairing only

**`src/app/api/settings/ai/route.ts`**, **`channels/route.ts`**
- Read/write config via `getInstanceConfig(openclaw_instance_id)`
- Will silently fail (return defaults) if no instance — non-breaking

---

## Step 4: Gateway Status (UI Impact)

**`src/hooks/use-gateway.ts`**
- Polls `/api/gateway/status` every ~30s
- Shows "gateway not connected" banner when disconnected

**Fix recommendation:** Update `src/app/api/gateway/status/route.ts` to return `connected: true` by default (since runtime is serverless), optionally checking DO server health instead.

```typescript
// Quick fix for status route — return "always connected" for cloud users
if (!gatewayUrl) {
  return jsonResponse({
    connected: true,  // runtime is built-in on Vercel
    status: {
      agentName: "CrackedClaw Agent",
      model: "Claude Sonnet 4",
      uptime: "—",
      runtime: { os: "Vercel", node: "—", shell: "—" },
      capabilities: ["chat", "tools", "memory"],
    },
    isLive: true,
  });
}
```

---

## Step 5: Unused Files (Candidates for Removal)

These files are only useful when an OpenClaw gateway is connected — which is now optional:

| File | Status |
|---|---|
| `src/lib/gateway-client.ts` | Used by gateway status/sync routes — keep for node feature |
| `src/lib/provisioning-client.ts` | Used by provision/delete routes — **remove if dropping provisioning** |
| `src/lib/gateway/cron-client.ts` | Used by workflows — gateway-dependent feature |
| `src/lib/gateway/subagent-client.ts` | Used by subagents route — gateway-dependent |
| `src/app/api/gateway/messages/route.ts` | Should read from Supabase instead |
| `src/app/(app)/settings/tunnel-setup/page.tsx` | Guide for OpenClaw tunnel setup — may be outdated |

**Not safe to remove yet** (used by active UI features):
- All node routes (users can still connect nodes)
- gateway-client.ts (browser/VNC features)
- Settings client (gateway connect UI still present)

---

## Step 6: TypeScript

```
npx tsc --noEmit → ✅ 0 errors
```

---

## Step 7: Chat Flow (End-to-End Verification)

✅ Correct path:
1. `client.tsx` → POST `/api/gateway/chat/stream` (stream route preferred) or `/api/gateway/chat`
2. Route: auth → onboarding check → load history → build system prompt
3. `AgentRuntime.chat()` → Anthropic SDK → Claude claude-sonnet-4-20250514
4. Tool use: executes tools from `getTools(agentContext)` — currently tools route to DO server via `agentContext.companionConnected`
5. ⚠️ **Gap:** `companionConnected` is hardcoded `false` in both chat routes (line: `companionConnected: false`)
   - This means exec/browser tools will always run "serverless" — may not work as expected
   - Fix: check if user has a connected node and set `companionConnected: true`
6. Returns SSE stream or JSON response
7. Saves to Supabase `messages` table ✅
8. Async memory extraction via `processAgentResponse` ✅

---

## Step 8: Branding Audit

### Remaining "OpenClaw" in user-facing strings

| File | Content | Action |
|---|---|---|
| `settings/nodes/page.tsx` | `title: "Device Management - OpenClaw Cloud"` | → "CrackedClaw" |
| `settings/workflows/page.tsx` | `title: "Workflows - OpenClaw Cloud"` | → "CrackedClaw" |
| `settings/ai/page.tsx` | `title: "AI Provider Settings - OpenClaw Cloud"` | → "CrackedClaw" |
| `settings/channels/page.tsx` | `title: "Channel Settings - OpenClaw Cloud"` | → "CrackedClaw" |
| `settings/node/page.tsx` | `"Install OpenClaw on your Mac"` | → "Install CrackedClaw CLI" or keep as-is (it's the CLI name) |
| `settings/account/client.tsx` | `"delete the OpenClaw instance"` | → "CrackedClaw instance" |
| `settings/client.tsx` | `"Connect Your OpenClaw"`, `"My OpenClaw"` | → "CrackedClaw" |
| `tunnel-setup/page.tsx` | Multiple "OpenClaw" refs | Whole page likely outdated — review/remove |
| `gateway/status/route.ts` | `agentName: "OpenClaw Agent"` | → "CrackedClaw Agent" |
| `dashboard-client.tsx` | `!== 'OpenClaw Agent'` check | → "CrackedClaw Agent" |
| `login/page.tsx` | `email: "demo@openclaw.cloud"` | → demo@crackedclaw.com |
| `onboarding/page-content.tsx` | "Connect Existing OpenClaw", etc. | → "CrackedClaw" |
| `empty-states/no-gateway.tsx` | `"Connect Your OpenClaw"` | → "CrackedClaw" |
| `lib/node/browser-session.ts` | `'Please start OpenClaw on your local machine.'` | → "CrackedClaw" |
| `components/activity/activity-feed.tsx` | `'using OpenClaw'` | → "CrackedClaw" |
| `components/layout/nav.tsx` | `OpenClaw` (nav brand?) | → "CrackedClaw" |

### Keep as "openclaw" (technical references)
- `openclaw node run` — CLI command name (keep, it's the CLI)
- `npm install -g openclaw` — package name (keep)
- `openclaw skills install/list` — CLI commands (keep)
- DB column names: `openclaw_instance_id`, `openclaw_gateway_url`, etc. (DB migration required to change)
- `OPENCLAW_GATEWAY_TOKEN` env var in shell scripts (keep for CLI compatibility)
- Import paths, function names (internal)

---

## Step 9: Environment Variables

See `docs/ENV_VARS.md` (created).

**Key finding:** `provisioning-client.ts` throws at module load if `PROVISIONING_API_URL` is missing:
```typescript
const PROVISIONING_API_URL = process.env.PROVISIONING_API_URL;
if (!PROVISIONING_API_URL) {
  throw new Error("PROVISIONING_API_URL environment variable is required");
}
```
This will cause a 500 on any route that imports from it if the env var isn't set in production.

---

## Step 10: TypeScript

✅ `npx tsc --noEmit` passes with 0 errors.

---

## Recommended Priority Fixes

### High Priority (Breaking/Wrong Behavior)
1. **`companionConnected: false` hardcoded** in both chat routes — exec/browser tools won't reach DO server. Fix: check node status before building `agentContext`.
2. **`PROVISIONING_API_URL` throws if not set** — ensure this is set in Vercel prod dashboard or make the check non-fatal.
3. **Gateway status always shows disconnected** for users without a gateway — fix status route to return connected by default.

### Medium Priority (UX)
4. **`gateway/messages/route.ts`** — reads from OpenClaw, not Supabase. Should query `messages` table.
5. **Page titles** — 4 pages still say "OpenClaw Cloud" → "CrackedClaw"
6. **Settings client branding** — "Connect Your OpenClaw" → "CrackedClaw"

### Low Priority (Cleanup)
7. **`tunnel-setup/page.tsx`** — whole page may be outdated, review
8. **`login/page.tsx`** — demo email still `@openclaw.cloud`
9. **Onboarding page** — multiple "OpenClaw" strings in copy

---

## Files NOT Changed
No files were modified. This is an audit-only report. All findings are documented above.
