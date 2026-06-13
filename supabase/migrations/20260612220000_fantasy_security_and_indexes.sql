alter function public.fantasy_league_player_stats(uuid) security invoker;

create index if not exists fantasy_bids_bidder_member_idx
  on public.fantasy_bids(bidder_member_id);

create index if not exists fantasy_league_members_user_idx
  on public.fantasy_league_members(user_id);

create index if not exists fantasy_lineup_players_player_idx
  on public.fantasy_lineup_players(player_id);

create index if not exists fantasy_lineups_member_idx
  on public.fantasy_lineups(league_member_id);

create index if not exists fantasy_player_match_stats_player_idx
  on public.fantasy_player_match_stats(player_id);

create index if not exists fantasy_player_scores_matchday_idx
  on public.fantasy_player_scores(matchday_id);

create index if not exists fantasy_player_scores_player_idx
  on public.fantasy_player_scores(player_id);
