-- 1) Inversión en cláusula con coste configurable (p. ej. 2 € por cada € de
--    subida = relación 2:1). 2) Permitir endeudarse hasta un % del valor del
--    equipo al fichar (el saldo puede quedar en negativo).

drop function if exists public.fantasy_increase_clause(uuid, uuid, uuid, numeric);

create or replace function public.fantasy_increase_clause(
  p_league_id uuid,
  p_player_id uuid,
  p_member uuid,
  p_amount numeric,
  p_cost numeric
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_budget numeric;
  v_clause numeric;
  v_base numeric;
  v_found boolean;
  v_increase numeric;
begin
  if not (select private.fantasy_server_authorized()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Indica una cantidad válida.'; end if;
  if p_cost is null or p_cost <= 0 then raise exception 'Coste de cláusula no válido.'; end if;

  perform 1 from public.fantasy_league_members where id = p_member for update;
  select budget into v_budget from public.fantasy_league_members where id = p_member;
  if v_budget is null then raise exception 'Mánager no encontrado.'; end if;
  if v_budget < p_amount then raise exception 'No tienes saldo suficiente para esa inversión.'; end if;

  select clause_value, true into v_clause, v_found
    from public.fantasy_squads
    where league_member_id = p_member and player_id = p_player_id;
  if v_found is distinct from true then raise exception 'Ese jugador no está en tu plantilla.'; end if;
  if v_clause is null then
    select current_value into v_base from public.fantasy_players where id = p_player_id;
    v_clause := coalesce(v_base, 0);
  end if;

  v_increase := round(p_amount / p_cost);
  update public.fantasy_squads set clause_value = v_clause + v_increase where league_member_id = p_member and player_id = p_player_id;
  update public.fantasy_league_members set budget = budget - p_amount where id = p_member;

  return jsonb_build_object('ok', true, 'clause', v_clause + v_increase);
end;
$$;

revoke all on function public.fantasy_increase_clause(uuid, uuid, uuid, numeric, numeric) from public, anon, authenticated;
grant execute on function public.fantasy_increase_clause(uuid, uuid, uuid, numeric, numeric) to anon, service_role;

-- Transferencia atómica con límite de deuda configurable.
drop function if exists public.fantasy_execute_transfer(uuid, uuid, uuid, uuid, numeric, public.fantasy_market_kind, uuid, numeric, integer);

create or replace function public.fantasy_execute_transfer(
  p_league_id uuid,
  p_player_id uuid,
  p_from_member uuid,
  p_to_member uuid,
  p_amount numeric,
  p_kind public.fantasy_market_kind,
  p_listing_id uuid,
  p_clause_multiplier numeric,
  p_squad_size integer,
  p_max_debt_pct numeric
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_player_name text;
  v_buyer_budget numeric;
  v_count integer;
  v_clause numeric;
  v_debt numeric;
begin
  if not (select private.fantasy_server_authorized()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if p_listing_id is not null then
    perform 1 from public.fantasy_market_listings where id = p_listing_id and status = 'open' for update;
    if not found then raise exception 'Esta operación ya no está disponible.'; end if;
  end if;

  select name into v_player_name from public.fantasy_players where id = p_player_id;

  perform 1 from public.fantasy_league_members where id in (p_from_member, p_to_member) order by id for update;

  if p_to_member is not null then
    select budget into v_buyer_budget from public.fantasy_league_members where id = p_to_member;
    -- Deuda permitida: % del valor de mercado del equipo del comprador.
    v_debt := floor(coalesce((
      select sum(pl.current_value)
      from public.fantasy_squads s
      join public.fantasy_players pl on pl.id = s.player_id
      where s.league_member_id = p_to_member
    ), 0) * coalesce(p_max_debt_pct, 0) / 100.0);
    if v_buyer_budget + v_debt < p_amount then raise exception 'Te endeudarías por encima del límite permitido.'; end if;
    if exists (select 1 from public.fantasy_squads where league_member_id = p_to_member and player_id = p_player_id) then
      raise exception 'Ese jugador ya está en tu plantilla.';
    end if;
    select count(*) into v_count from public.fantasy_squads where league_member_id = p_to_member;
    if v_count >= p_squad_size + 5 then raise exception 'Tu plantilla está completa.'; end if;
  end if;

  if p_from_member is null and p_to_member is not null then
    if exists (
      select 1 from public.fantasy_squads s
      join public.fantasy_league_members m on m.id = s.league_member_id
      where m.league_id = p_league_id and s.player_id = p_player_id
    ) then
      raise exception 'Ese jugador ya tiene dueño en la liga.';
    end if;
  end if;

  if p_from_member is not null then
    select count(*) into v_count from public.fantasy_squads where league_member_id = p_from_member;
    if v_count <= 11 then raise exception 'El vendedor no puede quedarse con menos de 11 jugadores.'; end if;
    if not exists (select 1 from public.fantasy_squads where league_member_id = p_from_member and player_id = p_player_id) then
      raise exception 'El vendedor ya no tiene ese jugador.';
    end if;
    delete from public.fantasy_squads where league_member_id = p_from_member and player_id = p_player_id;
    update public.fantasy_league_members set budget = budget + p_amount where id = p_from_member;

    delete from public.fantasy_lineup_players lp
      using public.fantasy_lineups l, public.fantasy_matchdays m
      where lp.lineup_id = l.id and l.matchday_id = m.id
        and m.league_id = p_league_id and m.status <> 'finished'
        and l.league_member_id = p_from_member and lp.player_id = p_player_id;
    update public.fantasy_lineups l set captain_player_id = null
      from public.fantasy_matchdays m
      where l.matchday_id = m.id and m.league_id = p_league_id and m.status <> 'finished'
        and l.league_member_id = p_from_member and l.captain_player_id = p_player_id;

    update public.fantasy_direct_offers set status = 'cancelled', resolved_at = now()
      where league_id = p_league_id and player_id = p_player_id and status = 'pending';
    update public.fantasy_market_listings set status = 'cancelled', resolved_at = now()
      where league_id = p_league_id and player_id = p_player_id and status = 'open'
        and seller_member_id is not null and (p_listing_id is null or id <> p_listing_id);
  end if;

  if p_to_member is not null then
    v_clause := greatest(100000, round(p_amount * p_clause_multiplier / 10000) * 10000);
    insert into public.fantasy_squads (league_member_id, player_id, purchase_price, clause_value)
      values (p_to_member, p_player_id, p_amount, v_clause);
    update public.fantasy_league_members set budget = budget - p_amount where id = p_to_member;
  end if;

  insert into public.fantasy_transfers (league_id, player_id, from_member_id, to_member_id, listing_id, kind, amount)
    values (p_league_id, p_player_id, p_from_member, p_to_member, p_listing_id, p_kind, p_amount);

  if p_listing_id is not null then
    update public.fantasy_market_listings set status = 'accepted', resolved_at = now() where id = p_listing_id;
  end if;

  return jsonb_build_object('ok', true, 'player_name', coalesce(v_player_name, 'Jugador'));
end;
$$;

revoke all on function public.fantasy_execute_transfer(uuid, uuid, uuid, uuid, numeric, public.fantasy_market_kind, uuid, numeric, integer, numeric) from public, anon, authenticated;
grant execute on function public.fantasy_execute_transfer(uuid, uuid, uuid, uuid, numeric, public.fantasy_market_kind, uuid, numeric, integer, numeric) to anon, service_role;
