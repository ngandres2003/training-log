# Deploy

How to set up Training Log from scratch on Vercel with Neon Postgres and Vercel Blob, how to create the first admin account, and how to run the end-to-end suite against a preview. Everything here follows what the repository configures (`vercel.json`, `apps/api/.env.example`, the environment reads in `apps/api/src`).

## Architecture in one paragraph

One Vercel project, two [Vercel Services](https://vercel.com/docs/services) on one origin (KTD1). `web` is the Vite PWA in `apps/web`, served as static files. `api` is the Express app in `apps/api`, whose default export in `src/index.ts` is the handler. Public rewrites in `vercel.json` send `/api/(.*)` to `api` and everything else to `web`, and `web` rewrites every path to `/index.html` so deep links work. Express keeps the `/api` prefix in its routes. The API uses Neon Postgres for auth and sync, and Vercel Blob for custom exercise photos. No email provider is needed.

Sign-in is email + password (Better Auth). Nobody can sign up on their own: an admin generates a single-use invite link (`/invitacion/<token>`, valid 7 days) in Perfil → Invitar and sends it (WhatsApp, etc.). Opening it sets a password and creates the account. A link for an email that already has an account sets a new password on that same account (its data stay), which is how a forgotten password is recovered. Admins are the emails in `ADMIN_EMAILS`.

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

   Run it against the production database before the first release, and again whenever a change adds a migration (the latest is `0003_invites.sql`, which adds the server-only `invites` table). A preview branch starts as a copy of its parent, so a pull request that adds a migration must also apply it to its preview branch (take the connection string from the Neon console or from the preview's environment variables). The repository does not run migrations during the build.

## 3. Environment variables

Set these in Vercel → Settings → Environment Variables. The API reads them; the SPA reads none.

| Variable                | Environments        | Value                                                                                                                                                                                 | Read by                                          |
| ----------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `DATABASE_URL`          | Production, Preview | Neon pooled connection string. Set by the Neon integration; previews get their branch's URL.                                                                                          | `src/db/client.ts`, `drizzle.config.ts`          |
| `BETTER_AUTH_SECRET`    | Production, Preview | A random secret of at least 32 characters, e.g. `openssl rand -base64 32`. Use different values for Production and Preview.                                                           | `src/auth/auth.ts`                               |
| `BETTER_AUTH_URL`       | Production only     | The public origin, e.g. `https://training-log.example.com`. Leave it unset for Preview: each preview has its own URL, and without it Better Auth derives the origin from the request. | `src/auth/auth.ts`                               |
| `ADMIN_EMAILS`          | Production, Preview | Comma-separated emails that may generate invite links, e.g. `tu@email.com`. Checked on the server on every request; case-insensitive.                                                 | `src/auth/admins.ts`, `src/app.ts`               |
| `BLOB_READ_WRITE_TOKEN` | Production, Preview | Set by connecting a Vercel Blob store (next section).                                                                                                                                 | `src/uploads/router.ts`, `src/account/router.ts` |

Set by Vercel, not by you:

- `x-real-ip` / `x-forwarded-for`: the API reads the client IP from these for its rate limits (sign-in: 10 per minute per IP, 5 per email and IP and 30 per email in 15 minutes; invite redeem: 10 per IP in 15 minutes). Vercel overwrites both, so clients cannot spoof them there.
- `VERCEL_AUTOMATION_BYPASS_SECRET` exists once Protection Bypass for Automation is turned on (section 5).

For local development, copy `apps/api/.env.example` to `apps/api/.env`, run `pnpm dev`, and open the Vite dev server: it proxies `/api` to the Express process on port 3001.

## 4. The first admin account

Nobody can sign up without a link, so the first account comes from the command line, against the production database:

1. Add your email to `ADMIN_EMAILS` (section 3) and redeploy, so the deployment reads it.
2. Make sure the migrations are applied (section 2), including `0003_invites.sql`.
3. From the repository root, with the production connection string:

   ```sh
   DATABASE_URL="<production connection string>" pnpm --filter api invite tu@email.com --base-url https://<your-production-domain>
   ```

   `--base-url` defaults to `BETTER_AUTH_URL`. The command prints the link. It works once and lasts 7 days; running the command again for the same email replaces the previous link.
4. Open the link on your phone, set a password (at least 8 characters, twice) and complete onboarding.
5. Perfil now shows **Invitar**: type someone's email, tap **Generar enlace**, then **Copiar enlace** or **Compartir**. The list below shows pending, used, expired and revoked invites; a pending one can be revoked.

Forgotten password: generate a new link for that email (from Invitar, or with the command above for an admin who is locked out). Opening it sets a new password on the same account and signs out its other devices.

## 5. Vercel Blob

1. **Storage → Create → Blob**, and connect the store to the project for Production and Preview. This sets `BLOB_READ_WRITE_TOKEN`.
2. The API never uploads bytes itself. It hands out short-lived client tokens (KTD12) that allow only images, at most 2 MB, at one server-chosen path under the user's prefix. The client uploads with `access: 'public'`, so photo URLs are unguessable but public.
3. The exercise catalog ships with `imageUrl: null` for every entry (see `scripts/catalog/README.md`), so the catalog needs nothing in Blob until licensed images exist.

## 6. End-to-end tests

The suite lives in `apps/web/e2e/` and covers first open (F1), an offline workout (F2), finishing with routine changes (F3), two devices on one account (R7), and a reload during an active workout.

### Locally

```sh
cd apps/web && npx playwright install chromium   # once
pnpm test:e2e                                    # from the repository root
```

Playwright builds the SPA for production, serves it with `vite preview` on `http://localhost:4174`, and proxies `/api` to a test-only API process on port 3101 (`apps/api/src/e2e-server.ts`). That process runs the real Express app on an in-memory Postgres (PGlite) plus a `POST /api/__e2e/invite` route that mints invite links for the specs, which then set a password on the invitation page. It only starts with `E2E_TEST_MODE=1` outside production and is never imported by the deployed entrypoint. No database or Blob token is needed.

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
   - The specs insert invites straight into the preview branch's `invites` table, which is why `E2E_DATABASE_URL` must be that preview's branch, not production (and why that branch needs `0003_invites.sql`).
   - Every request carries `x-vercel-protection-bypass` and `x-vercel-set-bypass-cookie`.
   - No email is sent; the accounts are `e2e-<tag>-…@example.com`.

3. The API allows 10 invite redeems per IP in 15 minutes. One run redeems 5 invites from your IP, so wait 15 minutes between two full runs from the same machine.

## Release checklist

- [ ] Migrations applied to the production database, up to `0003_invites.sql`.
- [ ] All variables in section 3 set for Production; `BETTER_AUTH_URL` matches the production domain and `ADMIN_EMAILS` holds your email.
- [ ] First admin created with `pnpm --filter api invite` (section 4), signed in, and Perfil → Invitar visible.
- [ ] An invite link opened on a second phone creates an account; a second link for the same email sets a new password and keeps the data.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` pass locally, and the end-to-end suite passes against a preview.
- [ ] On a real iPhone and an Android phone: open an invite link, install to the home screen, sign in with the password, then log a workout in airplane mode and watch it sync when the connection returns.
