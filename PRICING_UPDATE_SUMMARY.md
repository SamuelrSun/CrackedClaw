# Pricing Model Update Summary

## ✅ Completed Changes

### 1. Core Plan Definitions (`src/lib/plans.ts`)
- **Removed old fields:** `dailyCredits`, `monthlyPool`, `maxMonthly`, `rolloverCap`, `welcomeGrant`
- **Added new fields:** `trialGrant`, `monthlyCredits`, `weeklyLimit`, `dailyCap`, `multiplierLabel`
- **Added Ultra plan:** $100/mo with 2000 monthly credits, 500 weekly limit, 150 daily cap
- **Updated features:** Added "Pro-rated upgrades" to ALL_FEATURES

### 2. Type Definitions (`src/lib/usage/types.ts`)
- **New CreditStatus interface:**
  - `isTrial`: boolean flag for free users
  - `daily`: { usedPercent, remaining, limit, resetsAt }
  - `weekly`: { usedPercent, remaining, limit, resetsAt }
  - `trial`: { total, remaining, usedPercent, exhausted }
  - `allowed`, `upgradeNeeded`, `reason` for enforcement

### 3. Credit Calculation Logic (`src/lib/usage/credits.ts`)
- **Trial users (plan='free'):**
  - Sums ALL-TIME usage from `user_usage` table
  - Compares to 10-credit trial grant
  - No daily/weekly limits — just trial bar
  - Exhausted = can't use app anymore

- **Paid users:**
  - Daily usage: sum tokens for today, convert to credits
  - Weekly usage: sum tokens from Monday-Sunday (UTC), convert to credits
  - Daily remaining = dailyCap - todayCredits
  - Weekly remaining = weeklyLimit - weekCredits
  - Percentages for UI bars
  - Enforcement: blocked if daily cap OR weekly limit hit

### 4. Enforcement (`src/lib/usage/enforcement.ts`)
- Updated to return `dailyUsedPercent` and `weeklyUsedPercent`
- Works with new `checkCreditLimit` function

### 5. Stripe Integration (`src/lib/stripe.ts`)
- Added `ultra: process.env.STRIPE_ULTRA_PRICE_ID` to PRICE_IDS
- Added comment about Stripe pro-rating

### 6. Billing Checkout (`src/app/api/billing/checkout/route.ts`)
- Added `ultra` to PAID_PLANS array
- Checkout flow now handles ultra plan

### 7. Pricing Modal UI (`src/components/settings/pricing-modal.tsx`)
- **Removed raw credit numbers** — now shows only percentages and multipliers
- **New header:**
  - Trial users: show TRIAL bar with usedPercent
  - Paid users: show DAILY and WEEKLY bars with usedPercent
  - Color-coded: green → yellow → red as usage increases

- **Plan cards now show:**
  - Free: "10 free messages to try Dopl"
  - Starter: "Daily & weekly usage limits" + tagline
  - Pro/Power/Ultra: "4×/10×/20× the usage of Starter" + tagline
  - NO raw credit numbers visible

- **Added Ultra plan** to the grid (now 5 plans total)

### 8. Settings Page (`src/app/(app)/settings/client.tsx`)
- Updated usage display to work with new CreditStatus
- Trial users: show trial credits remaining + bar
- Paid users: show DAILY and WEEKLY bars (no raw numbers)

### 9. Billing Page (`src/app/(app)/settings/billing/client.tsx`)
- Updated to show new usage model
- Removed references to monthly pool, welcome grant
- Now shows daily/weekly percentage bars
- Added Ultra plan to grid

## 🔧 Required: Database Migration

Run this SQL in Supabase to add the `ultra` plan to the check constraint:

```sql
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free', 'starter', 'pro', 'power', 'ultra'));
```

## 🔧 Required: Environment Variables

Add to Vercel (production) and `.env.local` (development):

