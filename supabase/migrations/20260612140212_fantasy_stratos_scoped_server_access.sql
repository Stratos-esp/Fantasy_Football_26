create table private.fantasy_server_config (
  singleton boolean primary key default true check (singleton),
  secret_hash bytea not null,
  rotated_at timestamptz not null default now()
);

revoke all on table private.fantasy_server_config from public, anon, authenticated;
grant select on table private.fantasy_server_config to service_role;

create function private.fantasy_server_authorized()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from private.fantasy_server_config
    where singleton
      and secret_hash = extensions.digest(
        coalesce(pg_catalog.current_setting('request.headers', true)::jsonb ->> 'x-fantasy-server-secret', ''),
        'sha256'
      )
  );
$$;

revoke all on function private.fantasy_server_authorized() from public, anon, authenticated;
grant usage on schema private to anon;
grant execute on function private.fantasy_server_authorized() to anon, service_role;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'fantasy_users','fantasy_sessions','fantasy_leagues','fantasy_league_members','fantasy_teams','fantasy_players','fantasy_player_values',
    'fantasy_squads','fantasy_matchdays','fantasy_lineups','fantasy_lineup_players','fantasy_market_listings','fantasy_bids','fantasy_transfers',
    'fantasy_fixtures','fantasy_player_match_stats','fantasy_player_scores','fantasy_chat_messages','fantasy_notifications','fantasy_audit_log'
  ] loop
    execute format('grant select, insert, update, delete on table public.%I to anon', table_name);
    execute format(
      'create policy fantasy_server_access on public.%I for all to anon using ((select private.fantasy_server_authorized())) with check ((select private.fantasy_server_authorized()))',
      table_name
    );
  end loop;
end $$;

grant usage, select on sequence public.fantasy_player_values_id_seq to anon;
grant usage, select on sequence public.fantasy_audit_log_id_seq to anon;
