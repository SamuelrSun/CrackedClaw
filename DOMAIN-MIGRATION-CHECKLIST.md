# 🚀 Dopl Domain Migration Checklist: crackedclaw.com → usedopl.com

**Total areas:** 9 | **Services needing dashboard changes:** 5+

---

## 1. VERCEL

### 1a. Custom Domain
- [ ] **Add `usedopl.com` + `www.usedopl.com` as custom domains** in Vercel project settings
  - Where: https://vercel.com/dashboard → Project → Settings → Domains
  - Old: `crackedclaw.com`, `www.crackedclaw.com`
  - New: `usedopl.com`, `www.usedopl.com`
  - **MUST-DO-BEFORE-LAUNCH**

### 1b. Environment Variables (Vercel Dashboard)
- [ ] **Update `NEXT_PUBLIC_APP_URL`**
  - Old: `https://crackedclaw.com`
  - New: `https://usedopl.com`
  - **MUST-DO-BEFORE-LAUNCH** — master URL used by 10+ API routes

- [ ] **Update `DO_SERVER_URL`**
  - Old: `https://companion.crackedclaw.com/api/tools/execute`
  - New: `https://companion.usedopl.com/api/tools/execute`
  - **MUST-DO-BEFORE-LAUNCH** — breaks exec/file tools for agents

- [ ] **Rotate `DO_SERVER_SECRET`** (contains old branding)
  - Old: `crackedclaw-tools-secret-2026`
  - New: generate fresh secret, update on server too
  - **MUST-DO-BEFORE-LAUNCH**

- [ ] **Set `CHAT_PUSH_SECRET`** (currently missing, was falling back to hardcoded)
  - New: generate fresh secret, update on server too
  - **MUST-DO-BEFORE-LAUNCH** — code now throws if missing (C5 fix)

- [ ] **Set `TOKEN_BRIDGE_SECRET`** (currently missing, was falling back to hardcoded)
  - New: generate fresh secret
  - **MUST-DO-BEFORE-LAUNCH** — code now throws if missing (C5 fix)

- [ ] **Set `SECRET_ENCRYPTION_KEY`** (currently missing, was falling back to hardcoded)
  - New: proper 32-char secret
  - ⚠️ **WARNING:** If any data was encrypted with the old default key, you'll need to re-encrypt after rotation. If no secrets have been stored yet (fresh DB), just set the new key.
  - **MUST-DO-BEFORE-LAUNCH**

---

## 2. SUPABASE

- [ ] **Update Site URL**
  - Where: https://supabase.com/dashboard/project/hoqawekvprpvcspdgtrf → Authentication → URL Configuration → Site URL
  - Old: `https://crackedclaw.com`
  - New: `https://usedopl.com`
  - **MUST-DO-BEFORE-LAUNCH** — auth emails link to wrong domain

- [ ] **Update Redirect URLs**
  - Where: Same page → Redirect URLs
  - Remove: `https://crackedclaw.com/**`, `https://www.crackedclaw.com/**`
  - Add: `https://usedopl.com/**`, `https://www.usedopl.com/**`
  - **MUST-DO-BEFORE-LAUNCH** — Google sign-in blocked without this

- [ ] **Check Email Templates** for `crackedclaw.com` references
  - Where: Supabase → Authentication → Email Templates
  - **MUST-DO-BEFORE-LAUNCH**

---

## 3. GOOGLE CLOUD CONSOLE

- [ ] **Update OAuth 2.0 Authorized Redirect URIs**
  - Where: https://console.cloud.google.com → APIs & Services → Credentials → OAuth 2.0 Client
  - Remove: `https://crackedclaw.com/api/integrations/oauth/callback`
  - Add: `https://usedopl.com/api/integrations/oauth/callback`
  - **MUST-DO-BEFORE-LAUNCH** — Google OAuth completely broken without this

- [ ] **Update Authorized JavaScript Origins**
  - Where: Same OAuth client
  - Remove: `https://crackedclaw.com`
  - Add: `https://usedopl.com`
  - **MUST-DO-BEFORE-LAUNCH**

---

## 4. DIGITALOCEAN SERVER (164.92.75.153)

### 4a. Provisioning API (`/root/provisioning-api/server.js`)
8 hardcoded `crackedclaw.com` references — all must change:

- [ ] **Line ~492: `allowedOrigins` — instance origin**
  - Old: `` `https://i-${shortId}.crackedclaw.com` ``
  - New: `` `https://i-${shortId}.usedopl.com` ``

- [ ] **Line ~493: `allowedOrigins` — main app origin**
  - Old: `"https://crackedclaw.com"`
  - New: `"https://usedopl.com"` (also add `"https://www.usedopl.com"`)

- [ ] **Line ~697: `certDomain` for SSL certs**
  - Old: `` `i-${shortId}.crackedclaw.com` ``
  - New: `` `i-${shortId}.usedopl.com` ``

