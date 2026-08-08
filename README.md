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
- Role-card generation uses OpenRouter (`OPENROUTER_API_KEY`) with ChatGPT 5.6 Luna by default (`OPENROUTER_MODEL=openai/gpt-5.6-luna`).
- `/career` redirects to `/`.
