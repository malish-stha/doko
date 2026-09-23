# Doko

Team ops for small product teams: a Kanban board, backlog and sprints, chat with
DMs, ticket comments/subtasks/attachments, notifications, and an AI morning brief.

Stack: Next.js 16 (app router), next-auth v5 (Google), Convex, Tailwind 4.

## How authentication works

1. Google sign-in via next-auth creates the browser session.
2. `/api/convex-token` signs a short-lived **RS256 JWT** for the signed-in user
   (`sub` = lowercased email, `aud` = `doko`, `iss` = `AUTH_URL`).
3. Convex verifies that token against `${CONVEX_AUTH_ISSUER}/.well-known/jwks.json`
   (see `convex/auth.config.ts`). Every Convex function derives identity from
   `ctx.auth` only; nothing trusts a client-supplied email.
4. `users.teamId` is the user's **active team**; `teamMembers` holds one row per
   team a user belongs to. `TeamSwitcher` (top right) switches teams; onboarding
   creates a team or accepts an invite.

Convex fetches the JWKS over the public internet, so **local development needs a
public URL** for the Next.js app (for example `cloudflared tunnel --url http://localhost:3000`
or `ngrok http 3000`). Use that URL as `AUTH_URL` locally and as `CONVEX_AUTH_ISSUER`
on the dev deployment, and register it as an authorised redirect URI in Google
Cloud. Without it, Convex functions run unauthenticated and the app shows
"We couldn't verify your session".

## Setup

```bash
npm install
cp .env.example .env.local        # fill in the values described in the file
npx convex dev                    # creates/links a dev deployment, prints NEXT_PUBLIC_CONVEX_URL
```

Set the deployment-side variables (they are read by Convex functions, not Next.js):

```bash
npx convex env set CONVEX_AUTH_ISSUER https://<your-public-url>
npx convex env set APP_URL https://<your-public-url>
npx convex env set INVITE_SIGNING_SECRET "$(openssl rand -hex 32)"
npx convex env set GMAIL_USER you@gmail.com
npx convex env set GMAIL_APP_PASSWORD '<app password>'
npx convex env set ANTHROPIC_API_KEY sk-ant-...     # and/or GOOGLE_GENAI_API_KEY
```

Then run the app:

```bash
npm run dev
```

`convex/auth.config.ts` throws at deploy time when `CONVEX_AUTH_ISSUER` is
missing, and `email.ts` throws when `APP_URL` is missing. Both are intentional:
misconfiguration fails loudly instead of running unauthenticated or emailing
`localhost` links.

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `AUTH_URL` | Next.js | Site origin; JWT issuer. Must equal `CONVEX_AUTH_ISSUER`. |
| `AUTH_SECRET` | Next.js | next-auth session encryption. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Next.js | Google OAuth. |
| `NEXT_PUBLIC_CONVEX_URL` | Next.js | Convex deployment URL. |
| `CONVEX_JWT_PRIVATE_KEY` | Next.js | PKCS8 PEM used to sign Convex tokens. |
| `CONVEX_JWT_PUBLIC_KEY` | Next.js | SPKI PEM served at `/.well-known/jwks.json`. |
| `CONVEX_JWT_KID` | Next.js | Key id (default `doko-1`). Rotate keys by changing it. |
| `CONVEX_AUTH_ISSUER` | Convex | Issuer + JWKS host Convex trusts. |
| `APP_URL` | Convex | Public origin for links in emails. |
| `INVITE_SIGNING_SECRET` | Convex | HS256 secret for invite links (>= 32 chars). |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Convex | Outbound mail via nodemailer. |
| `ANTHROPIC_API_KEY` / `GOOGLE_GENAI_API_KEY` | Convex | Morning brief providers. |
| `LLM_BRIEF_PROVIDER` / `LLM_QUICK_PROVIDER` | Convex | `anthropic` (default) or `google`. |
| `LLM_MOCK` | Convex (dev) | `1` returns canned briefs without calling a provider. |
| `LLM_ALLOW_PROVIDER_COMPARE` | Convex (dev) | `1` enables the provider comparison widget. |

## Invites

Owners and admins invite by email from **Team settings**. The invite email links
to `/invite/accept?token=…`; the token is a signed JWT that is verified before
anything is looked up, and the invite can only be accepted while signed in as the
invited address (otherwise the page explains which account to use). Delivery
state (queued / sent / failed) is shown next to each pending invite with a
Resend action. Invites expire after 7 days (an hourly cron marks them).

## Development

```bash
npm run lint          # eslint
npx tsc --noEmit      # types
npm test              # vitest: convex/** (edge-runtime) and lib/** (node)
npx playwright test   # e2e smoke (starts the dev server)
```

Tests never call a real LLM (`LLM_MOCK=1` is set in `vitest.config.ts`).

## Upgrading an existing deployment

The 2026-09 audit changed how identities and teams are stored. After deploying
that code, run the one-off migration **once** before deploying any later commit
that tightens the schema:

```bash
npx convex run migrations:runAll
```

It canonicalises every user id to the lowercased email, merges duplicate user
rows, deduplicates memberships, backfills `tickets.teamId`, `channels.dmKey`
and `activityEvents.ticketId`, and moves legacy `tickets.attachments[]` blobs
into the `attachments` table. It is paginated and idempotent.

## Bug tracker

`BUGS.md` lists every finding from the 2026-09 audit with its status and the
commit that fixed it.
