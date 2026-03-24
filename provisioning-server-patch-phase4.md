# Provisioning Server Patch — Phase 4

## Summary

Phase 4 changes are **entirely within `src/lib/gateway/workspace.ts`** (the Next.js app). No changes are required to the DigitalOcean provisioning server's `server.js`.

## Why No DO Server Changes Are Needed

The DO provisioning server (`server.js`) is responsible for:
- Creating new Dopl instances (agent workspaces)
- Writing initial files (`SOUL.md`, `AGENTS.md`, `USER.md`, `INTEGRATIONS.md`, etc.)
- Proxying OpenClaw gateway setup

The marker-based memory system (`[[REMEMBER: key=value]]` / `[[FORGET: key]]`) was a **runtime parsing concern** — the gateway or app would parse agent output for these markers and act on them. Its removal from the templates means the agent simply won't emit those markers anymore. The DO server never parsed or depended on these markers during provisioning; it only wrote the template files.

Phase 3 already removed all `memory/YYYY-MM-DD.md` creation logic from the provisioning flow (writing initial daily note files, etc.). Phase 4 only:

1. Removed `[[REMEMBER]]` / `[[FORGET]]` lines from SPECIAL OUTPUT SYNTAX in `buildDoplSoul()`
2. Added "Important outcomes are auto-saved to your Brain" to the "After completing ANY task" section in `buildDoplSoul()`
3. Added concrete memory examples to `buildDoplAgents()`

None of these touch the provisioning server's responsibilities.

## Action Required

✅ **No DO server (`server.js`) changes needed for Phase 4.**

If the DO server previously had logic to parse `[[REMEMBER: key=value]]` output from agents and write to a memory store, that would be a separate cleanup task — but that parsing logic lives in the gateway/API layer, not in `server.js` provisioning.
