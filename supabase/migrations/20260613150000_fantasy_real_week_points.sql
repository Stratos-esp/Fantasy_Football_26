-- Puntos fantasy reales por jugador y jornada (importados de LaLiga Fantasy).
create table public.fantasy_player_week_points (
  player_id uuid not null references public.fantasy_players(id) on delete cascade,
  week integer not null,
  points numeric(8,2) not null default 0,
  played boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (player_id, week)
);
create index fantasy_player_week_points_week_idx on public.fantasy_player_week_points(week);

alter table public.fantasy_player_week_points enable row level security;
revoke all on table public.fantasy_player_week_points from anon, authenticated;
grant select, insert, update, delete on table public.fantasy_player_week_points to service_role;
grant select, insert, update, delete on table public.fantasy_player_week_points to anon;
create policy fantasy_server_access on public.fantasy_player_week_points
  for all to anon
  using ((select private.fantasy_server_authorized()))
  with check ((select private.fantasy_server_authorized()));
