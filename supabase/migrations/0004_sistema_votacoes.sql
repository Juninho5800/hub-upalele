-- Clan Hub UPALELE — sistema de votação da liderança
-- Execute este arquivo uma única vez no Supabase SQL Editor, após as migrações anteriores.

create table if not exists public.leadership_votes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 160),
  description text not null default '',
  category text not null default 'Geral' check (category in ('Geral','Punição','Guerra','Gestão','Atribuições','Outro')),
  status text not null default 'open' check (status in ('open','closed','cancelled')),
  created_by uuid not null references public.profiles(id),
  deadline timestamptz not null default (now() + interval '24 hours'),
  tie_break_option_id uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leadership_vote_options (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid not null references public.leadership_votes(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 180),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (vote_id, label),
  unique (vote_id, id)
);

create table if not exists public.leadership_vote_ballots (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid not null references public.leadership_votes(id) on delete cascade,
  option_id uuid not null,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint leadership_vote_ballots_option_fk foreign key (vote_id, option_id)
    references public.leadership_vote_options(vote_id, id) on delete cascade,
  unique (vote_id, voter_id)
);

alter table public.leadership_votes enable row level security;
alter table public.leadership_vote_options enable row level security;
alter table public.leadership_vote_ballots enable row level security;

-- Apenas líder e colíderes ativos consultam votações e resultados.
create policy "leadership reads votes" on public.leadership_votes
for select to authenticated using (public.is_clan_leadership());
create policy "leadership creates votes" on public.leadership_votes
for insert to authenticated with check (
  public.is_clan_leadership() and created_by = auth.uid()
);
create policy "leadership updates votes" on public.leadership_votes
for update to authenticated using (public.is_clan_leadership())
with check (public.is_clan_leadership());

create policy "leadership reads vote options" on public.leadership_vote_options
for select to authenticated using (public.is_clan_leadership());
create policy "creator adds vote options" on public.leadership_vote_options
for insert to authenticated with check (
  public.is_clan_leadership() and exists (
    select 1 from public.leadership_votes v
    where v.id = vote_id and v.created_by = auth.uid() and v.status = 'open'
  )
);

create policy "leadership reads ballots" on public.leadership_vote_ballots
for select to authenticated using (public.is_clan_leadership());
create policy "leadership casts one ballot" on public.leadership_vote_ballots
for insert to authenticated with check (
  public.is_clan_leadership()
  and voter_id = auth.uid()
  and exists (
    select 1 from public.leadership_votes v
    where v.id = vote_id and v.status = 'open' and v.deadline > now()
  )
  and exists (
    select 1 from public.leadership_vote_options o
    where o.id = leadership_vote_ballots.option_id and o.vote_id = leadership_vote_ballots.vote_id
  )
);

create index if not exists leadership_votes_status_deadline_idx
  on public.leadership_votes(status, deadline desc);
create index if not exists leadership_vote_options_vote_idx
  on public.leadership_vote_options(vote_id, sort_order);
create index if not exists leadership_vote_ballots_vote_idx
  on public.leadership_vote_ballots(vote_id);

create trigger leadership_votes_updated_at before update on public.leadership_votes
for each row execute function public.set_updated_at();

-- O desempate é uma competência exclusiva do líder, inclusive fora da interface.
create or replace function public.guard_leadership_vote_tie_break()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tie_break_option_id is distinct from old.tie_break_option_id then
    if not public.is_clan_leader() then
      raise exception 'Somente o líder pode registrar o voto de desempate.';
    end if;
    if new.tie_break_option_id is not null and not exists (
      select 1 from public.leadership_vote_options o
      where o.id = new.tie_break_option_id and o.vote_id = new.id
    ) then
      raise exception 'A opção de desempate precisa pertencer a esta votação.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists leadership_vote_tie_break_guard on public.leadership_votes;
create trigger leadership_vote_tie_break_guard
before update on public.leadership_votes
for each row execute function public.guard_leadership_vote_tie_break();
