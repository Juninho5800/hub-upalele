-- Integra votação aprovada a ganchos ativos, sem alterar nem apagar registros antigos.
alter table public.leadership_votes
  add column if not exists punishment_member_name text,
  add column if not exists punishment_label text,
  add column if not exists punishment_duration_wars integer,
  add column if not exists punishment_reason text,
  add column if not exists punishment_approval_option_id uuid;

alter table public.punishments
  add column if not exists source_vote_id uuid references public.leadership_votes(id) on delete restrict;

create unique index if not exists punishments_source_vote_uidx
  on public.punishments(source_vote_id) where source_vote_id is not null;

-- A opção de aprovação deve pertencer à própria votação.
DO $$ BEGIN
  ALTER TABLE public.leadership_votes
    ADD CONSTRAINT leadership_votes_approval_option_fk
    FOREIGN KEY (id, punishment_approval_option_id)
    REFERENCES public.leadership_vote_options(vote_id, id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

create index if not exists punishments_return_date_status_idx
  on public.punishments(status, return_date);
