-- Repair names that were stored after UTF-8 bytes were decoded as Latin-1.
update public.fantasy_users
set display_name = convert_from(convert_to(display_name, 'LATIN1'), 'UTF8')
where position(U&'\00C3' in display_name) > 0
  and position(U&'\FFFD' in display_name) = 0;

update public.fantasy_league_members
set team_name = convert_from(convert_to(team_name, 'LATIN1'), 'UTF8')
where position(U&'\00C3' in team_name) > 0
  and position(U&'\FFFD' in team_name) = 0;

-- These production records already contain a replacement sequence, so the
-- original accent cannot be reconstructed generically.
update public.fantasy_users
set display_name = U&'Administraci\00F3n'
where username = 'administracion';

update public.fantasy_users
set display_name = U&'Denis Gonz\00E1lez'
where username = 'denis.gonzalez';

update public.fantasy_users
set display_name = U&'Ram\00F3n Ruiz'
where username = 'ramon.ruiz';
