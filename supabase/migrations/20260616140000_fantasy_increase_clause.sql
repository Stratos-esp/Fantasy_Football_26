-- Inversión atómica en la cláusula de un jugador: descuenta el saldo y sube la
-- cláusula en una sola transacción con bloqueo de fila, evitando descuadres por
-- operaciones simultáneas.
create or replace function public.fantasy_increase_clause(
  p_league_id uuid,
  p_player_id uuid,
  p_member uuid,
  p_amount numeric
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
begin
  if not (select private.fantasy_server_authorized()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Indica una cantidad válida.';
  end if;

  perform 1 from public.fantasy_league_members where id = p_member for update;
  select budget into v_budget from public.fantasy_league_members where id = p_member;
  if v_budget is null then raise exception 'Mánager no encontrado.'; end if;
  if v_budget < p_amount then raise exception 'No tienes saldo suficiente para esa inversión.'; end if;

  select clause_value, true into v_clause, v_found
    from public.fantasy_squads
    where league_member_id = p_member and player_id = p_player_id;
  if v_found is distinct from true then
    raise exception 'Ese jugador no está en tu plantilla.';
  end if;
  if v_clause is null then
    select current_value into v_base from public.fantasy_players where id = p_player_id;
    v_clause := coalesce(v_base, 0);
  end if;

  update public.fantasy_squads
    set clause_value = v_clause + p_amount
    where league_member_id = p_member and player_id = p_player_id;
  update public.fantasy_league_members
    set budget = budget - p_amount
    where id = p_member;

  return jsonb_build_object('ok', true, 'clause', v_clause + p_amount);
end;
$$;

revoke all on function public.fantasy_increase_clause(uuid, uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.fantasy_increase_clause(uuid, uuid, uuid, numeric) to anon, service_role;
