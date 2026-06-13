alter function private.fantasy_set_updated_at() set search_path = pg_catalog;

create index fantasy_audit_log_actor_user_idx on public.fantasy_audit_log(actor_user_id);
create index fantasy_chat_messages_user_idx on public.fantasy_chat_messages(user_id);
create index fantasy_fixtures_away_team_idx on public.fantasy_fixtures(away_team_id);
create index fantasy_fixtures_home_team_idx on public.fantasy_fixtures(home_team_id);
create index fantasy_leagues_owner_idx on public.fantasy_leagues(owner_id);
create index fantasy_lineups_captain_player_idx on public.fantasy_lineups(captain_player_id);
create index fantasy_market_listings_player_idx on public.fantasy_market_listings(player_id);
create index fantasy_market_listings_seller_idx on public.fantasy_market_listings(seller_member_id);
create index fantasy_notifications_league_idx on public.fantasy_notifications(league_id);
create index fantasy_transfers_from_member_idx on public.fantasy_transfers(from_member_id);
create index fantasy_transfers_league_idx on public.fantasy_transfers(league_id);
create index fantasy_transfers_listing_idx on public.fantasy_transfers(listing_id);
create index fantasy_transfers_player_idx on public.fantasy_transfers(player_id);
create index fantasy_transfers_to_member_idx on public.fantasy_transfers(to_member_id);
