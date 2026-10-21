-- Clan Hub UPALELE — base de dados inicial para Supabase/PostgreSQL
-- Execute apenas depois de criar um projeto Supabase.
-- A autenticação usa auth.users; nunca guarde tokens da API do Clash of Clans no browser.

create extension if not exists pgcrypto;

create type public.clan_role as enum ('member', 'elder', 'co_leader', 'leader');
create type public.punishment_status as enum ('active', 'completed', 'left_without_serving', 'expelled', 'cancelled');
create type public.war_status as enum ('preparation', 'in_war', 'ended', 'unknown');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  player_tag text unique,
  in_game_name text not null,
  role public.clan_role not null default 'member',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memorial_rules (
  id uuid primary key default gen_random_uuid(),
  section text not null,
  rule_number text,
  title text not null,
  body text not null,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ganchos/punições atuais. Os registros importados devem ser revisados antes de serem tratados como oficiais.
create table public.punishments (
  id uuid primary key default gen_random_uuid(),
  member_name text not null,
  player_tag text,
  applied_on date,
  punishment_label text not null,
  duration_wars integer,
  reason text,
  return_date date,
  status public.punishment_status not null default 'active',
  source_note text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cada edição cria uma trilha de auditoria; não apague o histórico original silenciosamente.
create table public.punishment_audit (
  id uuid primary key default gen_random_uuid(),
  punishment_id uuid not null references public.punishments(id) on delete restrict,
  action text not null check (action in ('created', 'updated', 'status_changed', 'corrected')),
  previous_data jsonb,
  new_data jsonb,
  note text,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);

create table public.roster_notes (
  id uuid primary key default gen_random_uuid(),
  member_name text not null,
  note_type text not null check (note_type in ('newcomer', 'multiple_accounts', 'temporary_inactivity', 'general')),
  details text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A API pode não expor todos os campos pretendidos. Esta tabela guarda apenas o que for efetivamente obtido.
create table public.wars (
  id uuid primary key default gen_random_uuid(),
  external_war_tag text unique,
  status public.war_status not null default 'unknown',
  war_type text,
  preparation_start timestamptz,
  war_start timestamptz,
  war_end timestamptz,
  team_size integer,
  clan_stars integer,
  opponent_stars integer,
  raw_payload jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.war_attacks (
  id uuid primary key default gen_random_uuid(),
  war_id uuid not null references public.wars(id) on delete cascade,
  attacker_tag text,
  attacker_name text,
  defender_tag text,
  defender_name text,
  attacker_map_position integer,
  defender_map_position integer,
  stars integer check (stars between 0 and 3),
  destruction_percent numeric(5,2) check (destruction_percent between 0 and 100),
  attack_order integer,
  external_attack_key text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (war_id, external_attack_key)
);

create table public.clan_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create or replace function public.current_clan_role()
returns public.clan_role
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles
  where id = auth.uid() and is_active = true
  limit 1
$$;

create or replace function public.is_clan_leadership()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(public.current_clan_role() in ('co_leader', 'leader'), false)
$$;

create or replace function public.is_clan_leader()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(public.current_clan_role() = 'leader', false)
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create or replace function public.audit_punishment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.punishment_audit (punishment_id, action, new_data, changed_by)
    values (new.id, 'created', to_jsonb(new), auth.uid());
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.punishment_audit (punishment_id, action, previous_data, new_data, note, changed_by)
    values (
      new.id,
      case when old.status is distinct from new.status then 'status_changed' else 'updated' end,
      to_jsonb(old),
      to_jsonb(new),
      null,
      auth.uid()
    );
    return new;
  end if;
  return new;
end
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger memorial_rules_updated_at before update on public.memorial_rules
for each row execute function public.set_updated_at();
create trigger punishments_updated_at before update on public.punishments
for each row execute function public.set_updated_at();
create trigger roster_notes_updated_at before update on public.roster_notes
for each row execute function public.set_updated_at();
create trigger wars_updated_at before update on public.wars
for each row execute function public.set_updated_at();
create trigger clan_settings_updated_at before update on public.clan_settings
for each row execute function public.set_updated_at();

create trigger punishment_audit_trigger
after insert or update on public.punishments
for each row execute function public.audit_punishment_change();

alter table public.profiles enable row level security;
alter table public.memorial_rules enable row level security;
alter table public.punishments enable row level security;
alter table public.punishment_audit enable row level security;
alter table public.roster_notes enable row level security;
alter table public.wars enable row level security;
alter table public.war_attacks enable row level security;
alter table public.clan_settings enable row level security;

-- Membros autenticados podem consultar o diretório do clã.
create policy "authenticated can read profiles"
on public.profiles for select to authenticated
using (true);
create policy "members can update own profile basics"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = public.current_clan_role());

-- Memorial publicado: leitura de todos os membros autenticados.
create policy "members read published memorial"
on public.memorial_rules for select to authenticated
using (is_published = true or public.is_clan_leadership());
create policy "leadership manages memorial"
on public.memorial_rules for all to authenticated
using (public.is_clan_leadership())
with check (public.is_clan_leadership());

-- Registros punitivos visíveis aos membros autenticados; edição só para colíder/líder.
create policy "members read punishments"
on public.punishments for select to authenticated
using (true);
create policy "leadership manages punishments"
on public.punishments for all to authenticated
using (public.is_clan_leadership())
with check (public.is_clan_leadership());
create policy "leadership reads audit"
on public.punishment_audit for select to authenticated
using (public.is_clan_leadership());
create policy "system writes punishment audit"
on public.punishment_audit for insert to authenticated
with check (public.is_clan_leadership());

create policy "members read roster notes"
on public.roster_notes for select to authenticated
using (true);
create policy "leadership manages roster notes"
on public.roster_notes for all to authenticated
using (public.is_clan_leadership())
with check (public.is_clan_leadership());

create policy "members read wars"
on public.wars for select to authenticated
using (true);
create policy "members read war attacks"
on public.war_attacks for select to authenticated
using (true);
create policy "leadership manages clan settings"
on public.clan_settings for all to authenticated
using (public.is_clan_leadership())
with check (public.is_clan_leadership());

-- IMPORTANTE:
-- 1. O primeiro líder precisa ser promovido por uma operação administrativa segura.
-- 2. Não permita que o próprio usuário altere o campo role por uma tela comum.
-- 3. Para a API do Clash of Clans, use função/server route protegida e variável de ambiente.
-- 4. Configure também a validação de e-mail, convite/allowlist e o processo de primeiro líder.
-- 5. A tabela de votos da liderança fica fora desta primeira migração, pois o memorial interno ainda será enviado.
