create or replace function public.fantasy_league_player_stats(p_league_id uuid)
returns table(player_id uuid, season_points numeric, rounds integer, last_points numeric)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select s.player_id,
         coalesce(sum(s.points), 0) as season_points,
         count(*)::int as rounds,
         (array_agg(s.points order by m.number desc))[1] as last_points
  from public.fantasy_player_scores s
  join public.fantasy_matchdays m on m.id = s.matchday_id
  where s.league_id = p_league_id
    and (select private.fantasy_server_authorized())
  group by s.player_id
$$;

revoke all on function public.fantasy_league_player_stats(uuid) from public, anon, authenticated;
grant execute on function public.fantasy_league_player_stats(uuid) to anon, service_role;
