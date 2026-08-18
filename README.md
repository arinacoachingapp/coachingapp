# Career Companion

React + Vite + Tailwind CSS (JavaScript). Career Companion is the main app at `/`.

Professional Role interviews are driven by:

- **P1** — `src/prompts/Professional_Role_Interviewer_P1_v1.1.md` (live interviewer)
- **Bank** — `src/prompts/Professional_Role_Interview_Prompt_v1.1.yaml` (authoring source) → slim runtime in `server/interview/questionBank.runtime.js`
- **P2** — role card generation in `server/generateRoleCard.js`

The interview is conversational: the model may probe between bank questions within a session probe budget. The app owns sequence, conditionals, and the card gate.

## Setup

Requires Node.js 20+ (`.nvmrc` pins Node 24).

```bash
nvm use
cp .env.example .env   # then fill in Supabase + OpenRouter (+ ElevenLabs for neural TTS)
npm install
```

### Database

Run the migration that adds conversational state:

```sql
-- supabase/migrations/20260813_interview_state.sql
alter table career_sessions
  add column if not exists interview_state jsonb;
```

Apply in the Supabase SQL editor (or your usual migration path).

```bash
npm run dev
```

## Scripts

- `npm run dev` — Vite dev server (career + admin + voice APIs)
- `npm run build` — production build to `dist/`
- `npm start` — serve `dist/` + API (after build)
- `npm run lint` — oxlint

## Voice

- **TTS** — ElevenLabs neural speech via `POST /api/career/speak` (JSON `{ audioBase64 }`). Requires `ELEVENLABS_API_KEY` on the server (Vercel env), not only locally.
- **STT** — MediaRecorder → OpenRouter Whisper via `POST /api/career/transcribe` (punctuated text; light polish when needed)

## Admin prompts

Admins can edit interviewer / role-card prompts at `/admin`, with full version history and restore.
Under **Models**, admins can also set:

- OpenRouter chat model (interviews + role cards)
- ElevenLabs TTS model
- Default narrator voice for users who have not chosen one

1. Run `supabase/migrations/20260813_admin_prompts.sql` in the Supabase SQL editor.
2. Run `supabase/migrations/20260817_app_settings.sql` for model/voice defaults.
3. Replace the seed email:

```sql
insert into app_admins (email, created_by)
values ('you@yourdomain.com', 'setup')
on conflict (email) do nothing;

-- optional: remove the placeholder
delete from app_admins where email = 'admin@example.com';
```

4. Sign in with that email → **Admin** appears in the header.

Editable prompts (stored in `app_prompts` / `app_prompt_versions`):

- `interviewer_p1` — live interview system prompt
- `structured_output` — probe/advance JSON instructions
- `role_card_p2` — role card template (`{{META}}`, `{{TRANSCRIPT}}`)
- `question_bank` — runtime JSON used by the interview engine
- `question_bank_authoring` — full YAML design doc (reference)

Until prompts are seeded (first admin list load, or a save), the app falls back to the built-in file defaults.

## Vercel

Set these env vars in the Vercel project (Production + Preview):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SITE_URL` (your Vercel URL, e.g. `https://your-app.vercel.app`)
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` (optional)
- `OPENROUTER_STT_MODEL` (optional; default `openai/whisper-1`)
- `ELEVENLABS_API_KEY` (neural TTS)
- `ELEVENLABS_VOICE_ID` (optional)

API routes include interview, role card, speak, transcribe, and admin. Redeploy after adding env vars.
