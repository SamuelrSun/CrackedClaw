# Supabase Authentication Settings

This document outlines the required Supabase configuration for email verification to work properly.

## Required Settings

### 1. Enable Email Confirmations

In your Supabase Dashboard:
1. Go to **Authentication** → **Providers** → **Email**
2. Enable **Confirm email** toggle
3. This ensures users must verify their email before accessing the app

### 2. Configure Redirect URLs

In your Supabase Dashboard:
1. Go to **Authentication** → **URL Configuration**
2. Add your app domain(s) to **Redirect URLs**:

For development:
```
http://localhost:3000/auth/callback
```

For production:
```
https://your-domain.com/auth/callback
https://cloud.openclaw.com/auth/callback
```

### 3. Email Templates (Optional)

Customize the verification email in:
1. Go to **Authentication** → **Email Templates**
2. Edit the **Confirm signup** template
3. The `{{ .ConfirmationURL }}` variable contains the verification link

Example custom template:
```html
<h2>Welcome to OpenClaw!</h2>
<p>Please verify your email address by clicking the link below:</p>
<p><a href="{{ .ConfirmationURL }}">Verify Email Address</a></p>
<p>This link will expire in 24 hours.</p>
```

## How Email Verification Works

1. User signs up on `/login` page
2. Supabase sends verification email with link to `/auth/callback?type=email_verification`
3. User clicks link, callback route verifies the token
4. User is redirected to `/verify-email?status=success`
5. After 3 seconds, auto-redirect to `/login`
6. User can now sign in with verified email

## Verification Banner

If a user somehow bypasses verification (e.g., email confirmation was disabled initially), the `EmailVerificationBanner` component can be used to show a warning:

```tsx
import { EmailVerificationBanner } from "@/components/auth/email-verification-banner";

// In your layout or page:
{!user.email_confirmed_at && (
  <EmailVerificationBanner email={user.email} />
)}
```

## Environment Variables

Ensure these are set in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Troubleshooting

### "Email not confirmed" error on sign in
- User needs to click the verification link in their email
- Check spam folder
- Use the resend verification option on the banner

### Verification link expired
- Links expire after 24 hours by default
- User should request a new verification email

### Redirect not working
- Ensure your domain is in the Redirect URLs list
- Check that the callback URL matches exactly
