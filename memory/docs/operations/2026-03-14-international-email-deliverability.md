# Tarmeer International Email Deliverability Hardening

Date: 2026-03-14

## Goal

Make registration and password-reset emails reliable for international mailbox providers, especially:

- Gmail / Google Workspace
- Outlook / Hotmail / Microsoft 365
- iCloud Mail
- enterprise mail systems such as Feishu / Lark, Exchange, and Google Workspace

## What was verified today

### Online registration evidence

For `trinity@epaifamarketing.com`:

- registration record exists in production
- `email_verified = 0`
- verification token still exists
- production logs recorded verification email as sent

This means the current issue is not "registration failed" or "email send path never triggered". It is a deliverability / inbox-placement problem.

### DNS/authentication snapshot observed today

Observed on 2026-03-14:

- `mail.kptom.com` has SPF: `v=spf1 include:spf1.dm.aliyun.com -all`
- `_dmarc.mail.kptom.com` exists
- DKIM was not confirmed from DNS in this audit and must still be verified in Aliyun Direct Mail
- the visible sender domain (`mail.kptom.com`) still does not match the product web domain (`tarmeer.com`), which can weaken user trust and inbox placement

### Code-side issues found

- registration previously returned success before SMTP verification mail actually finished sending
- email links relied on request-origin state, which can produce inconsistent links under proxies or unusual headers
- transactional emails had no plain-text body
- sender metadata for reply path was not configurable
- logs did not include provider-level mail metadata such as `messageId` or SMTP `response`

## Code changes completed

- registration now reflects verification-mail send result instead of always claiming success
- transactional emails now include both HTML and plain-text bodies
- sender metadata is configurable:
  - `SMTP_FROM_NAME`
  - `SMTP_REPLY_TO`
  - `SMTP_RETURN_PATH`
- production email links now resolve from configured `FRONTEND_URL`
- SMTP logs now include `messageId`, provider `response`, `accepted`, and `rejected`

## Required DNS / platform work

These items are still required outside the codebase.

### 1. Confirm DMARC policy for the exact sender domain

For current sender `noreply@mail.kptom.com`, the relevant DMARC record is:

```txt
_dmarc.mail.kptom.com
```

This record exists, but it should be reviewed in DNS and Aliyun to confirm:

- intended policy is correct
- reporting mailbox is monitored
- alignment matches the exact sender domain in production

### 2. Confirm DKIM in Aliyun Direct Mail

Must confirm all of the following:

- DKIM signing is enabled for the sending domain
- the published selector matches Aliyun console output
- DNS has propagated
- live test headers show `dkim=pass`

### 3. Align visible From domain, SPF, DKIM, and bounce path

Recommended transactional setup:

- visible From: `noreply@mail.kptom.com`
- DKIM signing domain aligned to `mail.kptom.com` or parent org domain
- return path / bounce domain aligned under the same organizational domain

Recommended stronger setup for the product:

- move transactional sender closer to the product brand, for example:
  - `noreply@mail.tarmeer.com`
  - or `noreply@notify.tarmeer.com`

Today, the product is branded as `tarmeer.com` while mail is sent from `mail.kptom.com`. That mismatch is not a hard failure, but it is weaker than a fully aligned brand-domain setup.

### 4. Separate transactional mail from other mail streams

Recommended long-term structure:

- registration / password reset / account verification:
  - `notify.tarmeer.com` or `mail.tarmeer.com`
- marketing / newsletters:
  - separate subdomain

This protects transactional reputation from marketing reputation.

## International mailbox acceptance checklist

### Gmail / Google Workspace

Must have:

- SPF or DKIM for all senders
- SPF and DKIM both for higher-volume traffic
- DMARC published
- aligned `From` domain
- valid forward and reverse DNS
- TLS

### Outlook / Microsoft 365

Must have:

- SPF
- DKIM
- DMARC
- aligned sender domain
- avoid bypassing authentication with safelists

### iCloud Mail

Must have:

- SPF
- DKIM
- DMARC
- clean logs for any rejection details

## Deliverability QA matrix

Before calling email delivery "ready", test all of these:

- Gmail personal inbox
- Google Workspace business inbox
- Outlook.com
- Microsoft 365 business inbox
- iCloud Mail
- one enterprise mailbox with aggressive filtering

For each provider:

1. register a new account
2. verify email arrival time
3. confirm inbox vs spam placement
4. inspect message headers
5. confirm:
   - `spf=pass`
   - `dkim=pass`
   - `dmarc=pass`
   - aligned `From` domain

## Production follow-up for the current case

For `trinity@epaifamarketing.com`:

- the system did send the email
- likely causes are spam/quarantine, delayed delivery, or recipient-side policy filtering

Because this target domain uses enterprise mail infrastructure, missing or weak DMARC/DKIM posture is a realistic risk factor.

## Useful local audit command

```bash
bash scripts/audit-email-deliverability.sh kptom.com mail.kptom.com
```

## Official references

- Google Email sender guidelines: https://support.google.com/a/answer/81126
- Google Email sender guidelines FAQ: https://support.google.com/a/answer/14229414
- Google Sender requirements & Postmaster Tools FAQ: https://support.google.com/a/answer/14289100
- Microsoft DMARC setup guidance: https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dmarc-configure
- Microsoft sender policies: https://sendersupport.olc.protection.outlook.com/pm/policies.aspx
- Apple iCloud Mail postmaster information: https://support.apple.com/en-us/102322
