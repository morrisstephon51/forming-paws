# Email templates

These live in the Supabase dashboard, not in the running app, so they are kept
here for the same reason any other production configuration is: otherwise the
only copy is behind a login, and nobody can review a change or restore one.

**Supabase → Authentication → Emails**

| File | Paste into |
| --- | --- |
| `confirm-signup.html` | Confirm signup |
| `reset-password.html` | Reset password |

Paste the whole file including the comment at the top — Supabase ignores HTML
comments, and it tells the next person why the link is shaped the way it is.

## Why not the stock templates

Supabase ships `{{ .ConfirmationURL }}`, which sends the click to
`/auth/v1/verify` and bounces it back with a **PKCE code**. That code can only
be redeemed by the browser that started the signup, because the matching
verifier lives in that browser's cookies. Someone who signs up on a laptop and
opens the mail on their phone — or whose webmail opens links in its own in-app
browser — cannot complete it.

`{{ .TokenHash }}` is self-contained. It works wherever it is opened.

`lib/auth/link.ts` accepts **both** shapes, so switching a template needs no
deploy, and rolling back is just pasting the old one.

## The other reason: deliverability

Verified from real message headers on 2026-08-14 — SPF, DKIM (signed
`d=theplugai.xyz`) and DMARC all pass, and Gmail applied no DMARC penalty
(`dis=NONE`). Mail still landed in spam, because the domain had never sent
anything before and the stock template is a heading, a sentence and a naked
link.

Reputation is earned, not configured, but content is half of what filters weigh.
These templates carry a recognisable sender, a real button, the reason the mail
exists, a plain-text fallback URL and a footer — all things a filter reads as
legitimate transactional mail.

## After changing a template

Send yourself one and confirm two things:

1. It arrives, and check whether it landed in spam
2. The link opens `theplugai.xyz/auth/confirm?token_hash=…` — **not**
   `supabase.co/auth/v1/verify?token=…`

The second is how you know the template actually took.