- [ ] **Line ~724: `gatewayUrl` returned to app**
  - Old: `` `https://${instanceShortId}.crackedclaw.com` `` (⚠️ may be missing `i-` prefix — check!)
  - New: `` `https://i-${instanceShortId}.usedopl.com` ``

- [ ] **Lines ~771, ~810, ~874: delete/status/create responses**
  - All: `crackedclaw.com` → `usedopl.com`

- [ ] **Restart provisioning-api:** `pm2 restart provisioning-api`

### 4b. Nginx
- [ ] **Rename + update existing instance config**
  - Old: `/etc/nginx/sites-enabled/i-fda9eeb9.crackedclaw.com`
  - New server_name: `i-fda9eeb9.usedopl.com`
  - Update SSL cert paths after new cert is issued

- [ ] **Reload nginx:** `nginx -t && systemctl reload nginx`

### 4c. SSL Certificates
- [ ] **Issue cert for existing instance:** `certbot --nginx -d i-fda9eeb9.usedopl.com`
  - Prerequisite: DNS A record must exist first
- [ ] **Issue cert for companion subdomain:** `certbot --nginx -d companion.usedopl.com`
- [ ] **Consider wildcard cert** (`*.usedopl.com`) via DNS challenge for simpler management

### 4d. Existing DB Records
- [ ] **Update `gateway_url` in Supabase `profiles` table:**
  ```sql
  UPDATE profiles SET gateway_url = REPLACE(gateway_url, 'crackedclaw.com', 'usedopl.com') WHERE gateway_url LIKE '%crackedclaw.com%';
  ```

---

## 5. STRIPE

- [ ] **Update Webhook Endpoint URL**
  - Where: https://dashboard.stripe.com → Developers → Webhooks
  - Old: `https://crackedclaw.com/api/billing/webhook`
  - New: `https://usedopl.com/api/billing/webhook`
  - **MUST-DO-BEFORE-LAUNCH** — subscription events won't process

- [ ] **Check Customer Portal Return URLs**
  - Where: Stripe → Settings → Billing → Customer portal
  - These use `NEXT_PUBLIC_APP_URL` dynamically — updating that env var covers it
  - **Verify after env var update**

---

## 6. DNS (for usedopl.com)

- [ ] **Register `usedopl.com`** if not already owned

- [ ] **Vercel (main app):**
  - `usedopl.com` → A record per Vercel's instructions (76.76.21.21 typically)
  - `www.usedopl.com` → CNAME → `cname.vercel-dns.com`

- [ ] **DigitalOcean server:**
  - `companion.usedopl.com` → A → `164.92.75.153`
  - `i-fda9eeb9.usedopl.com` → A → `164.92.75.153`
  - For future: wildcard `*.usedopl.com` → A → `164.92.75.153` (or add per-instance)

---

## 7. COMPANION ELECTRON APP

- [ ] **Rebuild and redistribute DMG** after code changes
  - `cd companion-app && npm run build` (or electron-builder command)
  - Domain changes in code are handled by domain-migration subagent
  - **MUST-DO-BEFORE-LAUNCH** — existing DMG has crackedclaw.com hardcoded

- [ ] **Update DMG download link** wherever it's hosted
  - Old: linked from crackedclaw.com/connect
  - New: link from usedopl.com/connect

---

## 8. EXISTING OPENCLAW INSTANCE CONFIG

- [ ] **Update `allowedOrigins`** in running instance config
  - Where: `/opt/openclaw-instances/oc-fda9eeb9/openclaw.json` (or similar path on server)
  - Add: `https://usedopl.com`, `https://www.usedopl.com`
  - Remove: old `crackedclaw.com` origins
  - Restart: `pm2 restart oc-fda9eeb9`

---

## 9. OPTIONAL / POST-LAUNCH

- [ ] **Set up 301 redirects** from `crackedclaw.com` → `usedopl.com` (keep old domain active temporarily)
- [ ] **Update Stripe product descriptions/names** if they mention CrackedClaw
- [ ] **Google Search Console** — add usedopl.com property, submit sitemap
- [ ] **Social links** — update any landing pages, Twitter, LinkedIn, etc.
- [ ] **README.md / ARCHITECTURE.md** in repo — update branding
- [ ] **Delete old `crackedclaw.com` nginx configs** once migration verified

---

## EXECUTION ORDER (Recommended)

1. **Register/configure DNS** for usedopl.com (takes time to propagate)
2. **Vercel:** add domain + update env vars
3. **Supabase:** update auth URLs
4. **Google Cloud:** update OAuth URIs
5. **Stripe:** update webhook URL
6. **Server:** update provisioning-api, nginx, SSL certs
7. **Deploy** code changes (push to main → Vercel auto-deploys)
8. **Test:** sign up → provision → companion connect → chat → billing
9. **Set up redirects** from old domain
