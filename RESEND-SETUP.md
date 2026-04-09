# Resend Email Configuration Guide

This guide covers how to configure [Resend](https://resend.com) for the IRL (Infinite Running League) app, both in v0 preview and on a local development machine.

---

## Table of Contents

1. [Overview](#overview)
2. [Create a Resend Account & API Key](#create-a-resend-account--api-key)
3. [Configure in v0](#configure-in-v0)
4. [Configure on Local Machine](#configure-on-local-machine)
5. [Domain Verification (Production)](#domain-verification-production)
6. [Update the From Address](#update-the-from-address)
7. [Testing Emails](#testing-emails)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The IRL app uses Resend to send transactional emails for:

- **Team invitations** -- when a manager invites a runner to join their team
- **Invitation accepted** -- notifies the manager when a runner accepts
- **Join requests** -- notifies the manager when a runner requests to join
- **Invitation rejected** -- notifies the runner if their request is declined
- **Registration confirmation** -- confirms a successful race registration and payment

All email logic lives in `lib/email.tsx`. The API route at `app/api/send-notification-email/route.ts` handles server-side email dispatch.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `RESEND_API_KEY` | Yes | Your Resend API key (starts with `re_`) |
| `RESEND_FROM_EMAIL` | No | Custom sender address, e.g. `IRL <noreply@yourdomain.com>`. Defaults to `IRL <onboarding@resend.dev>` (sandbox). |

---

## Create a Resend Account & API Key

1. Go to [resend.com](https://resend.com) and sign up (free tier includes 3,000 emails/month).
2. From the dashboard, navigate to **API Keys** in the left sidebar.
3. Click **Create API Key**.
   - **Name**: `IRL App` (or any label you prefer)
   - **Permission**: `Sending access`
   - **Domain**: Leave as `All domains` for now (or restrict to your verified domain later)
4. Copy the generated key (it starts with `re_`). You will only see it once.

---

## Configure in v0

v0 projects do not use `.env` files. Environment variables are set via the in-chat sidebar.

### Steps

1. Open your v0 chat for the IRL project.
2. Click the **Vars** tab in the left sidebar.
3. Click **Add Variable**.
4. Set the key to `RESEND_API_KEY` and paste your Resend API key as the value.
5. Click **Save**.

That is it. The v0 preview will now use this key when sending emails. No restart is needed.

### Sandbox Mode (Default in v0)

By default, the app sends from `onboarding@resend.dev`, which is Resend's sandbox domain. This works out of the box but with restrictions:

- Emails can **only be delivered to the email address associated with your Resend account**.
- This is fine for testing but not for production use with real users.

To send to any recipient, you must verify your own domain (see [Domain Verification](#domain-verification-production) below).

---

## Configure on Local Machine

### 1. Clone the Repository

```bash
npx shadcn@latest add https://v0.dev/chat/b/<your-chat-id>
# or
git clone <your-repo-url>
cd v0-infinite-running-league-portal
npm install
```

### 2. Create a `.env.local` File

Create a `.env.local` file in the project root:

```env
# Resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Optional: Set a verified domain sender (otherwise sandbox onboarding@resend.dev is used)
# RESEND_FROM_EMAIL="IRL <noreply@yourdomain.com>"

# Supabase (also required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe (also required)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Site URL (used in email CTAs)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Run the Dev Server

```bash
npm run dev
```

Emails will now send through Resend when triggered by team invitations, join requests, or registration payments.

---

## Domain Verification (Production)

To send emails from your own domain (e.g., `noreply@yourdomain.com`) instead of the sandbox `noreply@resend.dev`, you need to verify your domain with Resend.

### Steps

1. In the Resend dashboard, go to **Domains** in the left sidebar.
2. Click **Add Domain**.
3. Enter your domain (e.g., `yourdomain.com`).
4. Resend will provide DNS records you need to add. You will typically see:

   | Type | Name | Value | Purpose |
   |---|---|---|---|
   | `TXT` | `yourdomain.com` | `v=spf1 include:amazonses.com ~all` | SPF (sender authorization) |
   | `CNAME` | `resend._domainkey.yourdomain.com` | `<provided-by-resend>` | DKIM (email signing) |
   | `CNAME` | `<key>._domainkey.yourdomain.com` | `<provided-by-resend>` | DKIM (email signing) |

5. Add these DNS records to your domain registrar or DNS provider (e.g., Cloudflare, Namecheap, Vercel Domains, GoDaddy).
6. Back in the Resend dashboard, click **Verify** on your domain. DNS propagation can take anywhere from a few minutes to 48 hours, though it is typically under 10 minutes.
7. Once verified, the domain status will show a green checkmark.

### If Using Vercel Domains

If your domain is managed through Vercel:

1. Go to your Vercel project dashboard.
2. Navigate to **Settings** > **Domains**.
3. Add the DNS records provided by Resend under your domain's DNS configuration.
4. Return to Resend and verify.

---

## Update the From Address

Once your domain is verified, set the `RESEND_FROM_EMAIL` environment variable. The code in `lib/email.tsx` already reads this centrally -- no code changes are needed.

**In v0:** Add `RESEND_FROM_EMAIL` in the **Vars** sidebar tab:
```
RESEND_FROM_EMAIL=IRL <noreply@yourdomain.com>
```

**Locally:** Add to `.env.local`:
```env
RESEND_FROM_EMAIL="IRL <noreply@yourdomain.com>"
```

If `RESEND_FROM_EMAIL` is not set, the app defaults to the Resend sandbox address `onboarding@resend.dev` (only delivers to your Resend account email).

---

## Testing Emails

### Sandbox Testing (No Domain Required)

With the default `onboarding@resend.dev` sender:
- Emails only arrive at the email address tied to your Resend account.
- Trigger a test by inviting a runner to a team from the Manager portal, or completing a race registration with payment.

### Verifying Delivery

1. Check the Resend dashboard under **Emails** to see send logs, delivery status, and any bounce/error details.
2. Check your spam/junk folder if emails do not appear in your inbox.
3. Review the server console for any `Failed to send` error logs.

### Common Test Flows

| Action | Email Sent | Recipient |
|---|---|---|
| Manager invites a runner | Team Invitation | Runner |
| Runner accepts invitation | Invitation Accepted | Manager |
| Runner requests to join team | Join Request | Manager |
| Manager rejects request | Invitation Rejected | Runner |
| Runner completes payment | Registration Confirmed | Runner |

---

## Troubleshooting

### "Missing Resend API key" or emails silently fail

- **v0**: Check the **Vars** tab in the sidebar and confirm `RESEND_API_KEY` is set.
- **Local**: Check `.env.local` exists in the project root and contains `RESEND_API_KEY`.

### Emails only deliver to your own address

- You are using the sandbox domain `onboarding@resend.dev`. This is expected behavior.
- Verify your own domain to send to any recipient.

### "The from address is not verified"

- The domain in your `from` field has not been verified in Resend.
- Go to Resend dashboard > Domains and complete verification.
- Make sure the `from` address matches your verified domain exactly.

### DNS records not propagating

- Wait up to 48 hours (though usually under 10 minutes).
- Use [MXToolbox](https://mxtoolbox.com/) or `dig` to check if your DNS records are live:
  ```bash
  dig TXT yourdomain.com
  dig CNAME resend._domainkey.yourdomain.com
  ```

### Emails going to spam

- Ensure both SPF and DKIM records are correctly set.
- Avoid using generic sender names; use a recognizable brand name like `IRL`.
- Consider adding a DMARC record for additional deliverability trust:
  ```
  TXT  _dmarc.yourdomain.com  v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
  ```

### Rate limits

- Resend free tier: 3,000 emails/month, 100 emails/day.
- Pro tier: 50,000 emails/month.
- Check the Resend dashboard for current usage.
