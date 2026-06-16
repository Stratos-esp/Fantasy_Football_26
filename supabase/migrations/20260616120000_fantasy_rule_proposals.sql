-- Votación de cambios de normas/reglas de la liga.
-- Cualquier miembro propone un cambio de ajustes y el resto vota; se aplica por
-- mayoría de todos los miembros de la liga.

create table if not exists public.fantasy_rule_proposals (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.fantasy_leagues(id) on delete cascade,
  proposed_by uuid references public.fantasy_league_members(id) on delete set null,
  summary text not null,
  settings jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.fantasy_rule_votes (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.fantasy_rule_proposals(id) on delete cascade,
  member_id uuid not null references public.fantasy_league_members(id) on delete cascade,
  approve boolean not null,
  created_at timestamptz not null default now(),
  unique (proposal_id, member_id)
);

create index if not exists idx_fantasy_rule_proposals_league on public.fantasy_rule_proposals(league_id, status);
create index if not exists idx_fantasy_rule_votes_proposal on public.fantasy_rule_votes(proposal_id);

alter table public.fantasy_rule_proposals enable row level security;
alter table public.fantasy_rule_votes enable row level security;

grant select, insert, update, delete on table public.fantasy_rule_proposals to anon;
grant select, insert, update, delete on table public.fantasy_rule_votes to anon;

drop policy if exists fantasy_server_access on public.fantasy_rule_proposals;
create policy fantasy_server_access on public.fantasy_rule_proposals
  for all to anon
  using ((select private.fantasy_server_authorized()))
  with check ((select private.fantasy_server_authorized()));

drop policy if exists fantasy_server_access on public.fantasy_rule_votes;
create policy fantasy_server_access on public.fantasy_rule_votes
  for all to anon
  using ((select private.fantasy_server_authorized()))
  with check ((select private.fantasy_server_authorized()));
