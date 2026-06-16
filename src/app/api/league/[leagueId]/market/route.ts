import { NextResponse } from "next/server";
import { withMember, type MemberContext } from "@/lib/api-helpers";
import { executeTransfer, leagueSettings, notify, refreshMarket, ServiceError } from "@/lib/service";

async function memberUserId(context: MemberContext, memberId: string): Promise<string | null> {
  const { data } = await context.db.from("fantasy_league_members").select("user_id").eq("id", memberId).maybeSingle();
  return (data?.user_id as string) ?? null;
}

type Payload = {
  action?: string;
  listingId?: string;
  playerId?: string;
  offerId?: string;
  amount?: number;
  accept?: boolean;
};

const money = (value: number) => `${(value / 1e6).toLocaleString("es-ES", { maximumFractionDigits: 1 })} M€`;

export async function POST(request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const body = await request.json().catch(() => null) as Payload | null;
  if (!body?.action) return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  return withMember(leagueId, async (context) => {
    switch (body.action) {
      case "bid": return placeBid(context, body);
      case "cancelBid": return cancelBid(context, body);
      case "buyFixed": return buyFixed(context, body);
      case "sellToMarket": return sellToMarket(context, body);
      case "listFixed": return listFixed(context, body);
      case "unlist": return unlist(context, body);
      case "increaseClause": return increaseClause(context, body);
      case "payClause": return payClause(context, body);
      case "makeOffer": return makeOffer(context, body);
      case "respondOffer": return respondOffer(context, body);
      case "cancelOffer": return cancelOffer(context, body);
      default: throw new ServiceError("Acción de mercado desconocida.");
    }
  });
}

async function getOpenListing(context: MemberContext, listingId: string | undefined) {
  if (!listingId) throw new ServiceError("Falta el identificador de la operación.");
  const { data } = await context.db
    .from("fantasy_market_listings")
    .select("id, player_id, seller_member_id, kind, status, asking_price, closes_at")
    .eq("id", listingId)
    .eq("league_id", context.league.id)
    .maybeSingle();
  if (!data || data.status !== "open") throw new ServiceError("Esta operación ya no está disponible.");
  return data;
}

async function playerName(context: MemberContext, playerId: string) {
  const { data } = await context.db.from("fantasy_players").select("name").eq("id", playerId).maybeSingle();
  return data?.name ?? "Jugador";
}

async function placeBid(context: MemberContext, body: Payload) {
  const settings = leagueSettings(context.league);
  if (!settings.market.bids) throw new ServiceError("Las pujas están desactivadas en esta liga.");
  const listing = await getOpenListing(context, body.listingId);
  if (listing.kind !== "bid") throw new ServiceError("Este jugador no admite pujas.");
  if (listing.closes_at && new Date(listing.closes_at).getTime() < Date.now()) throw new ServiceError("La puja ya ha cerrado.");
  const amount = Math.round(Number(body.amount));
  if (!Number.isFinite(amount) || amount < Number(listing.asking_price)) throw new ServiceError(`La puja mínima es ${money(Number(listing.asking_price))}.`);
  if (amount > Number(context.member.budget)) throw new ServiceError("No tienes saldo suficiente para esa puja.");
  const { error } = await context.db.from("fantasy_bids").upsert({
    listing_id: listing.id,
    bidder_member_id: context.member.id,
    amount,
  }, { onConflict: "listing_id,bidder_member_id" });
  if (error) throw new ServiceError(`No se pudo registrar la puja: ${error.message}`, 500);
  return NextResponse.json({ ok: true });
}

async function cancelBid(context: MemberContext, body: Payload) {
  if (!body.listingId) throw new ServiceError("Falta el identificador de la operación.");
  await context.db.from("fantasy_bids").delete().eq("listing_id", body.listingId).eq("bidder_member_id", context.member.id);
  return NextResponse.json({ ok: true });
}

