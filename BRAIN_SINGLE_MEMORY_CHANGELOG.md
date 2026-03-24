# Brain Single Memory System — Full Changelog

**Branch:** `feat/brain-single-memory-system`  
**Date:** March 24, 2026  
**Scope:** Consolidate all agent memory into Brain (Mem0); eliminate daily note files, legacy markers, and scattered memory writes.

---

## Overview

Before this work, Dopl agents had a fragmented memory system:
- `memory/YYYY-MM-DD.md` daily note files in the workspace
- `[[REMEMBER: key=value]]` / `[[FORGET: key]]` output markers for inline memory writes
- `MEMORY_CONTEXT.md` that was stale and never auto-refreshed
- No automatic session summarization
- Agents had to manually maintain files to persist context

After this work, **Brain is the single memory system**:
- `MEMORY_CONTEXT.md` is auto-generated from Brain and refreshed at the start of every conversation
- Sessions are automatically summarized after each chat turn and stored in Brain
- No more daily note files, no more `[[REMEMBER]]` markers
- Agents just have conversations; memory persists automatically

---

## Phase 1 — Enrich MEMORY_CONTEXT.md with Recent Context + Session Summaries

**Commit:** `6812e44`

### What Changed
- **`src/lib/gateway/workspace.ts`** — `refreshMemoryContextIfNeeded()` completely rewritten:
  - Was: wrote a stub/stale file, never updated
  - Now: queries Mem0 for top-15 relevant memories + last 5 session summaries, writes a rich `MEMORY_CONTEXT.md` with `## Recent Context` and `## Session History` sections
  - Staleness check: file refreshed if > 5 minutes old (configurable)
  - Fire-and-forget: runs async, never blocks a chat request
- **`src/lib/memory/mem0-client.ts`** — added `getSessionSummaries(userId, limit)` helper to query session summary memories by type tag
- **All 3 chat routes** wired up with fire-and-forget refresh at the top of the handler:
  - `src/app/api/gateway/chat/stream/route.ts` — `import { refreshMemoryContextIfNeeded }` + call
  - `src/app/api/gateway/chat/v2/route.ts` — same
  - `src/app/api/gateway/chat/route.ts` — same

### Files Modified
- `src/lib/gateway/workspace.ts`
- `src/lib/memory/mem0-client.ts`
- `src/app/api/gateway/chat/stream/route.ts`
- `src/app/api/gateway/chat/v2/route.ts`
- `src/app/api/gateway/chat/route.ts`

---

## Phase 2 — Auto Session Summary Extraction After Chat Turns

**Commit:** `6f70ade`

### What Changed
- **`src/app/api/memory/session-summary/route.ts`** — new API endpoint created:
  - Accepts `POST { userId, messages, sessionId }`
  - Calls an LLM to extract a concise summary of the conversation turn
  - Stores summary in Mem0 with `type: "session_summary"` tag
  - Rate-limited: skips if fewer than 2 messages or if summary already exists for this sessionId
- **All 3 chat routes** wired up with fire-and-forget `fetch` call to `/api/memory/session-summary` after assistant response is complete:
  - `src/app/api/gateway/chat/stream/route.ts`
  - `src/app/api/gateway/chat/v2/route.ts`
  - `src/app/api/gateway/chat/route.ts`

