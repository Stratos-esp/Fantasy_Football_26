-- Historial inmutable por jornada: congela la clasificación y las plantillas de
-- cada jornada disputada, para que no se pierdan aunque después cambien valores,
-- normas o la lógica de la app. Idempotente por (liga, jornada) para poder
-- recalcular en el futuro (p. ej. partidos aplazados).

create table if not exists public.fantasy_standings_history (
  id bigint generated always as identity primary key,
  league_id uuid not null references public.fantasy_leagues(id) on delete cascade,
  matchday_number integer not null,
  member_id uuid not null references public.fantasy_league_members(id) on delete cascade,
  round_points numeric(10,2) not null default 0,
  total_points numeric(10,2) not null default 0,
  rank integer not null default 0,
  squad_value numeric(14,2) not null default 0,
  budget numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (league_id, matchday_number, member_id)
);
create index if not exists idx_standings_history_league on public.fantasy_standings_history (league_id, matchday_number);
alter table public.fantasy_standings_history enable row level security;

create table if not exists public.fantasy_squad_history (
  id bigint generated always as identity primary key,
  league_id uuid not null references public.fantasy_leagues(id) on delete cascade,
  matchday_number integer not null,
  member_id uuid not null references public.fantasy_league_members(id) on delete cascade,
  player_id uuid not null references public.fantasy_players(id) on delete cascade,
  value_at numeric(14,2) not null default 0,
  is_starter boolean not null default false,
  created_at timestamptz not null default now(),
  unique (league_id, matchday_number, member_id, player_id)
);
create index if not exists idx_squad_history_league on public.fantasy_squad_history (league_id, matchday_number, member_id);
alter table public.fantasy_squad_history enable row level security;

-- Acceso del backend (mismo patrón de secreto que el resto de tablas).
grant select, insert, update, delete on table public.fantasy_standings_history to anon;
grant select, insert, update, delete on table public.fantasy_squad_history to anon;
create policy fantasy_server_access on public.fantasy_standings_history
  for all to anon
  using ((select private.fantasy_server_authorized()))
  with check ((select private.fantasy_server_authorized()));
create policy fantasy_server_access on public.fantasy_squad_history
  for all to anon
  using ((select private.fantasy_server_authorized()))
  with check ((select private.fantasy_server_authorized()));

-- Bucket privado para las copias de seguridad mensuales (cron /api/cron/backup).
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

-- Permite al backend (con el secreto) subir/leer los backups en ese bucket.
create policy fantasy_backup_access on storage.objects
  for all to anon
  using (bucket_id = 'backups' and (select private.fantasy_server_authorized()))
  with check (bucket_id = 'backups' and (select private.fantasy_server_authorized()));
