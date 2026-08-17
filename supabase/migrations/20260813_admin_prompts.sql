-- Admin emails, editable prompts, and version history

create table if not exists app_admins (
  email text primary key,
  created_at timestamptz not null default now(),
  created_by text
);

create table if not exists app_prompts (
  key text primary key,
  title text not null,
  description text not null default '',
  format text not null default 'markdown'
    check (format in ('markdown', 'text', 'json', 'yaml')),
  content text not null,
  current_version int not null default 1,
  updated_at timestamptz not null default now(),
  updated_by_email text
);

create table if not exists app_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_key text not null references app_prompts(key) on delete cascade,
  version int not null,
  content text not null,
  change_note text not null default '',
  created_at timestamptz not null default now(),
  created_by_email text,
  unique (prompt_key, version)
);

create index if not exists app_prompt_versions_key_version_idx
  on app_prompt_versions (prompt_key, version desc);

-- Helper: is the JWT email an admin?
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.is_app_admin() to anon;

alter table app_admins enable row level security;
alter table app_prompts enable row level security;
alter table app_prompt_versions enable row level security;

-- Admins: only admins can read/write the admin list
drop policy if exists app_admins_select on app_admins;
create policy app_admins_select on app_admins
  for select to authenticated
  using (public.is_app_admin());

drop policy if exists app_admins_insert on app_admins;
create policy app_admins_insert on app_admins
  for insert to authenticated
  with check (public.is_app_admin());

drop policy if exists app_admins_delete on app_admins;
create policy app_admins_delete on app_admins
  for delete to authenticated
  using (public.is_app_admin());

-- Prompts: any signed-in user can read (interview APIs need them);
-- only admins can write
drop policy if exists app_prompts_select on app_prompts;
create policy app_prompts_select on app_prompts
  for select to authenticated
  using (true);

drop policy if exists app_prompts_insert on app_prompts;
create policy app_prompts_insert on app_prompts
  for insert to authenticated
  with check (public.is_app_admin());

drop policy if exists app_prompts_update on app_prompts;
create policy app_prompts_update on app_prompts
  for update to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- Versions: authenticated read; admin write
drop policy if exists app_prompt_versions_select on app_prompt_versions;
create policy app_prompt_versions_select on app_prompt_versions
  for select to authenticated
  using (true);

drop policy if exists app_prompt_versions_insert on app_prompt_versions;
create policy app_prompt_versions_insert on app_prompt_versions
  for insert to authenticated
  with check (public.is_app_admin());

-- Seed your first admin (edit this email before or after running):
insert into app_admins (email, created_by)
values ('admin@example.com', 'migration')
on conflict (email) do nothing;