### Pattern Used (all 3 routes)
```typescript
fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://usedopl.com'}/api/memory/session-summary`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: user.id, messages: [...], sessionId }),
}).catch(() => {});
```

### Files Modified
- `src/app/api/memory/session-summary/route.ts` *(new)*
- `src/app/api/gateway/chat/stream/route.ts`
- `src/app/api/gateway/chat/v2/route.ts`
- `src/app/api/gateway/chat/route.ts`

---

## Phase 3 — Remove Daily Notes; Brain as Single Memory System

**Commit:** `316640e` (cowork phase interspersed — brain changes are `0dbbe84`)

**Commit:** `0dbbe84`

### What Changed
- **`src/lib/gateway/workspace.ts`** — removed all daily-note logic:
  - Deleted `writeDailyNote()` function
  - Deleted calls to `writeDailyNote()` in workspace builder
  - Removed `memory/YYYY-MM-DD.md` path construction and file creation
  - `buildDoplAgents()` template updated: Memory section rewritten to describe Brain as single memory system; removed "log summary to memory/YYYY-MM-DD.md" instructions
  - `buildDoplSoul()` template updated: removed "workspace files are your memory" Continuity section
- **`provisioning-server-patch.md`** — created as a patch guide for the DO provisioning server:
  - Documents all 5 changes needed to `server.js` on `164.92.75.153`
  - Provides Python scripts to apply each change safely
  - Covers: SOUL.md continuity section, AGENTS.md Every Session list, Memory section, Brain description, Heartbeat proactive section

### Files Modified
- `src/lib/gateway/workspace.ts`
- `provisioning-server-patch.md` *(new)*

---

## Phase 4 — Enhance memory_add/memory_search; Remove Legacy Markers

**Commit:** `60dc03f`

### What Changed
- **`src/lib/gateway/workspace.ts`**:
  - `buildDoplSoul()`: removed `[[REMEMBER: key=value]]` and `[[FORGET: key]]` from SPECIAL OUTPUT SYNTAX section; added "Important outcomes are auto-saved to your Brain" to task completion instructions
  - `buildDoplAgents()`: updated Memory section with concrete `memory_add` / `memory_search` examples showing correct call syntax
  - Agents no longer instructed to emit inline memory markers — Brain is populated automatically via session summaries and explicit `memory_add` tool calls
- **`provisioning-server-patch-phase4.md`** — created to document why **no DO server changes are needed** for Phase 4 (marker parsing was a gateway concern, not provisioning)

### Files Modified
- `src/lib/gateway/workspace.ts`
- `provisioning-server-patch-phase4.md` *(new)*

---

## Phase 5 — Surface Session Summaries in Brain UI

**Commit:** `2488028`

### What Changed
- **`src/app/(app)/brain/client.tsx`** — Brain UI enhanced:
  - Added "Session History" section to the Brain page, showing the last N session summaries stored in Mem0
  - Summaries displayed with timestamps, expandable content, grouped by date
  - Fetches from the same Mem0 query used by `refreshMemoryContextIfNeeded()`
  - Empty state handled gracefully

### Files Modified
- `src/app/(app)/brain/client.tsx`

---

## Phase 6 — Final Cleanup + Verification

**Commit:** This commit (changelog + verification)

### What Verified
- ✅ All 3 chat routes have `refreshMemoryContextIfNeeded()` imported and called fire-and-forget
- ✅ All 3 chat routes have the `/api/memory/session-summary` fire-and-forget fetch
- ✅ Zero grep results for `memory/YYYY`, `memory/2026`, `memory/2025` in `workspace.ts`
- ✅ Zero grep results for `[[REMEMBER:` in `workspace.ts`
- ✅ Zero grep results for `memory/YYYY` in `src/app/`
- ✅ No `mkdir`/`create`/`write` for `memory/` paths in `src/lib/gateway/`
- ✅ TypeScript build: zero errors (`npx tsc --noEmit` clean)

### DO Provisioning Server — `memory/` Directory
The workspace.ts code no longer creates a `memory/` directory or any files within it. The DO provisioning server (`server.js` on `164.92.75.153`) may still create a `memory/` directory or seed a `memory/YYYY-MM-DD.md` file when provisioning new instances.

**Action required (DO server):** Apply `provisioning-server-patch.md` to remove all `memory/` directory creation and `memory/YYYY-MM-DD.md` references from `server.js`. The patch includes a full all-in-one Python script to apply all 5 changes safely.

---

## DO Server Patch Files

| File | Purpose |
|------|---------|
| `provisioning-server-patch.md` | Phase 3 patch — removes daily notes, rewrites Memory section in AGENTS.md template, updates SOUL.md Continuity section. **Must be applied to `server.js` on `164.92.75.153`.** |
| `provisioning-server-patch-phase4.md` | Phase 4 — documents that NO server.js changes are needed for marker removal (markers were gateway-layer, not provisioning-layer). |

---

## Impact on Users

### Existing Users (instances already provisioned)
- **Immediate benefit:** `MEMORY_CONTEXT.md` is now auto-refreshed at the start of each conversation with their latest Brain memories + session history. No action required.
- **Session summaries:** Will start accumulating from their next conversation onward. Historical sessions before this deployment are not back-filled.
- **Daily note files:** If they have existing `memory/YYYY-MM-DD.md` files in their workspace, those are orphaned but harmless. Agents will no longer write to them or reference them.
- **AGENTS.md/SOUL.md templates:** Existing instances already have these files provisioned with the old instructions. They will not be automatically updated. If old instructions tell agents to write daily notes, agents on those instances may still try. To fully migrate an existing user, re-provision or manually update their `AGENTS.md`.

### New Users (provisioned after DO server patch is applied)
- **Clean state:** No `memory/` directory created, no daily note instructions in `AGENTS.md`, Brain-first memory instructions from day one.
- **Automatic memory:** Everything works out of the box — MEMORY_CONTEXT.md refreshes, session summaries accumulate, Brain UI shows history.

---

## Migration Notes

1. **Apply `provisioning-server-patch.md` to DO server** as soon as possible to ensure new instances get the correct templates.
2. **Existing users' AGENTS.md files** (already on disk in their workspaces) still contain old memory instructions. To fully migrate: either update them manually via the admin panel or accept that they'll naturally drift toward Brain-only behavior as agents stop finding daily notes useful.
3. **Back-filling session summaries** for existing users is not necessary — the system starts fresh and builds history from the current date forward. The Brain UI will show "No session history yet" until the first post-deploy conversation.
4. **`memory/` directories** in existing workspaces can be cleaned up with a one-time migration script if desired, but are not harmful to leave in place.

---

## Summary of All Modified Files

| File | Phases | Change Type |
|------|--------|-------------|
| `src/lib/gateway/workspace.ts` | 1, 3, 4 | Rewrote `refreshMemoryContextIfNeeded`, removed daily notes, removed `[[REMEMBER]]` markers |
| `src/lib/memory/mem0-client.ts` | 1 | Added `getSessionSummaries()` helper |
| `src/app/api/gateway/chat/stream/route.ts` | 1, 2 | Added memory refresh + session summary fetch |
| `src/app/api/gateway/chat/v2/route.ts` | 1, 2 | Added memory refresh + session summary fetch |
| `src/app/api/gateway/chat/route.ts` | 1, 2 | Added memory refresh + session summary fetch |
| `src/app/api/memory/session-summary/route.ts` | 2 | New endpoint — extracts + stores session summaries |
| `src/app/(app)/brain/client.tsx` | 5 | Shows session summaries in Brain UI |
| `provisioning-server-patch.md` | 3 | DO server patch guide (Phase 3 — daily notes removal) |
| `provisioning-server-patch-phase4.md` | 4 | Documents Phase 4 requires no DO server changes |
