# Career Companion

React + Vite + Tailwind CSS (JavaScript). Career Companion is the main app at `/`.

## Setup

Requires Node.js 20+ (`.nvmrc` pins Node 24).

```bash
nvm use
cp .env.example .env   # then fill in Supabase + OpenRouter keys
npm install
npm run dev
```

## Scripts

- `npm run dev` — Vite dev server (includes `/api/career/generate-role-card`)
- `npm run build` — production build to `dist/`
- `npm start` — serve `dist/` + API (after build)
- `npm run lint` — oxlint

## Notes

- Auth and sessions use Supabase (`VITE_SUPABASE_*`).
- Role-card generation uses OpenRouter (`OPENROUTER_API_KEY`; model via `OPENROUTER_MODEL`).
- `/career` redirects to `/`.

## Vercel

Set these env vars in the Vercel project (Production + Preview):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SITE_URL` (your Vercel URL, e.g. `https://your-app.vercel.app`)
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` (optional)

`POST /api/career/generate-role-card` is a Vercel Serverless Function (`api/career/generate-role-card.js`). Redeploy after adding env vars. Role-card generation can take a while — Hobby plans cap functions at ~10s; Pro allows the configured 60s.
