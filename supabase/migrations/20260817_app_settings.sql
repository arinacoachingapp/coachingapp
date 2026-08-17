-- App runtime settings (OpenRouter model, ElevenLabs model/voice defaults)

create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by_email text
);

comment on table app_settings is
  'Admin-editable runtime config: openrouter_model, elevenlabs_model_id, default_elevenlabs_voice_id';

alter table app_settings enable row level security;

-- Any signed-in user can read (needed for default voice + server handlers)
drop policy if exists app_settings_select on app_settings;
create policy app_settings_select on app_settings
  for select to authenticated
  using (true);

drop policy if exists app_settings_insert on app_settings;
create policy app_settings_insert on app_settings
  for insert to authenticated
  with check (public.is_app_admin());

drop policy if exists app_settings_update on app_settings;
create policy app_settings_update on app_settings
  for update to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists app_settings_delete on app_settings;
create policy app_settings_delete on app_settings
  for delete to authenticated
  using (public.is_app_admin());

-- Seed empty defaults only if missing (admins can change in UI)
insert into app_settings (key, value, updated_by_email)
values
  ('openrouter_model', 'openai/gpt-5.6-luna', 'migration'),
  ('elevenlabs_model_id', 'eleven_multilingual_v2', 'migration'),
  ('default_elevenlabs_voice_id', 'kdmDKE6EkgrWrrykO9Qt', 'migration')
on conflict (key) do nothing;
