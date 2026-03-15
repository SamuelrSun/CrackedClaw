# Dopl Cloud — Audit Report
Generated: 2026-03-14

---

## 🔴 CRITICAL

### C1. Token bridge only refreshes Google OAuth
**File:** `src/app/api/gateway/token-bridge/route.ts`

The refresh logic is hardcoded to `https://oauth2.googleapis.com/token` using `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Any non-Google provider (GitHub, Notion, Slack, etc.) whose token is expired will be returned as-is — no refresh attempt, and may fail silently.

**Fix:** Either gate refresh behind `provider === 'google'` with an explicit comment, or implement per-provider refresh. Currently the code falls through and returns the stale token without error.

---

### C2. Missing env vars in .env.local (used in production code)
The following vars are referenced in `src/lib/` and/or `src/app/` but **absent from .env.local**:

| Env Var | Where Used | Risk |
|---|---|---|
| `BRAVE_API_KEY` | `src/lib/` | Web search tool will silently fail |
| `DEFAULT_MODEL` | `src/lib/` | Falls back to hardcoded default — may not be intended |
| `OPENAI_API_KEY` | `src/lib/` + `src/app/` | OpenAI calls will fail at runtime |
| `VOYAGE_API_KEY` | `src/lib/` + `src/app/` | Voyage embedding calls fail silently |
| `COMPANION_DMG_URL` | `src/app/` | Download link for companion app will be undefined |

**Note:** `VERCEL_URL` and `NODE_ENV` are Vercel/runtime-injected — fine to omit.

---

### C3. Trailing spaces in .env.local Stripe key names
`.env.local` lines 13–16 have trailing spaces after `STRIPE_STARTER_PRICE_ID`, `STRIPE_PRO_PRICE_ID`, `STRIPE_POWER_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET`. This means `process.env["STRIPE_STARTER_PRICE_ID "]` (with space) is the actual key — these values will be **undefined** at runtime.

**Fix:** Strip trailing spaces from those four lines.

---

## 🟡 WARNING

### W1. Companion API routes are self-contained orphans
**Dir:** `src/app/api/companion/`
- Contains: `auth.ts`, `conversations/route.ts`, `conversations/[id]/messages/route.ts`, `status/`
- The only references to `api/companion` within the codebase are **internal** (routes importing from their own `auth.ts`)
- No UI component, no mobile app code, no external client appears to call these endpoints

**Verdict:** These routes exist but nothing consumes them. Either the companion app was planned but never wired up, or this was the old CrackedClaw companion relay that's now replaced by the PM2 `companion-relay` process.
**Action:** Confirm whether `companion-relay` (PM2) calls these. If not, delete or document purpose.

---

### W2. PROVISIONING_SECRET vs PROVISIONING_API_SECRET mismatch
`src/lib/node/status.ts:52` uses:
```ts
process.env.PROVISIONING_API_SECRET || process.env.PROVISIONING_SECRET
```
`.env.local` only defines `PROVISIONING_API_SECRET`. The fallback `PROVISIONING_SECRET` is a dead alias — indicates a previous rename that wasn't fully cleaned up.

**Fix:** Remove the `|| process.env.PROVISIONING_SECRET` fallback once confirmed no server code still uses the old name.

---

### W3. No oc- instances provisioned on server
```
ssh root@164.92.75.153: ls /opt/openclaw-instances/ | grep oc-  → (empty / directory missing)
```
Either `/opt/openclaw-instances/` doesn't exist yet, or zero cloud instances have been provisioned. The provisioning API is running (PM2: `provisioning-api online`) but has never been exercised, or instances live elsewhere.

**Action:** Verify the instance storage path matches what the provisioning API expects. Check `do_server` / DigitalOcean for active droplets.

---

### W4. Only one Nginx site enabled
`/etc/nginx/sites-enabled/` contains only `openclaw-api`. If the multi-tenant architecture expects per-instance virtual hosts or subdomain routing, this is not yet set up.

---

## 🟢 CLEANUP

### CL1. Stale CrackedClaw branding in companion-app/dist/
The `companion-app/package.json` is correctly named `dopl-connect`, but the **built dist artifacts** still contain CrackedClaw:
```
companion-app/dist/builder-effective-config.yaml:
  appId: com.crackedclaw.connect
  productName: CrackedClaw Connect
```
Also in `companion-app/package-lock.json` (root `name` field): `"crackedclaw-connect"`.

**Fix:** Rebuild the companion app (the `package-lock.json` root `name` may need manual correction first). Add `companion-app/dist/` to `.gitignore` if it's build output.

No CrackedClaw references found in `src/` TypeScript files — clean ✓

---

### CL2. Duplicate entries in .env.local
`PROVISIONING_API_SECRET` and `PROVISIONING_API_URL` are each defined **twice** in `.env.local`. Node.js uses the last value, but it's a maintenance hazard.

---

### CL3. maton-services.ts is used but worth auditing
`src/lib/integrations/maton-services.ts` (111 lines) is imported by `registry.ts`. Not dead code. However, the name `maton-services` suggests a third-party or legacy dependency name — confirm this is intentional and documented.

---

## ✅ CONFIRMED CLEAN

| Area | Status |
|---|---|
| `get_integration_token` tool | ✅ Exists in `src/lib/agent/tools/integrations.ts` |
| `list_integrations` tool | ✅ Exists in same file |
| `memory_search` tool | ✅ Exists in `src/lib/agent/tools/memory.ts` |
| `memory_add` tool | ✅ Exists in same file |
| Token bridge secret validation | ✅ Validates `bridge_secret` against `TOKEN_BRIDGE_SECRET`, returns 401 on mismatch |
| `provisioningUrl` in connection-token route | ✅ Committed (no local diff), reads from `PROVISIONING_API_URL` env |
| PM2 server processes | ✅ All 4 online: provisioning-api, companion-relay, tool-api, anthropic-proxy |
| CrackedClaw in src/ | ✅ Zero references in TypeScript source files |
| router / resolver / maton-services imports | ✅ All actively imported and used |

---

## Priority Action List

1. **[CRITICAL]** Fix `.env.local` — add missing keys (`BRAVE_API_KEY`, `OPENAI_API_KEY`, `VOYAGE_API_KEY`, `COMPANION_DMG_URL`) and strip trailing spaces from Stripe keys
2. **[CRITICAL]** Add `provider === 'google'` guard to token bridge refresh logic, or document the limitation
3. **[WARNING]** Clarify companion API routes — delete or document who calls them
4. **[WARNING]** Confirm `/opt/openclaw-instances/` path and provision test instance end-to-end
5. **[CLEANUP]** Rebuild companion app to purge CrackedClaw from dist artifacts; add dist/ to .gitignore
6. **[CLEANUP]** Deduplicate `.env.local` entries; remove `PROVISIONING_SECRET` fallback alias