async function buyFixed(context: MemberContext, body: Payload) {
  const settings = leagueSettings(context.league);
  if (!settings.market.fixedPrice) throw new ServiceError("Las compras a precio fijo están desactivadas.");
  const listing = await getOpenListing(context, body.listingId);
  if (listing.kind !== "fixed" || !listing.seller_member_id) throw new ServiceError("Esta venta no es a precio fijo.");
  if (listing.seller_member_id === context.member.id) throw new ServiceError("No puedes comprar tu propio jugador.");
  const name = await playerName(context, listing.player_id as string);
  await executeTransfer(context.db, {
    league: context.league,
    playerId: listing.player_id as string,
    fromMemberId: listing.seller_member_id,
    toMemberId: context.member.id,
    amount: Number(listing.asking_price),
    kind: "fixed",
    listingId: listing.id,
    actorUserId: context.user.id,
    detail: `${context.member.team_name} compró a ${name} por ${money(Number(listing.asking_price))}`,
  });
  await context.db.from("fantasy_market_listings").update({ status: "accepted", resolved_at: new Date().toISOString() }).eq("id", listing.id);
  return NextResponse.json({ ok: true });
}

async function sellToMarket(context: MemberContext, body: Payload) {
  if (!body.playerId) throw new ServiceError("Falta el jugador.");
  const { data: squadRow } = await context.db.from("fantasy_squads").select("id").eq("league_member_id", context.member.id).eq("player_id", body.playerId).maybeSingle();
  if (!squadRow) throw new ServiceError("Ese jugador no está en tu plantilla.");
  const { count } = await context.db.from("fantasy_squads").select("id", { count: "exact", head: true }).eq("league_member_id", context.member.id);
  if ((count ?? 0) <= 11) throw new ServiceError("No puedes quedarte con menos de 11 jugadores.");
  const { data: playerRow } = await context.db.from("fantasy_players").select("name, current_value").eq("id", body.playerId).maybeSingle();
  if (!playerRow) throw new ServiceError("Jugador no encontrado.");
  await executeTransfer(context.db, {
    league: context.league,
    playerId: body.playerId,
    fromMemberId: context.member.id,
    toMemberId: null,
    amount: Number(playerRow.current_value),
    kind: "fixed",
    actorUserId: context.user.id,
    detail: `${context.member.team_name} vendió a ${playerRow.name} al mercado por ${money(Number(playerRow.current_value))}`,
  });
  return NextResponse.json({ ok: true });
}

async function listFixed(context: MemberContext, body: Payload) {
  const settings = leagueSettings(context.league);
  if (!settings.market.fixedPrice) throw new ServiceError("Las ventas a precio fijo están desactivadas.");
  if (!body.playerId) throw new ServiceError("Falta el jugador.");
  const amount = Math.round(Number(body.amount));
  if (!Number.isFinite(amount) || amount < 100000) throw new ServiceError("Indica un precio de venta válido.");
  const { data: squadRow } = await context.db.from("fantasy_squads").select("id").eq("league_member_id", context.member.id).eq("player_id", body.playerId).maybeSingle();
  if (!squadRow) throw new ServiceError("Ese jugador no está en tu plantilla.");
  const { data: existing } = await context.db.from("fantasy_market_listings").select("id").eq("league_id", context.league.id).eq("player_id", body.playerId).eq("status", "open").maybeSingle();
  if (existing) throw new ServiceError("Ese jugador ya está en el mercado.");
  const { error } = await context.db.from("fantasy_market_listings").insert({
    league_id: context.league.id,
    player_id: body.playerId,
    seller_member_id: context.member.id,
    kind: "fixed",
    status: "open",
    asking_price: amount,
    closes_at: null,
  });
  if (error) throw new ServiceError(`No se pudo publicar la venta: ${error.message}`, 500);
  const name = await playerName(context, body.playerId);
  await context.db.from("fantasy_audit_log").insert({
    league_id: context.league.id,
    actor_user_id: context.user.id,
    action: "listing_created",
    after_data: { detail: `${context.member.team_name} puso a la venta a ${name} por ${money(amount)}` },
  });
  return NextResponse.json({ ok: true });
}

async function unlist(context: MemberContext, body: Payload) {
  const listing = await getOpenListing(context, body.listingId);
  if (listing.seller_member_id !== context.member.id) throw new ServiceError("Solo puedes retirar tus propias ventas.");
  await context.db.from("fantasy_market_listings").update({ status: "cancelled", resolved_at: new Date().toISOString() }).eq("id", listing.id);
  return NextResponse.json({ ok: true });
}

