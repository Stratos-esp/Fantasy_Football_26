alter table public.fantasy_players add column current_value numeric(12,2) not null default 0;
alter table public.fantasy_leagues add column current_matchday integer not null default 1;
alter table public.fantasy_league_members add column color text;
alter table public.fantasy_transfers alter column to_member_id drop not null;

create type public.fantasy_offer_status as enum ('pending', 'accepted', 'rejected', 'cancelled');

create table public.fantasy_direct_offers (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.fantasy_leagues(id) on delete cascade,
  player_id uuid not null references public.fantasy_players(id),
  from_member_id uuid not null references public.fantasy_league_members(id) on delete cascade,
  to_member_id uuid not null references public.fantasy_league_members(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  status public.fantasy_offer_status not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index fantasy_direct_offers_league_status_idx on public.fantasy_direct_offers(league_id, status);
create index fantasy_direct_offers_to_member_idx on public.fantasy_direct_offers(to_member_id);
create index fantasy_direct_offers_from_member_idx on public.fantasy_direct_offers(from_member_id);
create index fantasy_direct_offers_player_idx on public.fantasy_direct_offers(player_id);
create index fantasy_player_scores_league_player_idx on public.fantasy_player_scores(league_id, player_id);

alter table public.fantasy_direct_offers enable row level security;
revoke all on table public.fantasy_direct_offers from anon, authenticated;
grant select, insert, update, delete on table public.fantasy_direct_offers to service_role;
grant select, insert, update, delete on table public.fantasy_direct_offers to anon;
create policy fantasy_server_access on public.fantasy_direct_offers
  for all to anon
  using ((select private.fantasy_server_authorized()))
  with check ((select private.fantasy_server_authorized()));
