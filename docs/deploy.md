# Deploy

How to set up Training Log from scratch on Vercel with Neon Postgres, Resend and Vercel Blob, and how to run the end-to-end suite against a preview. Everything here follows what the repository configures (`vercel.json`, `apps/api/.env.example`, the environment reads in `apps/api/src`).

## Architecture in one paragraph

One Vercel project, two [Vercel Services](https://vercel.com/docs/services) on one origin (KTD1). `web` is the Vite PWA in `apps/web`, served as static files. `api` is the Express app in `apps/api`, whose default export in `src/index.ts` is the handler. Public rewrites in `vercel.json` send `/api/(.*)` to `api` and everything else to `web`, and `web` rewrites every path to `/index.html` so deep links work. Express keeps the `/api` prefix in its routes. The API uses Neon Postgres for auth and sync, Resend for the sign-in codes, and Vercel Blob for custom exercise photos.

```json
{
  "services": {
    "web": {
      "root": "apps/web",
      "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
    },
    "api": { "root": "apps/api", "entrypoint": "src/index.ts" }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": { "service": "api" } },
    { "source": "/(.*)", "destination": { "service": "web" } }
  ]
}
```

## Prerequisites

- Node 24 or later (`.nvmrc`) and pnpm 11.1.1 (`packageManager` in `package.json`; `npx pnpm@11.1.1` works if your global pnpm is older).
- A Vercel account with the Git repository connected.
- **A domain you control, verified in Resend.** Until a sending domain is verified, Resend only delivers to the email address of the Resend account owner, so nobody else can receive a sign-in code and open sign-up (R4) does not work. Buy or reuse a domain, add it in Resend → Domains, and create the DNS records Resend lists (SPF, DKIM, and optionally DMARC). Do this before inviting anyone.

## 1. Vercel project

1. In Vercel, **Add New → Project** and import the repository. Keep the root directory as the repository root: `vercel.json` defines both services.
2. Vercel detects the services from `vercel.json`. `web` builds with Vite (`vite build`, output `dist`) and `api` is deployed as a function from `apps/api/src/index.ts`.
3. Set the environment variables below, then deploy.
4. Check the deployment: `/` serves the app, a deep link such as `/rutinas/abc` loads the app, `/api/health` returns `{"ok":true}`, and `/api/nope` returns a JSON 404.

## 2. Neon Postgres, one branch per preview

1. In the Vercel project, **Storage → Marketplace → Neon** and connect it to the project. This sets `DATABASE_URL` (pooled) for the project.
2. In the Neon integration settings, turn on **a database branch for each preview deployment**. Each preview then gets its own `DATABASE_URL` that points to a branch of the main database, so previews never write to production data.
3. Apply the migrations from `apps/api/drizzle/` (Drizzle; `apps/api/drizzle.config.ts` reads `DATABASE_URL`):

   ```sh
   cd apps/api
   DATABASE_URL="<connection string>" npx drizzle-kit migrate
   ```

   Run it against the production database before the first release, and again whenever a change adds a migration. A preview branch starts as a copy of its parent, so a pull request that adds a migration must also apply it to its preview branch (take the connection string from the Neon console or from the preview's environment variables). The repository does not run migrations during the build.

## 3. Environment variables

Set these in Vercel → Settings → Environment Variables. The API reads them; the SPA reads none.

| Variable                | Environments        | Value                                                                                                                                                                                 | Read by                                          |
| ----------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `DATABASE_URL`          | Production, Preview | Neon pooled connection string. Set by the Neon integration; previews get their branch's URL.                                                                                          | `src/db/client.ts`, `drizzle.config.ts`          |
| `BETTER_AUTH_SECRET`    | Production, Preview | A random secret of at least 32 characters, e.g. `openssl rand -base64 32`. Use different values for Production and Preview.                                                           | `src/auth/auth.ts`                               |
| `BETTER_AUTH_URL`       | Production only     | The public origin, e.g. `https://training-log.example.com`. Leave it unset for Preview: each preview has its own URL, and without it Better Auth derives the origin from the request. | `src/auth/auth.ts`                               |
| `RESEND_API_KEY`        | Production, Preview | A Resend API key with sending access.                                                                                                                                                 | `src/auth/auth.ts`                               |
| `EMAIL_FROM`            | Production, Preview | The sender on your verified domain, e.g. `Training Log <acceso@example.com>`.                                                                                                         | `src/auth/auth.ts`                               |
| `BLOB_READ_WRITE_TOKEN` | Production, Preview | Set by connecting a Vercel Blob store (next section).                                                                                                                                 | `src/uploads/router.ts`, `src/account/router.ts` |

Set by Vercel, not by you:

- `VERCEL_ENV` decides how sign-in codes are stored (`src/auth/auth.ts`). On `production` they are hashed. On `preview` they are kept in plain text in the `verification` table so the end-to-end suite can read them (U3 step 3). Vercel sets `NODE_ENV=production` in previews too, which is why `VERCEL_ENV` is the deciding value; outside Vercel, `NODE_ENV=production` hashes them.
- `VERCEL_AUTOMATION_BYPASS_SECRET` exists once Protection Bypass for Automation is turned on (section 5).

For local development, copy `apps/api/.env.example` to `apps/api/.env`, run `pnpm dev`, and open the Vite dev server: it proxies `/api` to the Express process on port 3001.

## 4. Vercel Blob

1. **Storage → Create → Blob**, and connect the store to the project for Production and Preview. This sets `BLOB_READ_WRITE_TOKEN`.
2. The API never uploads bytes itself. It hands out short-lived client tokens (KTD12) that allow only images, at most 2 MB, at one server-chosen path under the user's prefix. The client uploads with `access: 'public'`, so photo URLs are unguessable but public.
3. The exercise catalog ships with `imageUrl: null` for every entry (see `scripts/catalog/README.md`), so the catalog needs nothing in Blob until licensed images exist.

## 5. End-to-end tests

The suite lives in `apps/web/e2e/` and covers first open (F1), an offline workout (F2), finishing with routine changes (F3), two devices on one account (R7), and a reload during an active workout.

### Locally

```sh
cd apps/web && npx playwright install chromium   # once
pnpm test:e2e                                    # from the repository root
```

Playwright builds the SPA for production, serves it with `vite preview` on `http://localhost:4174`, and proxies `/api` to a test-only API process on port 3101 (`apps/api/src/e2e-server.ts`). That process runs the real Express app on an in-memory Postgres (PGlite) with a mailer sink and a `GET /api/__e2e/otp?email=` route the specs read codes from. It only starts with `E2E_TEST_MODE=1` outside production and is never imported by the deployed entrypoint. No database, Resend key or Blob token is needed.

### Against a preview deployment

1. In Vercel → Settings → Deployment Protection, turn on **Protection Bypass for Automation** and copy the secret.
2. Run, from the repository root:

   ```sh
   BASE_URL="https://<preview-url>" \
   E2E_DATABASE_URL="<the preview's Neon branch connection string>" \
   VERCEL_AUTOMATION_BYPASS_SECRET="<secret>" \
   pnpm test:e2e
   ```

   - `BASE_URL` switches Playwright to preview mode: no local servers start.
   - Codes are read from the preview branch's `verification` table (`sign-in-otp-<email>`), which is why `E2E_DATABASE_URL` must be that preview's branch, not production.
   - Every request carries `x-vercel-protection-bypass` and `x-vercel-set-bypass-cookie`.
   - The preview really sends the codes through Resend. By default the specs sign in as `delivered+<tag>@resend.dev`, Resend's test inbox. Set `E2E_EMAIL_DOMAIN` to send to addresses on a domain you control instead.

3. The API allows 10 code requests per IP and 3 per email in 15 minutes. One run makes 6 code requests from your IP, so wait 15 minutes between full runs from the same machine.

## Release checklist

- [ ] Resend domain verified and `EMAIL_FROM` on it.
- [ ] Migrations applied to the production database.
- [ ] All variables in section 3 set for Production; `BETTER_AUTH_URL` matches the production domain.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` pass locally, and the end-to-end suite passes against a preview.
- [ ] On a real iPhone and an Android phone: install to the home screen, sign in with a code, then log a workout in airplane mode and watch it sync when the connection returns.
