# CodeLink

Tell your AI "publish this with CodeLink" and the code lands in a GitHub repo and goes live on Vercel.
The AI gets back a project ID (`cl_xxxxxxxx`) it reuses for every update.

## How it works

1. A user signs in with GitHub (OAuth, `repo` scope), pastes a Vercel token, and creates an API key.
2. They connect their AI to the CodeLink MCP server (`/api/mcp`) or the REST API (`/api/v1/*`).
3. On `publish`, CodeLink:
   - validates the files (skips `.env`, `node_modules`, build output; 500 files / 4 MB max),
   - creates a private GitHub repo and a Vercel project (first publish only),
   - commits the files as a full snapshot through the Git Data API,
   - deploys the same files through the Vercel Deployments API, with the framework detected from `package.json`.
4. `get_status` polls Vercel and returns the live URL, or the build log tail on failure so the AI can fix it and republish.

Deploys go straight to Vercel with the files, so users don't need Vercel's GitHub app installed.
GitHub is the source of record; CodeLink redeploys on every publish.

## Setup (about 15 minutes)

1. **Supabase**: create a project, open the SQL editor, run `supabase/schema.sql`.
2. **GitHub OAuth App**: github.com/settings/developers → New OAuth App.
   - Homepage URL: your CodeLink URL
   - Callback URL: `https://YOUR-DOMAIN/api/auth/github/callback`
3. **Env vars**: copy `.env.example` to `.env.local` and fill it in. Generate secrets with `openssl rand -base64 48`.
4. **Run locally**: `npm install && npm run dev` (use a second OAuth App with a localhost callback for local dev).
5. **Deploy**: push to GitHub, import into Vercel, add the same env vars (with `APP_URL` set to the production URL).

Never change `ENCRYPTION_KEY` after users connect: stored tokens become unreadable.

## Layout

```
app/
  page.tsx                     landing page
  docs/page.tsx                setup + API reference
  dashboard/page.tsx           setup, API keys, connect snippets, projects, zip upload
  dashboard/projects/[id]/     status, build errors, publish history
  api/mcp/route.ts             MCP server (stateless Streamable HTTP)
  api/v1/...                   REST API: publish, projects, status, env
  api/auth/github/...          GitHub OAuth sign-in
  api/settings/vercel          save/verify the Vercel token
  api/keys                     create/revoke API keys
lib/
  publish.ts                   core: publish, getStatus, setEnv, listProjects
  github.ts, vercel.ts         API clients
  files.ts                     validation, blocked paths, framework detection
  auth.ts, session.ts          API-key and cookie auth
  crypto.ts                    AES-256-GCM token encryption, key hashing, IDs
supabase/schema.sql
```

## Security notes

- GitHub and Vercel tokens are encrypted at rest (AES-256-GCM). API keys are stored as SHA-256 hashes and shown once.
- All database access is server-side with the service role key; RLS is on with no policies, so the anon key reads nothing.
- New repos are private by default.

## Worth adding next

- Rate limiting per API key (e.g. Upstash) before opening sign-ups widely.
- Vercel's integration OAuth flow in place of pasted tokens (requires registering a Vercel integration).
- Custom domains, project deletion, and a "claim/transfer" flow.
- Blob-upload deployments (`/v2/files`) for projects larger than the 4.5 MB function body limit.
