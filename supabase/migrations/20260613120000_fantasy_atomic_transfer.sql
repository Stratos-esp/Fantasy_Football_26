-- Transferencia atómica con bloqueo de filas: evita doble compra, saldos
-- inconsistentes y doble resolución de subastas. Toda la operación crítica de
-- dinero y propiedad ocurre en una sola transacción con SELECT ... FOR UPDATE.
create or replace function public.fantasy_execute_transfer(
  p_league_id uuid,
  p_player_id uuid,
  p_from_member uuid,
  p_to_member uuid,
  p_amount numeric,
  p_kind public.fantasy_market_kind,
  p_listing_id uuid,
  p_clause_multiplier numeric,
  p_squad_size integer
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_player_name text;
  v_buyer_budget numeric;
  v_seller_budget numeric;
  v_count integer;
  v_clause numeric;
begin
  if not (select private.fantasy_server_authorized()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  -- Bloquea la subasta primero para garantizar una única resolución.
  if p_listing_id is not null then
    perform 1 from public.fantasy_market_listings where id = p_listing_id and status = 'open' for update;
    if not found then
      raise exception 'Esta operación ya no está disponible.';
    end if;
  end if;

  select name into v_player_name from public.fantasy_players where id = p_player_id;

  -- Bloquea a los implicados (orden determinista por id evita interbloqueos).
  perform 1 from public.fantasy_league_members
    where id in (p_from_member, p_to_member) order by id for update;

  -- Validaciones del comprador.
  if p_to_member is not null then
    select budget into v_buyer_budget from public.fantasy_league_members where id = p_to_member;
    if v_buyer_budget < p_amount then raise exception 'Saldo insuficiente para completar la operación.'; end if;
    if exists (select 1 from public.fantasy_squads where league_member_id = p_to_member and player_id = p_player_id) then
      raise exception 'Ese jugador ya está en tu plantilla.';
    end if;
    select count(*) into v_count from public.fantasy_squads where league_member_id = p_to_member;
    if v_count >= p_squad_size + 5 then raise exception 'Tu plantilla está completa.'; end if;
  end if;

  -- Si se adquiere desde el mercado (sin vendedor), nadie debe poseerlo ya.
  if p_from_member is null and p_to_member is not null then
    if exists (
      select 1 from public.fantasy_squads s
      join public.fantasy_league_members m on m.id = s.league_member_id
      where m.league_id = p_league_id and s.player_id = p_player_id
    ) then
      raise exception 'Ese jugador ya tiene dueño en la liga.';
    end if;
  end if;

  -- Validaciones y salida del vendedor.
  if p_from_member is not null then
    select count(*) into v_count from public.fantasy_squads where league_member_id = p_from_member;
    if v_count <= 11 then raise exception 'El vendedor no puede quedarse con menos de 11 jugadores.'; end if;
    if not exists (select 1 from public.fantasy_squads where league_member_id = p_from_member and player_id = p_player_id) then
      raise exception 'El vendedor ya no tiene ese jugador.';
    end if;
    delete from public.fantasy_squads where league_member_id = p_from_member and player_id = p_player_id;
    update public.fantasy_league_members set budget = budget + p_amount where id = p_from_member;

    -- Saca al jugador de las alineaciones del vendedor en jornadas no jugadas.
    delete from public.fantasy_lineup_players lp
      using public.fantasy_lineups l, public.fantasy_matchdays m
      where lp.lineup_id = l.id and l.matchday_id = m.id
        and m.league_id = p_league_id and m.status <> 'finished'
        and l.league_member_id = p_from_member and lp.player_id = p_player_id;
    update public.fantasy_lineups l set captain_player_id = null
      from public.fantasy_matchdays m
      where l.matchday_id = m.id and m.league_id = p_league_id and m.status <> 'finished'
        and l.league_member_id = p_from_member and l.captain_player_id = p_player_id;

    -- Cancela ofertas y ventas pendientes que dependían de esa propiedad.
    update public.fantasy_direct_offers set status = 'cancelled', resolved_at = now()
      where league_id = p_league_id and player_id = p_player_id and status = 'pending';
    update public.fantasy_market_listings set status = 'cancelled', resolved_at = now()
      where league_id = p_league_id and player_id = p_player_id and status = 'open'
        and seller_member_id is not null and (p_listing_id is null or id <> p_listing_id);
  end if;

  -- Entrada del comprador.
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

revoke all on function public.fantasy_execute_transfer(uuid, uuid, uuid, uuid, numeric, public.fantasy_market_kind, uuid, numeric, integer) from public, anon, authenticated;
grant execute on function public.fantasy_execute_transfer(uuid, uuid, uuid, uuid, numeric, public.fantasy_market_kind, uuid, numeric, integer) to anon, service_role;
