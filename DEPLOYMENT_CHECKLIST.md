# Deployment Checklist for New Pricing Model

## Pre-Deployment (Do First)

### 1. Create Stripe Product
```bash
# In Stripe Dashboard:
# 1. Go to Products → Create product
# 2. Name: "Dopl Ultra"
# 3. Price: $100/month recurring
# 4. Copy the price ID (price_xxxxx)
```

### 2. Add Environment Variable
```bash
# Development (.env.local):
STRIPE_ULTRA_PRICE_ID=price_xxxxxxxxxxxxx

# Production (Vercel Dashboard):
# Settings → Environment Variables → Add:
# Key: STRIPE_ULTRA_PRICE_ID
# Value: price_xxxxxxxxxxxxx
# Scope: Production
```

### 3. Update Database Constraint
```sql
-- Run in Supabase SQL Editor:
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free', 'starter', 'pro', 'power', 'ultra'));
```

## Deployment Steps

### 1. Commit & Push
```bash
git add src/
git commit -m "feat: implement new pricing model with daily/weekly limits

- Remove old dailyCredits/monthlyPool/rolloverCap fields
- Add new trialGrant/weeklyLimit/dailyCap fields
- Add Ultra plan ($100/mo, 2000 credits, 500 weekly, 150 daily)
- Update UI to show only percentage bars (no raw numbers)
- Trial users: 10 free messages, no daily cap
- Paid users: daily caps and weekly limits
- Update enforcement logic for new credit model"

git push origin main
```

### 2. Verify Vercel Build
- Check Vercel dashboard for successful deployment
- Verify env var STRIPE_ULTRA_PRICE_ID is set

### 3. Smoke Test (Production)
- [ ] Login to production app
- [ ] Open settings → Plans & Billing
- [ ] Verify all 5 plans display (Free, Starter, Pro, Power, Ultra)
- [ ] Check usage bars render correctly
- [ ] Try upgrading to a plan (test checkout flow)
- [ ] Cancel before completing payment

### 4. Test with Test User
Create a test Stripe customer and verify:
- [ ] Free trial: can send 10 messages, then blocked
- [ ] Upgrade to Starter: daily/weekly limits work
- [ ] Usage bars update in real-time
- [ ] Stripe webhook sets plan correctly after checkout

## Post-Deployment Monitoring

### First 24 Hours
- [ ] Watch for errors in Vercel logs related to credit calculation
- [ ] Monitor Sentry/error tracking for new exceptions
- [ ] Check Stripe webhook logs for successful subscription updates
- [ ] Verify no users are incorrectly blocked

### First Week
- [ ] Gather user feedback on new pricing display
- [ ] Check if percentage bars are intuitive
- [ ] Monitor support tickets for pricing confusion
- [ ] Verify weekly limit resets work correctly (Monday 00:00 UTC)

## Rollback Plan

If critical issues arise:

### Quick Rollback (Revert deployment)
```bash
# In Vercel Dashboard:
# Deployments → Find previous deployment → Promote to Production
```

### Database Rollback (If constraint breaks things)
```sql
-- Revert constraint (allows old values):
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free', 'starter', 'pro', 'power'));
```

⚠️ **Note:** After rollback, any users on 'ultra' plan would fail the constraint. Manually downgrade them first if needed:
```sql
UPDATE profiles SET plan = 'power' WHERE plan = 'ultra';
```

## Migration Notes for Existing Users

### Users on 'free' plan:
- Before: Had daily credits + welcome grant
- After: 10-message trial (sum of all-time usage)
- **Impact:** If they've already used >10 credits worth historically, they're immediately exhausted
- **Mitigation:** Could reset usage for existing free users, or grandfather them

### Users on paid plans:
- Before: Daily credits + monthly pool + rollover
- After: Daily cap + weekly limit
- **Impact:** Some users may hit limits sooner if they had large rollover pools
- **Mitigation:** Consider emailing power users before launch

### Recommended Communication:
Send email to all users 48h before deployment:
> **Subject:** Simpler, clearer pricing coming to Dopl
>
> We're updating our pricing model to be clearer and more predictable. Here's what's changing:
>
> - **Trial users:** 10 free messages to try Dopl (no daily limit)
> - **Paid plans:** Daily and weekly usage limits (no more confusing pools/rollovers)
> - **New Ultra plan:** 20× the usage of Starter, perfect for power users
>
> Your current plan and usage won't be affected — we're just making everything easier to understand.
>
> Questions? Reply to this email.

## Success Metrics

Track these post-launch:
- Conversion rate from trial → paid (should increase if clearer)
- Upgrade rate from lower → higher plans
- Support ticket volume about pricing (should decrease)
- User retention on paid plans
- Revenue per user (could increase with Ultra plan)

## Troubleshooting

### "Trial complete" but user just signed up
- **Cause:** Old usage records in database
- **Fix:** Reset usage: `DELETE FROM user_usage WHERE user_id = '...' AND plan = 'free'`

### Percentage bar shows >100%
- **Cause:** Usage exceeds limit (shouldn't happen with enforcement)
- **Fix:** Check `checkCreditLimit` is called before allowing API requests

### Weekly limit not resetting Monday
- **Cause:** Timezone issues in `getWeekStartUTC()`
- **Fix:** Verify calculation uses UTC, not local time

### Stripe webhook not updating plan
- **Cause:** PRICE_IDS not finding new price ID
- **Fix:** Verify STRIPE_ULTRA_PRICE_ID is set correctly in env vars

## Emergency Contacts

- **Stripe Dashboard:** https://dashboard.stripe.com
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Supabase Dashboard:** https://supabase.com/dashboard
- **Sentry (if configured):** Check for error spikes

---

**Last Updated:** $(date)
**Deployment Target:** Production
**Estimated Downtime:** None (backward compatible API changes)
