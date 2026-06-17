-- Estadísticas detalladas por jugador y jornada (goles, asistencias, tarjetas y
-- minutos). Se rellenan desde la API de LaLiga (cron sync-stats) y alimentan las
-- estadísticas de la vista Jornada (goles/tarjetas por equipo y récords de liga).
alter table public.fantasy_player_week_points
  add column if not exists goals integer not null default 0,
  add column if not exists assists integer not null default 0,
  add column if not exists yellow_cards integer not null default 0,
  add column if not exists red_cards integer not null default 0,
  add column if not exists minutes integer not null default 0;
