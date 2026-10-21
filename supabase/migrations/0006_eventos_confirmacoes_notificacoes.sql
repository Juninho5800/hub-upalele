-- Recursos operacionais adicionais do Clan Hub UPALELE.
-- Execute somente depois de conferir as migrações 0001 a 0005 e antes de ativar as telas correspondentes.
create table if not exists public.clan_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 160),
  category text not null default 'Outro' check (category in ('Guerra','Liga de Guerra','Raide','Jogos do Clã','Doações','Inatividade','Reunião','Outro')),
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);
create index if not exists clan_events_status_start_idx on public.clan_events(status, starts_at desc);
alter table public.clan_events enable row level security;
drop policy if exists "members read clan events" on public.clan_events;
create policy "members read clan events" on public.clan_events for select to authenticated using (true);
drop policy if exists "leadership creates clan events" on public.clan_events;
create policy "leadership creates clan events" on public.clan_events for insert to authenticated with check (public.is_clan_leadership() and created_by = auth.uid());
drop policy if exists "leadership updates clan events" on public.clan_events;
create policy "leadership updates clan events" on public.clan_events for update to authenticated using (public.is_clan_leadership()) with check (public.is_clan_leadership());
drop trigger if exists clan_events_updated_at on public.clan_events;
create trigger clan_events_updated_at before update on public.clan_events for each row execute function public.set_updated_at();

create table if not exists public.memorial_read_confirmations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  memorial_version text not null default 'current',
  confirmed_at timestamptz not null default now(),
  unique(profile_id, memorial_version)
);
alter table public.memorial_read_confirmations enable row level security;
drop policy if exists "members read own memorial confirmations" on public.memorial_read_confirmations;
create policy "members read own memorial confirmations" on public.memorial_read_confirmations for select to authenticated using (profile_id = auth.uid() or public.is_clan_leadership());
drop policy if exists "members confirm own memorial reading" on public.memorial_read_confirmations;
create policy "members confirm own memorial reading" on public.memorial_read_confirmations for insert to authenticated with check (profile_id = auth.uid());

create table if not exists public.clan_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  related_table text,
  related_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists clan_notifications_recipient_created_idx on public.clan_notifications(recipient_id, created_at desc);
alter table public.clan_notifications enable row level security;
drop policy if exists "members read own notifications" on public.clan_notifications;
create policy "members read own notifications" on public.clan_notifications for select to authenticated using (recipient_id = auth.uid() or (recipient_id is null and public.is_clan_leadership()));
drop policy if exists "members mark own notifications read" on public.clan_notifications;
create policy "members mark own notifications read" on public.clan_notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