```bash
STRIPE_ULTRA_PRICE_ID=price_xxxxxxxxxxxxx
```

You'll need to create the Ultra price in Stripe first:
1. Go to Stripe Dashboard → Products
2. Create new price for $100/mo recurring
3. Copy the price ID (starts with `price_`)
4. Add to env vars

## 📝 What Changed (User-Facing)

### Old Model:
- Daily credits (5-25 per day) + monthly pool (0-1200)
- Rollover caps
- Welcome grant for new users
- Raw credit numbers shown everywhere

### New Model:
- Trial: 10 free messages, no daily cap (burn all at once)
- Paid: Monthly credit allocation with daily caps and weekly limits
- Daily caps let users burn through weekly allocation in ~2-3 days
- **Only percentages shown** — no raw numbers
- Multiplier labels: "4× the usage", "10× the usage", "20× the usage"

### Why This Works Better:
1. **Simpler for users** — no mental math of "daily + pool + rollover"
2. **Prevents gaming** — daily caps prevent burning entire month in 1 day
3. **Weekly limits** — smooth out usage, prevent mid-month exhaustion
4. **Percentage bars** — visual, not overwhelming with numbers
5. **Clear upgrade path** — "4× more usage" is clearer than "400 credits"

## 🧪 Testing Checklist

- [ ] Free trial user can use 10 messages then gets blocked
- [ ] Paid user hitting daily cap gets blocked until midnight UTC
- [ ] Paid user hitting weekly limit gets blocked until Monday
- [ ] Upgrading from Starter → Pro works
- [ ] Upgrading from Pro → Ultra works
- [ ] Downgrading to free works
- [ ] Stripe webhook correctly sets plan on subscription
- [ ] Usage bars display correctly in settings
- [ ] Pricing modal shows all 5 plans
- [ ] Percentages calculate correctly (not >100%)

## 📊 Files Modified

1. `src/lib/plans.ts`
2. `src/lib/usage/types.ts`
3. `src/lib/usage/credits.ts`
4. `src/lib/usage/enforcement.ts`
5. `src/lib/stripe.ts`
6. `src/app/api/billing/checkout/route.ts`
7. `src/components/settings/pricing-modal.tsx`
8. `src/app/(app)/settings/client.tsx`
9. `src/app/(app)/settings/billing/client.tsx`

**Files checked but no changes needed:**
- `src/app/api/billing/webhook/route.ts` (already maps price IDs dynamically)
- `src/app/api/usage/status/route.ts` (just calls getCreditStatus)
- `src/app/api/gateway/chat/stream/route.ts` (uses checkTokenLimit which I updated)

## 🚨 Breaking Changes

### Database Schema:
- The `profiles.plan` column needs to allow `'ultra'` value
- Old columns like `welcome_grant_used`, `monthly_pool_credits` still exist but are no longer used
  - Can be safely ignored (or dropped in a future migration)

### API Response Shape:
- `/api/usage/status` now returns a completely different CreditStatus shape
- Frontend code that consumed the old shape has been updated
- Any external consumers would need to adapt

## 💡 Future Improvements

1. **Top-ups:** Currently mentioned in footer but not implemented
2. **Usage history:** Could show weekly/monthly usage trends
3. **Notifications:** Email when hitting 80% of weekly limit
4. **Overage handling:** What happens if a long-running request pushes over limit mid-stream?
5. **Grace period:** Consider 10-credit buffer before hard blocking

## ✨ Success Criteria

- ✅ All old plan field references removed
- ✅ Ultra plan added to all relevant places
- ✅ UI shows only percentages, not raw credit numbers
- ✅ Trial users see trial bar, paid users see daily/weekly bars
- ✅ Enforcement blocks users correctly at limits
- ⏳ Database constraint added (manual step)
- ⏳ STRIPE_ULTRA_PRICE_ID added to env vars (manual step)
- ⏳ Tested with real usage scenarios (manual step)
