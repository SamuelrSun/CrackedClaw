# Onboarding V1 — Conversational Landing Page

Built 2026-03-08. Shelved due to OAuth redirect issues with Supabase. Ready to revive.

## What This Is

A fully conversational landing page that replaces the static hero. The user has a real AI-powered chat
conversation before signing up — capturing their name, what to call the agent, and their use case — then
signs up inline. The agent is pre-seeded with that context on first launch.

## How It Works

1. **Landing page** (`components/LandingPage.tsx`) — animated typewriter hero, then live chat UI
2. **AI responses** — real Claude Haiku streaming via `/api/landing-chat` (scoped system prompt, 3-4 msg max)
3. **Name extraction** — Claude Haiku reads natural language and returns `{userName, agentName}` as JSON
4. **Inline auth** — `components/AuthCard.tsx` renders inside the chat with Google, GitHub, email/password
5. **Post-auth provisioning** — `/provision` page (client-side) calls provision API then redirects to /chat
6. **Workspace seeding** — provision API passes context to DigitalOcean provisioning server, which writes
   USER.md, MEMORY.md, SOUL.md into the instance workspace before OpenClaw starts

## Known Issue (Why It Was Shelved)

**Google OAuth redirect loop** — After Google OAuth, users return to home page instead of /chat.
Root cause suspected: Google OAuth not configured in Supabase Auth dashboard (only email provider works).
Need to add `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` to Supabase Auth > Providers > Google
(separate from Vercel env vars, which are for Gmail/Calendar integrations not auth).

## Files

```
components/
  LandingPage.tsx   — main landing chat component (replaces /home page)
  AuthCard.tsx      — inline auth card (Google, GitHub, email/password)
api/
  landing-chat.ts   — POST /api/landing-chat — streaming Claude Haiku endpoint
  parse-names.ts    — POST /api/parse-names — name extraction via Claude Haiku
  auth-callback.ts  — modified auth callback that routes to /provision after OAuth
page.tsx            — /provision page (client-side, handles provisioning + redirect to /chat)
```

## Backend (DigitalOcean Provisioning Server)

`/root/provisioning-api/server.js` on `164.92.75.153` was patched to:
- Accept `user_display_name`, `agent_name`, `use_case` in provision request body
- Write `USER.md`, `MEMORY.md`, `SOUL.md` to the instance workspace before starting

The `provisionInstance()` in `src/lib/provisioning-client.ts` was updated to accept a `UserContext` param.
The `/api/organizations/provision/route.ts` was updated to auto-generate workspace names and accept context.
Those backend changes are KEPT (they improve the normal onboarding flow too).

## To Revive

1. Configure Google OAuth in Supabase Auth dashboard (Providers > Google)
2. Restore `src/app/home/page.tsx` to import `LandingPage` from this folder
3. Restore `src/app/auth/callback/route.ts` from `api/auth-callback.ts`
4. Add `/provision` route from `page.tsx`
5. Add `/api/landing-chat` and `/api/parse-names` routes
6. Deploy and test end-to-end