async function increaseClause(context: MemberContext, body: Payload) {
  const settings = leagueSettings(context.league);
  if (!settings.market.clauses) throw new ServiceError("Las cláusulas están desactivadas en esta liga.");
  if (!body.playerId) throw new ServiceError("Falta el jugador.");
  const amount = Math.round(Number(body.amount));
  if (!Number.isFinite(amount) || amount < 100000) throw new ServiceError("Indica una cantidad válida en millones.");
  const budget = Number(context.member.budget);
  if (amount > budget) throw new ServiceError("No tienes saldo suficiente para esa inversión.");
  const { data: squadRow } = await context.db
    .from("fantasy_squads")
    .select("id, clause_value, player_id")
    .eq("league_member_id", context.member.id)
    .eq("player_id", body.playerId)
    .maybeSingle();
  if (!squadRow) throw new ServiceError("Ese jugador no está en tu plantilla.");
  let base = squadRow.clause_value === null ? null : Number(squadRow.clause_value);
  if (base === null) {
    const { data: playerRow } = await context.db.from("fantasy_players").select("current_value").eq("id", body.playerId).maybeSingle();
    base = Number(playerRow?.current_value ?? 0);
  }
  const newClause = base + amount; // inversión 1:1
  const { error: clauseError } = await context.db.from("fantasy_squads").update({ clause_value: newClause }).eq("id", squadRow.id);
  if (clauseError) throw new ServiceError(`No se pudo actualizar la cláusula: ${clauseError.message}`, 500);
  const { error: budgetError } = await context.db.from("fantasy_league_members").update({ budget: budget - amount }).eq("id", context.member.id);
  if (budgetError) {
    await context.db.from("fantasy_squads").update({ clause_value: base }).eq("id", squadRow.id); // revertir
    throw new ServiceError(`No se pudo descontar el saldo: ${budgetError.message}`, 500);
  }
  const name = await playerName(context, body.playerId);
  await context.db.from("fantasy_audit_log").insert({
    league_id: context.league.id,
    actor_user_id: context.user.id,
    action: "clause_increased",
    after_data: { detail: `${context.member.team_name} invirtió ${money(amount)} para subir la cláusula de ${name} a ${money(newClause)}` },
  });
  return NextResponse.json({ ok: true });
}

async function payClause(context: MemberContext, body: Payload) {
  const settings = leagueSettings(context.league);
  if (!settings.market.clauses) throw new ServiceError("Las cláusulas están desactivadas en esta liga.");
  if (!body.playerId) throw new ServiceError("Falta el jugador.");
  const { data: members } = await context.db.from("fantasy_league_members").select("id, team_name").eq("league_id", context.league.id);
  const memberIds = (members ?? []).map((m) => m.id);
  const { data: squadRow } = await context.db
    .from("fantasy_squads")
    .select("id, league_member_id, clause_value")
    .eq("player_id", body.playerId)
    .in("league_member_id", memberIds)
    .maybeSingle();
  if (!squadRow) throw new ServiceError("Ese jugador no pertenece a ningún rival.");
  if (squadRow.league_member_id === context.member.id) throw new ServiceError("Ya es tuyo.");
  if (squadRow.clause_value === null) throw new ServiceError("Ese jugador no tiene cláusula.");
  const amount = Number(squadRow.clause_value);
  const seller = (members ?? []).find((m) => m.id === squadRow.league_member_id);
  const name = await playerName(context, body.playerId);
  await executeTransfer(context.db, {
    league: context.league,
    playerId: body.playerId,
    fromMemberId: squadRow.league_member_id as string,
    toMemberId: context.member.id,
    amount,
    kind: "clause",
    actorUserId: context.user.id,
    detail: `${context.member.team_name} pagó la cláusula de ${name} (${money(amount)}) a ${seller?.team_name ?? "un rival"}`,
  });
  await notify(context.db, await memberUserId(context, squadRow.league_member_id as string), context.league.id, "clause_paid", "Te han pagado una cláusula", `${context.member.team_name} fichó a ${name} por su cláusula (${money(amount)}).`);
  return NextResponse.json({ ok: true });
}

async function makeOffer(context: MemberContext, body: Payload) {
  const settings = leagueSettings(context.league);
  if (!settings.market.directTransfers) throw new ServiceError("Los traspasos directos están desactivados.");
  if (!body.playerId) throw new ServiceError("Falta el jugador.");
  const amount = Math.round(Number(body.amount));
  if (!Number.isFinite(amount) || amount < 100000) throw new ServiceError("Indica una cantidad válida.");
  if (amount > Number(context.member.budget)) throw new ServiceError("No tienes saldo suficiente para esa oferta.");
  const { data: members } = await context.db.from("fantasy_league_members").select("id").eq("league_id", context.league.id);
  const { data: squadRow } = await context.db
    .from("fantasy_squads")
    .select("league_member_id")
    .eq("player_id", body.playerId)
    .in("league_member_id", (members ?? []).map((m) => m.id))
    .maybeSingle();
  if (!squadRow || squadRow.league_member_id === context.member.id) throw new ServiceError("Ese jugador no pertenece a un rival.");
  const { data: existing } = await context.db
    .from("fantasy_direct_offers")
    .select("id")
    .eq("league_id", context.league.id)
    .eq("player_id", body.playerId)
    .eq("from_member_id", context.member.id)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) throw new ServiceError("Ya tienes una oferta pendiente por ese jugador.");
  const { error } = await context.db.from("fantasy_direct_offers").insert({
    league_id: context.league.id,
    player_id: body.playerId,
    from_member_id: context.member.id,
    to_member_id: squadRow.league_member_id,
    amount,
  });
  if (error) throw new ServiceError(`No se pudo enviar la oferta: ${error.message}`, 500);
  const offeredName = await playerName(context, body.playerId);
  await notify(context.db, await memberUserId(context, squadRow.league_member_id as string), context.league.id, "offer_received", "Nueva oferta recibida", `${context.member.team_name} ofrece ${money(amount)} por ${offeredName}.`);
  return NextResponse.json({ ok: true });
}

async function respondOffer(context: MemberContext, body: Payload) {
  if (!body.offerId) throw new ServiceError("Falta la oferta.");
  const { data: offer } = await context.db
    .from("fantasy_direct_offers")
    .select("id, player_id, from_member_id, to_member_id, amount, status")
    .eq("id", body.offerId)
    .eq("league_id", context.league.id)
    .maybeSingle();
  if (!offer || offer.status !== "pending") throw new ServiceError("Esa oferta ya no está disponible.");
  if (offer.to_member_id !== context.member.id) throw new ServiceError("Esa oferta no es para ti.");
  const offerPlayerName = await playerName(context, offer.player_id as string);
  if (!body.accept) {
    await context.db.from("fantasy_direct_offers").update({ status: "rejected", resolved_at: new Date().toISOString() }).eq("id", offer.id);
    await notify(context.db, await memberUserId(context, offer.from_member_id as string), context.league.id, "offer_rejected", "Oferta rechazada", `${context.member.team_name} rechazó tu oferta por ${offerPlayerName}.`);
    return NextResponse.json({ ok: true });
  }
  const name = offerPlayerName;
  const { data: buyer } = await context.db.from("fantasy_league_members").select("team_name").eq("id", offer.from_member_id).maybeSingle();
  await executeTransfer(context.db, {
    league: context.league,
    playerId: offer.player_id as string,
    fromMemberId: context.member.id,
    toMemberId: offer.from_member_id as string,
    amount: Number(offer.amount),
    kind: "direct",
    actorUserId: context.user.id,
    detail: `${context.member.team_name} traspasó a ${name} a ${buyer?.team_name ?? "un rival"} por ${money(Number(offer.amount))}`,
  });
  await context.db.from("fantasy_direct_offers").update({ status: "accepted", resolved_at: new Date().toISOString() }).eq("id", offer.id);
  await notify(context.db, await memberUserId(context, offer.from_member_id as string), context.league.id, "offer_accepted", "Oferta aceptada", `${context.member.team_name} aceptó tu oferta: ${name} es tuyo por ${money(Number(offer.amount))}.`);
  return NextResponse.json({ ok: true });
}

async function cancelOffer(context: MemberContext, body: Payload) {
  if (!body.offerId) throw new ServiceError("Falta la oferta.");
  await context.db
    .from("fantasy_direct_offers")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("id", body.offerId)
    .eq("from_member_id", context.member.id)
    .eq("status", "pending");
  return NextResponse.json({ ok: true });
}

export async function GET(_request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  return withMember(leagueId, async ({ db, league }) => {
    await refreshMarket(db, league);
    return NextResponse.json({ ok: true });
  });
}
