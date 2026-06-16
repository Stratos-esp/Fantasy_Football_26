import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateFantasyPoints, defaultScoringRules, type PlayerMatchStats, type ScoringRules } from "@/lib/scoring";
import { laligaTeams, seedPlayerExternalId } from "@/lib/laliga-data";
import { proposalOutcome } from "@/lib/voting";
import {
  defaultLeagueSettings, formations, parseLeagueSettings,
  type ActivityItem, type ApiPlayer, type LeagueSettings, type LeagueState, type LineupState,
  type MarketListing, type MatchdayDetail, type Position,
} from "@/lib/types";

export class ServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type Db = SupabaseClient;

export type LeagueRow = {
  id: string;
  owner_id: string;
  name: string;
  invite_code: string;
  season: number;
  starting_budget: number;
  squad_size: number;
  settings: unknown;
  scoring_rules: unknown;
  current_matchday: number;
};

export type MemberRow = {
  id: string;
  league_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  team_name: string;
  budget: number;
  total_points: number;
  color: string | null;
};

type PlayerRow = {
  id: string;
  name: string;
  position: Position;
  current_value: number;
  team_id: string | null;
  photo_url: string | null;
  metadata: Record<string, unknown> | null;
  team?: { external_id: number; name: string; short_name: string | null; badge_url: string | null; colors: unknown } | null;
};

const MEMBER_COLORS = ["#65d5ff", "#ff708f", "#ffd166", "#b8f35a", "#c89bff", "#ff9c72", "#7dd3a8", "#f97583"];
const TOTAL_MATCHDAYS = 38;
const SQUAD_SHAPE: Record<Position, number> = { POR: 2, DEF: 5, MED: 5, DEL: 3 };
const MARKET_HOURS = 24;

function fail(message: string, status = 400): never { throw new ServiceError(message, status); }

function shuffle<T>(items: T[]): T[] {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function poisson(lambda: number) {
  if (lambda <= 0) return 0;
  const limit = Math.exp(-lambda);
  let product = Math.random();
  let count = 0;
  while (product > limit) {
    count += 1;
    product *= Math.random();
  }
  return count;
}

const roundMoney = (value: number) => Math.max(100000, Math.round(value / 10000) * 10000);

function unwrap<T>(result: { data: T | null; error: { message: string } | null }, context: string): T {
  if (result.error) throw new ServiceError(`${context}: ${result.error.message}`, 500);
  if (result.data === null) throw new ServiceError(`${context}: sin datos`, 500);
  return result.data;
}

export async function audit(db: Db, leagueId: string | null, actorUserId: string | null, action: string, detail: string) {
  await db.from("fantasy_audit_log").insert({
    league_id: leagueId,
    actor_user_id: actorUserId,
    action,
    after_data: { detail },
  });
}

export async function notify(db: Db, userId: string | null, leagueId: string | null, kind: string, title: string, body?: string) {
  if (!userId) return;
  await db.from("fantasy_notifications").insert({ user_id: userId, league_id: leagueId, kind, title, body: body ?? null });
}

export function leagueSettings(league: LeagueRow): LeagueSettings {
  return parseLeagueSettings(league.settings);
}

function scoringRules(league: LeagueRow): ScoringRules {
  return { ...defaultScoringRules, ...(league.scoring_rules && typeof league.scoring_rules === "object" ? league.scoring_rules : {}) };
}

export async function getLeagueAndMember(db: Db, leagueId: string, userId: string) {
  const league = unwrap(
    await db.from("fantasy_leagues").select("id, owner_id, name, invite_code, season, starting_budget, squad_size, settings, scoring_rules, current_matchday").eq("id", leagueId).maybeSingle(),
    "Liga no encontrada",
  ) as LeagueRow;
  const member = unwrap(
    await db.from("fantasy_league_members").select("id, league_id, user_id, role, team_name, budget, total_points, color").eq("league_id", leagueId).eq("user_id", userId).maybeSingle(),
    "No eres miembro de esta liga",
  ) as MemberRow;
  return { league, member };
}

export const isAdmin = (member: MemberRow) => member.role === "owner" || member.role === "admin";

// ---------------------------------------------------------------------------
// Seed de jugadores
// ---------------------------------------------------------------------------

export async function seedLaLiga(db: Db, season: number) {
  let teamCount = 0;
  let playerCount = 0;
  for (const team of laligaTeams) {
    const teamRow = unwrap(
      await db.from("fantasy_teams").upsert({
        external_id: team.externalId,
        competition_external_id: 140,
        season,
        name: team.name,
        short_name: team.shortName,
        badge_url: `https://media.api-sports.io/football/teams/${team.externalId}.png`,
        colors: [team.color],
      }, { onConflict: "external_id,season" }).select("id").single(),
      `No se pudo guardar el equipo ${team.name}`,
    ) as { id: string };
    teamCount += 1;

    const rows = team.players.map((player, index) => ({
      external_id: seedPlayerExternalId(team.externalId, index + 1),
      team_id: teamRow.id,
      season,
      name: player.name,
      position: player.position,
      status: "available",
      current_value: Math.round(player.value * 1_000_000),
      metadata: { baseValue: Math.round(player.value * 1_000_000), source: "seed" },
    }));
    const { error } = await db.from("fantasy_players").upsert(rows, { onConflict: "external_id,season" });
    if (error) throw new ServiceError(`No se pudieron guardar jugadores de ${team.name}: ${error.message}`, 500);
    playerCount += rows.length;
  }
  return { teams: teamCount, players: playerCount };
}

// ---------------------------------------------------------------------------
// Sincronización de datos reales (LaLiga Fantasy)
// ---------------------------------------------------------------------------

const TEAM_COLORS = ["#e30613", "#004d98", "#cb3524", "#ee2523", "#0b67b2", "#ffe667", "#0bb363", "#d8332e", "#f4a014", "#cd2534", "#d91a21", "#8ac3ee", "#e53241", "#e20613", "#0761af", "#2475c5", "#1352a1", "#1d3a8f", "#0a8943", "#2456a5"];

function realValue(seasonPoints: number, games: number) {
  // Valor según media por partido (rango realista) con una pizca por regularidad.
  const avg = games > 0 ? seasonPoints / games : 0;
  return roundMoney(Math.min(45_000_000, Math.max(500_000, 600_000 + avg * 4_200_000 + games * 45_000)));
}

export type RealPlayerInput = {
  externalId: number;
  name: string;
  position: Position;
  teamExternalId: number;
  teamName: string;
  teamBadge: string | null;
  photo: string | null;
  weekPoints: [number, number][];
};

export async function seedLaLigaReal(db: Db, season: number, players: RealPlayerInput[]) {
  // 1) Equipos.
  const teams = new Map<number, { name: string; badge: string | null }>();
  for (const player of players) {
    if (!teams.has(player.teamExternalId)) teams.set(player.teamExternalId, { name: player.teamName, badge: player.teamBadge });
  }
  const teamIdByExternal = new Map<number, string>();
  let colorIndex = 0;
  for (const [externalId, team] of teams) {
    const row = unwrap(
      await db.from("fantasy_teams").upsert({
        external_id: externalId,
        competition_external_id: 140,
        season,
        name: team.name,
        short_name: team.name.slice(0, 3).toUpperCase(),
        badge_url: team.badge,
        colors: [TEAM_COLORS[colorIndex % TEAM_COLORS.length]],
      }, { onConflict: "external_id,season" }).select("id").single(),
      `No se pudo guardar el equipo ${team.name}`,
    ) as { id: string };
    teamIdByExternal.set(externalId, row.id);
    colorIndex += 1;
  }

  // 2) Jugadores con valor derivado de su rendimiento real.
  const playerRows = players.map((player) => {
    const seasonPoints = player.weekPoints.reduce((sum, [, pts]) => sum + pts, 0);
    const value = realValue(seasonPoints, player.weekPoints.length);
    return {
      external_id: player.externalId,
      team_id: teamIdByExternal.get(player.teamExternalId) ?? null,
      season,
      name: player.name,
      position: player.position,
      photo_url: player.photo,
      status: "available",
      current_value: value,
      metadata: { source: "laliga-fantasy", baseValue: value, seasonPoints },
    };
  });
  for (let i = 0; i < playerRows.length; i += 200) {
    const { error } = await db.from("fantasy_players").upsert(playerRows.slice(i, i + 200), { onConflict: "external_id,season" });
    if (error) throw new ServiceError(`No se pudieron guardar jugadores: ${error.message}`, 500);
  }

  // 3) Mapa external_id → uuid para los puntos por jornada.
  const idByExternal = new Map<number, string>();
  const externalIds = players.map((p) => p.externalId);
  for (let i = 0; i < externalIds.length; i += 300) {
    const { data } = await db.from("fantasy_players").select("id, external_id").eq("season", season).in("external_id", externalIds.slice(i, i + 300));
    for (const row of data ?? []) idByExternal.set(row.external_id as number, row.id as string);
  }

  // 4) Puntos reales por jornada.
  const weekRows: { player_id: string; week: number; points: number; played: boolean }[] = [];
  for (const player of players) {
    const playerId = idByExternal.get(player.externalId);
    if (!playerId) continue;
    for (const [week, points] of player.weekPoints) {
      weekRows.push({ player_id: playerId, week, points, played: true });
    }
  }
  for (let i = 0; i < weekRows.length; i += 500) {
    const { error } = await db.from("fantasy_player_week_points").upsert(weekRows.slice(i, i + 500), { onConflict: "player_id,week" });
    if (error) throw new ServiceError(`No se pudieron guardar los puntos por jornada: ${error.message}`, 500);
  }

  return { teams: teams.size, players: playerRows.length, weekPoints: weekRows.length };
}

// ---------------------------------------------------------------------------
// Plantillas aleatorias y alineaciones
// ---------------------------------------------------------------------------

async function fetchPlayers(db: Db, season: number): Promise<PlayerRow[]> {
  const { data, error } = await db
    .from("fantasy_players")
    .select("id, name, position, current_value, team_id, photo_url, metadata, team:fantasy_teams(external_id, name, short_name, badge_url, colors)")
    .eq("season", season)
    .gt("current_value", 0)
    .limit(2000);
  if (error) throw new ServiceError(`No se pudieron cargar los jugadores: ${error.message}`, 500);
  return (data ?? []) as unknown as PlayerRow[];
}

async function ownedPlayerIds(db: Db, leagueId: string): Promise<Set<string>> {
  const { data: members } = await db.from("fantasy_league_members").select("id").eq("league_id", leagueId);
  const memberIds = (members ?? []).map((m) => m.id);
  if (memberIds.length === 0) return new Set();
  const { data } = await db.from("fantasy_squads").select("player_id").in("league_member_id", memberIds).limit(5000);
  return new Set((data ?? []).map((row) => row.player_id as string));
}

function pickBalancedSquad(pool: PlayerRow[], startingBudget: number) {
  const byPosition: Record<Position, PlayerRow[]> = { POR: [], DEF: [], MED: [], DEL: [] };
  for (const player of pool) byPosition[player.position]?.push(player);
  for (const position of Object.keys(SQUAD_SHAPE) as Position[]) {
    if (byPosition[position].length < SQUAD_SHAPE[position]) {
      fail("No quedan suficientes jugadores libres para crear otra plantilla en esta liga.");
    }
  }

  const picked: PlayerRow[] = [];
  const remaining: Record<Position, PlayerRow[]> = { POR: [], DEF: [], MED: [], DEL: [] };
  for (const position of Object.keys(SQUAD_SHAPE) as Position[]) {
    const list = shuffle(byPosition[position]);
    picked.push(...list.slice(0, SQUAD_SHAPE[position]));
    remaining[position] = list.slice(SQUAD_SHAPE[position]);
  }

  const total = () => picked.reduce((sum, p) => sum + Number(p.current_value), 0);
  const minTarget = startingBudget * 0.7;
  const maxTarget = startingBudget * 0.85;
  for (let i = 0; i < 300 && (total() < minTarget || total() > maxTarget); i += 1) {
    const tooHigh = total() > maxTarget;
    const candidates = picked
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => remaining[player.position].length > 0);
    if (candidates.length === 0) break;
    const { player, index } = candidates[Math.floor(Math.random() * candidates.length)];
    const swaps = remaining[player.position].filter((alt) =>
      tooHigh ? Number(alt.current_value) < Number(player.current_value) : Number(alt.current_value) > Number(player.current_value),
    );
    if (swaps.length === 0) continue;
    const replacement = swaps[Math.floor(Math.random() * swaps.length)];
    remaining[player.position] = remaining[player.position].filter((p) => p.id !== replacement.id).concat(player);
    picked[index] = replacement;
  }
  return picked;
}

function defaultLineupSelection(squad: PlayerRow[]) {
  const sorted = [...squad].sort((a, b) => Number(b.current_value) - Number(a.current_value));
  const byPosition = (position: Position) => sorted.filter((p) => p.position === position);
  const shape = formations["4-4-2"];
  const starters = [
    ...byPosition("POR").slice(0, 1),
    ...byPosition("DEF").slice(0, shape.DEF),
    ...byPosition("MED").slice(0, shape.MED),
    ...byPosition("DEL").slice(0, shape.DEL),
  ];
  const starterIds = new Set(starters.map((p) => p.id));
  const bench = sorted.filter((p) => !starterIds.has(p.id));
  return { starters, bench };
}

async function activeMatchday(db: Db, league: LeagueRow) {
  const { data } = await db
    .from("fantasy_matchdays")
    .select("id, number, status")
    .eq("league_id", league.id)
    .eq("number", league.current_matchday)
    .maybeSingle();
  return data as { id: string; number: number; status: string } | null;
}

async function createDefaultLineup(db: Db, league: LeagueRow, memberId: string, squad: PlayerRow[], matchdayId: string) {
  const { starters, bench } = defaultLineupSelection(squad);
  const settings = leagueSettings(league);
  const captain = settings.captain ? starters.slice(1).sort((a, b) => Number(b.current_value) - Number(a.current_value))[0] ?? starters[0] : null;
  const lineup = unwrap(
    await db.from("fantasy_lineups").upsert({
      matchday_id: matchdayId,
      league_member_id: memberId,
      formation: "4-4-2",
      captain_player_id: captain?.id ?? null,
      submitted_at: new Date().toISOString(),
    }, { onConflict: "matchday_id,league_member_id" }).select("id").single(),
    "No se pudo crear la alineación",
  ) as { id: string };
  await db.from("fantasy_lineup_players").delete().eq("lineup_id", lineup.id);
  const rows = [
    ...starters.map((player, index) => ({ lineup_id: lineup.id, player_id: player.id, slot: index + 1, is_starter: true, bench_order: null as number | null })),
    ...bench.slice(0, settings.benchSlots).map((player, index) => ({ lineup_id: lineup.id, player_id: player.id, slot: 12 + index, is_starter: false, bench_order: index + 1 })),
  ];
  const { error } = await db.from("fantasy_lineup_players").insert(rows);
  if (error) throw new ServiceError(`No se pudo guardar la alineación: ${error.message}`, 500);
}

export async function assignRandomSquad(db: Db, league: LeagueRow, memberId: string) {
  const settings = leagueSettings(league);
  const players = await fetchPlayers(db, league.season);
  if (players.length === 0) fail("Todavía no hay jugadores cargados en la base de datos.", 503);
  const owned = await ownedPlayerIds(db, league.id);
  const pool = players.filter((player) => !owned.has(player.id));
  const squad = pickBalancedSquad(pool, Number(league.starting_budget));

  const squadRows = squad.map((player) => ({
    league_member_id: memberId,
    player_id: player.id,
    purchase_price: Number(player.current_value),
    clause_value: roundMoney(Number(player.current_value) * settings.clauseMultiplier),
  }));
  const { error } = await db.from("fantasy_squads").insert(squadRows);
  if (error) throw new ServiceError(`No se pudo asignar la plantilla: ${error.message}`, 500);

  const spent = squad.reduce((sum, p) => sum + Number(p.current_value), 0);
  const budget = Math.max(0, Number(league.starting_budget) - spent);
  await db.from("fantasy_league_members").update({ budget }).eq("id", memberId);

  const matchday = await activeMatchday(db, league);
  if (matchday) await createDefaultLineup(db, league, memberId, squad, matchday.id);
  return { spent, budget };
}

// ---------------------------------------------------------------------------
// Ligas
// ---------------------------------------------------------------------------

function inviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

async function createMatchdays(db: Db, leagueId: string) {
  const rows = Array.from({ length: TOTAL_MATCHDAYS }, (_, index) => ({
    league_id: leagueId,
    number: index + 1,
    status: index === 0 ? "active" : "scheduled",
  }));
  const { error } = await db.from("fantasy_matchdays").insert(rows);
  if (error) throw new ServiceError(`No se pudieron crear las jornadas: ${error.message}`, 500);
}

async function memberColor(db: Db, leagueId: string) {
  const { count } = await db.from("fantasy_league_members").select("id", { count: "exact", head: true }).eq("league_id", leagueId);
  return MEMBER_COLORS[(count ?? 0) % MEMBER_COLORS.length];
}

export async function createLeague(db: Db, userId: string, name: string, teamName: string) {
  if (!name.trim() || name.trim().length < 3) fail("El nombre de la liga debe tener al menos 3 caracteres.");
  if (!teamName.trim() || teamName.trim().length < 3) fail("El nombre de tu equipo debe tener al menos 3 caracteres.");
  const season = 2025;
  const { count } = await db.from("fantasy_players").select("id", { count: "exact", head: true }).eq("season", season);
  if (!count) fail("Aún no hay jugadores en la base de datos. Ejecuta primero la carga de LaLiga.", 503);

  const slugBase = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "liga";
  const league = unwrap(
    await db.from("fantasy_leagues").insert({
      owner_id: userId,
      name: name.trim(),
      slug: `${slugBase}-${Math.random().toString(36).slice(2, 7)}`,
      invite_code: inviteCode(),
      season,
      settings: defaultLeagueSettings,
    }).select("id, owner_id, name, invite_code, season, starting_budget, squad_size, settings, scoring_rules, current_matchday").single(),
    "No se pudo crear la liga",
  ) as LeagueRow;

  const member = unwrap(
    await db.from("fantasy_league_members").insert({
      league_id: league.id,
      user_id: userId,
      role: "owner",
      team_name: teamName.trim(),
      budget: Number(league.starting_budget),
      color: MEMBER_COLORS[0],
    }).select("id").single(),
    "No se pudo crear tu equipo",
  ) as { id: string };

  await createMatchdays(db, league.id);
  await assignRandomSquad(db, league, member.id);
  await refreshMarket(db, league);
  await audit(db, league.id, userId, "league_created", `Se creó la liga ${league.name}`);
  return league;
}

export async function joinLeague(db: Db, userId: string, code: string, teamName: string) {
  if (!teamName.trim() || teamName.trim().length < 3) fail("El nombre de tu equipo debe tener al menos 3 caracteres.");
  const league = unwrap(
    await db.from("fantasy_leagues").select("id, owner_id, name, invite_code, season, starting_budget, squad_size, settings, scoring_rules, current_matchday").eq("invite_code", code.trim().toUpperCase()).maybeSingle(),
    "Código de invitación no válido",
  ) as LeagueRow;
  const { data: existing } = await db.from("fantasy_league_members").select("id").eq("league_id", league.id).eq("user_id", userId).maybeSingle();
  if (existing) fail("Ya eres miembro de esta liga.");

  const member = unwrap(
    await db.from("fantasy_league_members").insert({
      league_id: league.id,
      user_id: userId,
      role: "member",
      team_name: teamName.trim(),
      budget: Number(league.starting_budget),
      color: await memberColor(db, league.id),
    }).select("id").single(),
    "No se pudo unir a la liga (¿nombre de equipo repetido?)",
  ) as { id: string };

  await assignRandomSquad(db, league, member.id);
  await audit(db, league.id, userId, "member_joined", `Un nuevo mánager se unió a la liga`);
  return league;
}

// ---------------------------------------------------------------------------
// Mercado
// ---------------------------------------------------------------------------

export async function refreshMarket(db: Db, league: LeagueRow) {
  await resolveDueListings(db, league);
  const settings = leagueSettings(league);
  const { data: open } = await db
    .from("fantasy_market_listings")
    .select("id, player_id")
    .eq("league_id", league.id)
    .eq("status", "open");
  const openListings = open ?? [];
  const leagueMarketCount = openListings.length;
  const missing = settings.marketSize - leagueMarketCount;
  if (missing <= 0) return;

  const players = await fetchPlayers(db, league.season);
  const owned = await ownedPlayerIds(db, league.id);
  const listed = new Set(openListings.map((row) => row.player_id as string));
  const pool = shuffle(players.filter((player) => !owned.has(player.id) && !listed.has(player.id)));
  const closesAt = new Date(Date.now() + MARKET_HOURS * 3600 * 1000).toISOString();
  const rows = pool.slice(0, missing).map((player) => ({
    league_id: league.id,
    player_id: player.id,
    seller_member_id: null,
    kind: "bid" as const,
    status: "open" as const,
    asking_price: Number(player.current_value),
    closes_at: closesAt,
  }));
  if (rows.length > 0) await db.from("fantasy_market_listings").insert(rows);
}

type TransferArgs = {
  league: LeagueRow;
  playerId: string;
  fromMemberId: string | null;
  toMemberId: string | null;
  amount: number;
  kind: "bid" | "fixed" | "clause" | "direct";
  listingId?: string | null;
  actorUserId: string | null;
  detail: string;
};

async function memberById(db: Db, memberId: string): Promise<MemberRow> {
  return unwrap(
    await db.from("fantasy_league_members").select("id, league_id, user_id, role, team_name, budget, total_points, color").eq("id", memberId).maybeSingle(),
    "Mánager no encontrado",
  ) as MemberRow;
}

async function addToCurrentBench(db: Db, league: LeagueRow, memberId: string, playerId: string) {
  const matchday = await activeMatchday(db, league);
  if (!matchday) return;
  const { data: lineup } = await db.from("fantasy_lineups").select("id").eq("matchday_id", matchday.id).eq("league_member_id", memberId).maybeSingle();
  if (!lineup) return;
  const settings = leagueSettings(league);
  const { data: players } = await db.from("fantasy_lineup_players").select("slot, is_starter").eq("lineup_id", lineup.id);
  const bench = (players ?? []).filter((p) => !p.is_starter);
  if (bench.length >= settings.benchSlots) return;
  const maxSlot = Math.max(11, ...(players ?? []).map((p) => p.slot as number));
  await db.from("fantasy_lineup_players").insert({
    lineup_id: lineup.id,
    player_id: playerId,
    slot: maxSlot + 1,
    is_starter: false,
    bench_order: bench.length + 1,
  });
}

// Decide (sin modificar nada) qué suplente debería ocupar el hueco que dejará un
// titular al salir del equipo, para aplicarlo tras la transferencia. Si el
// jugador no era titular o no hay recambio de su posición, devuelve null.
async function planVacancyPromotion(db: Db, league: LeagueRow, memberId: string, leavingPlayerId: string) {
  const matchday = await activeMatchday(db, league);
  if (!matchday) return null;
  const { data: lineup } = await db.from("fantasy_lineups").select("id").eq("matchday_id", matchday.id).eq("league_member_id", memberId).maybeSingle();
  if (!lineup) return null;
  const { data: rows } = await db.from("fantasy_lineup_players").select("player_id, slot, is_starter, bench_order").eq("lineup_id", lineup.id);
  const leaving = (rows ?? []).find((r) => r.player_id === leavingPlayerId);
  if (!leaving || !leaving.is_starter) return null;
  const benchRows = (rows ?? []).filter((r) => !r.is_starter && r.player_id !== leavingPlayerId);
  if (benchRows.length === 0) return null;
  const ids = [leavingPlayerId, ...benchRows.map((r) => r.player_id as string)];
  const { data: positions } = await db.from("fantasy_players").select("id, position").in("id", ids);
  const positionById = new Map((positions ?? []).map((p) => [p.id as string, p.position as string]));
  const leavingPosition = positionById.get(leavingPlayerId);
  const replacement = benchRows
    .filter((r) => positionById.get(r.player_id as string) === leavingPosition)
    .sort((a, b) => (a.bench_order ?? 9) - (b.bench_order ?? 9))[0];
  if (!replacement) return null;
  return { lineupId: lineup.id as string, slot: leaving.slot as number, subId: replacement.player_id as string };
}

function cleanPgError(message: string): string {
  // PostgREST antepone contexto; nos quedamos con el mensaje de la excepción.
  const cleaned = message.replace(/^.*?:\s*/, "").trim();
  return cleaned.length > 0 && cleaned.length < 160 ? cleaned : "No se pudo completar la operación.";
}

export async function executeTransfer(db: Db, args: TransferArgs) {
  const settings = leagueSettings(args.league);
  const amount = Math.round(args.amount);

  // Antes de transferir, planeamos el recambio del hueco (la RPC quita al
  // jugador de las alineaciones, así que hay que decidir el suplente ahora).
  const promotion = args.fromMemberId ? await planVacancyPromotion(db, args.league, args.fromMemberId, args.playerId) : null;

  const { error } = await db.rpc("fantasy_execute_transfer", {
    p_league_id: args.league.id,
    p_player_id: args.playerId,
    p_from_member: args.fromMemberId,
    p_to_member: args.toMemberId,
    p_amount: amount,
    p_kind: args.kind,
    p_listing_id: args.listingId ?? null,
    p_clause_multiplier: settings.clauseMultiplier,
    p_squad_size: args.league.squad_size,
    p_max_debt_pct: settings.rules.maxDebtPercent,
  });
  if (error) throw new ServiceError(cleanPgError(error.message), 400);

  // La RPC ya cancela ventas/ofertas pendientes del jugador y lo saca de las
  // alineaciones. Aquí solo ascendemos un suplente al hueco que deja, si lo hay.
  if (promotion) {
    await db.from("fantasy_lineup_players")
      .update({ is_starter: true, slot: promotion.slot, bench_order: null })
      .eq("lineup_id", promotion.lineupId)
      .eq("player_id", promotion.subId);
  }
  if (args.toMemberId) await addToCurrentBench(db, args.league, args.toMemberId, args.playerId);
  await audit(db, args.league.id, args.actorUserId, `transfer_${args.kind}`, args.detail);
}

export async function resolveDueListings(db: Db, league: LeagueRow) {
  const now = new Date().toISOString();
  const { data: due } = await db
    .from("fantasy_market_listings")
    .select("id, player_id, asking_price, kind, seller_member_id")
    .eq("league_id", league.id)
    .eq("status", "open")
    .eq("kind", "bid")
    .lte("closes_at", now);
  for (const listing of due ?? []) {
    const { data: bids } = await db
      .from("fantasy_bids")
      .select("id, bidder_member_id, amount, created_at")
      .eq("listing_id", listing.id)
      .order("amount", { ascending: false })
      .order("created_at", { ascending: true });
    const { data: playerRow } = await db.from("fantasy_players").select("name").eq("id", listing.player_id).maybeSingle();
    const playerName = playerRow?.name ?? "Jugador";

    let winner: MemberRow | null = null;
    const orderedBids = (bids ?? []).filter((bid) => Number(bid.amount) >= Number(listing.asking_price));
    for (const bid of orderedBids) {
      const bidder = await memberById(db, bid.bidder_member_id);
      try {
        // La RPC valida saldo/propiedad y marca la subasta como aceptada de forma atómica.
        await executeTransfer(db, {
          league,
          playerId: listing.player_id,
          fromMemberId: null,
          toMemberId: bidder.id,
          amount: Number(bid.amount),
          kind: "bid",
          listingId: listing.id,
          actorUserId: bidder.user_id,
          detail: `${bidder.team_name} ganó la puja por ${playerName} (${(Number(bid.amount) / 1e6).toFixed(1)} M€)`,
        });
        winner = bidder;
        break;
      } catch {
        // Saldo insuficiente, ya fichado o subasta tomada por otra resolución: probamos la siguiente puja.
        continue;
      }
    }

    if (winner) {
      await notify(db, winner.user_id, league.id, "bid_won", "Puja ganada", `Has fichado a ${playerName} por ${(Number(orderedBids.find((b) => b.bidder_member_id === winner!.id)?.amount ?? 0) / 1e6).toFixed(1)} M€.`);
      for (const bid of orderedBids) {
        if (bid.bidder_member_id === winner.id) continue;
        const loser = await memberById(db, bid.bidder_member_id);
        await notify(db, loser.user_id, league.id, "bid_lost", "Puja no ganada", `${winner.team_name} se llevó a ${playerName}.`);
      }
    } else {
      await db.from("fantasy_market_listings").update({ status: "expired", resolved_at: now }).eq("id", listing.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Simulación de jornada
// ---------------------------------------------------------------------------

function generateStats(player: PlayerRow, cleanSheetTeams: Set<string>): PlayerMatchStats {
  const value = Number(player.current_value);
  const tier = Math.min(2.5, Math.max(0.35, value / 8_000_000));
  const roll = Math.random();
  let minutes = 0;
  if (roll < 0.62) minutes = 90;
  else if (roll < 0.78) minutes = 60 + Math.floor(Math.random() * 30);
  else if (roll < 0.9) minutes = 5 + Math.floor(Math.random() * 40);
  const played = minutes > 0;
  const minuteFactor = minutes / 90;
  const position = player.position;
  const goalLambda = { POR: 0.004, DEF: 0.06, MED: 0.17, DEL: 0.42 }[position] * tier * minuteFactor;
  const assistLambda = { POR: 0.01, DEF: 0.1, MED: 0.25, DEL: 0.2 }[position] * tier * minuteFactor;
  const goals = played ? poisson(goalLambda) : 0;
  const assists = played ? poisson(assistLambda) : 0;
  const cleanSheet = played && player.team_id ? cleanSheetTeams.has(player.team_id) : false;
  const rawRating = 6 + goals * 0.9 + assists * 0.6 + (cleanSheet && (position === "POR" || position === "DEF") ? 0.4 : 0) + (Math.random() * 2.1 - 0.95);
  return {
    minutes,
    rating: played ? Math.round(Math.min(10, Math.max(3, rawRating)) * 10) / 10 : undefined,
    goals,
    assists,
    cleanSheet,
    saves: played && position === "POR" ? Math.floor(Math.random() * 7) : 0,
    penaltySaved: played && position === "POR" && Math.random() < 0.04 ? 1 : 0,
    yellowCards: played && Math.random() < (position === "POR" ? 0.05 : 0.14) ? 1 : 0,
    redCards: played && Math.random() < 0.015 ? 1 : 0,
    ownGoals: played && Math.random() < (position === "DEF" ? 0.012 : 0.005) ? 1 : 0,
    penaltyMissed: played && Math.random() < (position === "DEL" ? 0.03 : 0.008) ? 1 : 0,
  };
}

export async function simulateMatchday(db: Db, league: LeagueRow, actorUserId: string) {
  const matchday = await activeMatchday(db, league);
  if (!matchday || matchday.status === "finished") fail("La temporada ya está completada. Reinicia la liga para empezar otra.");
  const rules = scoringRules(league);
  const settings = leagueSettings(league);
  const players = await fetchPlayers(db, league.season);
  const playersById = new Map(players.map((p) => [p.id, p]));

  // Puntos reales de LaLiga para esta jornada (si se han sincronizado).
  const { data: realRows } = await db
    .from("fantasy_player_week_points")
    .select("player_id, points, played")
    .eq("week", matchday.number)
    .limit(5000);
  const realByPlayer = new Map<string, { points: number; played: boolean }>();
  for (const row of realRows ?? []) realByPlayer.set(row.player_id as string, { points: Number(row.points), played: Boolean(row.played) });
  const useReal = realByPlayer.size > 0;

  const teamIds = [...new Set(players.map((p) => p.team_id).filter(Boolean))] as string[];
  const cleanSheetTeams = new Set(teamIds.filter(() => Math.random() < 0.28));

  const statsByPlayer = new Map<string, { stats: PlayerMatchStats; points: number }>();
  for (const player of players) {
    if (useReal) {
      const real = realByPlayer.get(player.id);
      const played = real !== undefined;
      const points = real?.points ?? 0;
      // Minutos sintéticos: solo para que las sustituciones automáticas detecten quién no jugó.
      const stats = { minutes: played ? 90 : 0, goals: 0, assists: 0, cleanSheet: false, saves: 0, penaltySaved: 0, yellowCards: 0, redCards: 0, ownGoals: 0, penaltyMissed: 0 } as PlayerMatchStats;
      statsByPlayer.set(player.id, { stats, points });
    } else {
      const stats = generateStats(player, cleanSheetTeams);
      statsByPlayer.set(player.id, { stats, points: calculateFantasyPoints(stats, rules) });
    }
  }

  const scoreRows = [...statsByPlayer.entries()].map(([playerId, { stats, points }]) => ({
    league_id: league.id,
    matchday_id: matchday.id,
    player_id: playerId,
    points,
    breakdown: stats as unknown as Record<string, unknown>,
  }));
  for (let i = 0; i < scoreRows.length; i += 200) {
    const { error } = await db.from("fantasy_player_scores").upsert(scoreRows.slice(i, i + 200), { onConflict: "league_id,matchday_id,player_id" });
    if (error) throw new ServiceError(`No se pudieron guardar los puntos: ${error.message}`, 500);
  }

  const { data: members } = await db.from("fantasy_league_members").select("id, user_id, team_name, budget, total_points").eq("league_id", league.id);
  for (const member of members ?? []) {
    let { data: lineup } = await db.from("fantasy_lineups").select("id, formation, captain_player_id").eq("matchday_id", matchday.id).eq("league_member_id", member.id).maybeSingle();
    if (!lineup) {
      const { data: squadRows } = await db.from("fantasy_squads").select("player_id").eq("league_member_id", member.id);
      const squadPlayers = (squadRows ?? []).map((row) => playersById.get(row.player_id as string)).filter(Boolean) as PlayerRow[];
      if (squadPlayers.length === 0) continue;
      await createDefaultLineup(db, league, member.id, squadPlayers, matchday.id);
      ({ data: lineup } = await db.from("fantasy_lineups").select("id, formation, captain_player_id").eq("matchday_id", matchday.id).eq("league_member_id", member.id).maybeSingle());
      if (!lineup) continue;
    }
    const { data: lineupPlayers } = await db.from("fantasy_lineup_players").select("player_id, is_starter, bench_order").eq("lineup_id", lineup.id);
    const starters = (lineupPlayers ?? []).filter((p) => p.is_starter).map((p) => p.player_id as string);
    const bench = (lineupPlayers ?? []).filter((p) => !p.is_starter).sort((a, b) => (a.bench_order ?? 9) - (b.bench_order ?? 9)).map((p) => p.player_id as string);

    const usedBench = new Set<string>();
    let total = 0;
    for (const starterId of starters) {
      const starterStats = statsByPlayer.get(starterId);
      const starterPlayer = playersById.get(starterId);
      let effectiveId = starterId;
      if (settings.bench && starterPlayer && (!starterStats || starterStats.stats.minutes === 0)) {
        const substitute = bench.find((benchId) => {
          if (usedBench.has(benchId)) return false;
          const benchPlayer = playersById.get(benchId);
          const benchStats = statsByPlayer.get(benchId);
          return Boolean(benchPlayer && benchStats && benchStats.stats.minutes > 0 && benchPlayer.position === starterPlayer.position);
        });
        if (substitute) {
          usedBench.add(substitute);
          effectiveId = substitute;
        }
      }
      total += statsByPlayer.get(effectiveId)?.points ?? 0;
    }
    if (settings.captain && lineup.captain_player_id) {
      const captainPoints = statsByPlayer.get(lineup.captain_player_id)?.points ?? 0;
      if (starters.includes(lineup.captain_player_id)) total += captainPoints * (settings.captainMultiplier - 1);
    }
    // Norma: penalización por cada hueco de titular sin alinear.
    const shape = formations[lineup.formation as string];
    const expectedStarters = shape ? 1 + shape.DEF + shape.MED + shape.DEL : 11;
    const emptySlots = Math.max(0, expectedStarters - starters.length);
    total += emptySlots * settings.rules.unalignedPenalty;
    // Norma: saldo negativo. O bien no puntúas esa jornada, o bien resta puntos.
    if (Number(member.budget) < 0) {
      if (settings.rules.negativeBalanceZero) total = 0;
      else total += settings.rules.negativeBalancePenalty;
    }
    total = Math.round(total * 100) / 100;
    // Norma: dinero ganado por cada punto positivo de la jornada.
    const moneyAward = Math.round(Math.max(0, total) * settings.rules.moneyPerPoint);
    await db.from("fantasy_lineups").update({ total_points: total }).eq("id", lineup.id);
    await db.from("fantasy_league_members").update({ total_points: Number(member.total_points) + total, budget: Number(member.budget) + moneyAward }).eq("id", member.id);
    const moneyNote = moneyAward > 0 ? ` y ganaste ${(moneyAward / 1e6).toLocaleString("es-ES", { maximumFractionDigits: 1 })} M€` : "";
    await notify(db, member.user_id as string, league.id, "matchday_played", `Jornada ${matchday.number} disputada`, `Tu equipo sumó ${Math.round(total)} pts${moneyNote}.`);
  }

  // Evolución de valores de mercado según rendimiento.
  const valueRows = players.map((player) => {
    const points = statsByPlayer.get(player.id)?.points ?? 0;
    const next = roundMoney(Math.min(35_000_000, Math.max(200_000, Number(player.current_value) * (1 + (points - 3.5) * 0.012))));
    return {
      id: player.id,
      external_id: undefined as unknown,
      current_value: next,
      metadata: { ...(player.metadata ?? {}), prevValue: Number(player.current_value) },
    };
  });
  for (const row of valueRows) {
    await db.from("fantasy_players").update({ current_value: row.current_value, metadata: row.metadata }).eq("id", row.id);
  }
  // Histórico de precios para las gráficas (un snapshot por jornada).
  const recordedAt = new Date().toISOString();
  const snapshots = valueRows.map((row) => ({ player_id: row.id, value: row.current_value, recorded_at: recordedAt }));
  for (let i = 0; i < snapshots.length; i += 200) {
    await db.from("fantasy_player_values").insert(snapshots.slice(i, i + 200));
  }

  await db.from("fantasy_matchdays").update({ status: "finished", ends_at: new Date().toISOString() }).eq("id", matchday.id);
  const nextNumber = matchday.number + 1;
  if (nextNumber <= TOTAL_MATCHDAYS) {
    await db.from("fantasy_matchdays").update({ status: "active" }).eq("league_id", league.id).eq("number", nextNumber);
    await db.from("fantasy_leagues").update({ current_matchday: nextNumber }).eq("id", league.id);
    // Las alineaciones de la nueva jornada parten de las de la anterior.
    const { data: allLineups } = await db.from("fantasy_lineups").select("id, league_member_id, formation, captain_player_id").eq("matchday_id", matchday.id);
    const { data: nextMatchday } = await db.from("fantasy_matchdays").select("id").eq("league_id", league.id).eq("number", nextNumber).maybeSingle();
    if (nextMatchday) {
      for (const previous of allLineups ?? []) {
        const { data: created } = await db.from("fantasy_lineups").upsert({
          matchday_id: nextMatchday.id,
          league_member_id: previous.league_member_id,
          formation: previous.formation,
          captain_player_id: previous.captain_player_id,
        }, { onConflict: "matchday_id,league_member_id" }).select("id").single();
        if (!created) continue;
        const { data: previousPlayers } = await db.from("fantasy_lineup_players").select("player_id, slot, is_starter, bench_order").eq("lineup_id", previous.id);
        if ((previousPlayers ?? []).length > 0) {
          await db.from("fantasy_lineup_players").delete().eq("lineup_id", created.id);
          await db.from("fantasy_lineup_players").insert((previousPlayers ?? []).map((p) => ({ ...p, lineup_id: created.id })));
        }
      }
    }
  }

  await refreshMarket(db, { ...league, current_matchday: Math.min(nextNumber, TOTAL_MATCHDAYS) });
  await audit(db, league.id, actorUserId, "matchday_simulated", `Se disputó la jornada ${matchday.number}`);
  return { matchday: matchday.number };
}

// ---------------------------------------------------------------------------
// Reinicio de liga
// ---------------------------------------------------------------------------

export async function resetLeague(db: Db, league: LeagueRow, actorUserId: string) {
  const { data: members } = await db.from("fantasy_league_members").select("id, user_id, team_name").eq("league_id", league.id);
  const memberIds = (members ?? []).map((m) => m.id);

  await db.from("fantasy_market_listings").delete().eq("league_id", league.id);
  await db.from("fantasy_direct_offers").delete().eq("league_id", league.id);
  await db.from("fantasy_transfers").delete().eq("league_id", league.id);
  await db.from("fantasy_player_scores").delete().eq("league_id", league.id);
  await db.from("fantasy_matchdays").delete().eq("league_id", league.id);
  await db.from("fantasy_chat_messages").delete().eq("league_id", league.id);
  if (memberIds.length > 0) await db.from("fantasy_squads").delete().in("league_member_id", memberIds);

  // Restaura el valor base de los jugadores (afecta a esta temporada del juego).
  const players = await fetchPlayers(db, league.season);
  for (const player of players) {
    const base = Number((player.metadata as Record<string, unknown> | null)?.baseValue ?? player.current_value);
    if (base !== Number(player.current_value)) {
      await db.from("fantasy_players").update({ current_value: base, metadata: { ...(player.metadata ?? {}), prevValue: base } }).eq("id", player.id);
    }
  }

  await db.from("fantasy_leagues").update({ current_matchday: 1 }).eq("id", league.id);
  const refreshed: LeagueRow = { ...league, current_matchday: 1 };
  await createMatchdays(db, league.id);

  for (const member of members ?? []) {
    await db.from("fantasy_league_members").update({ budget: Number(league.starting_budget), total_points: 0 }).eq("id", member.id);
    await assignRandomSquad(db, refreshed, member.id);
  }
  await refreshMarket(db, refreshed);
  await audit(db, league.id, actorUserId, "league_reset", "La liga se reinició: nuevas plantillas aleatorias para todos");
  return { members: memberIds.length };
}

// ---------------------------------------------------------------------------
// Estado agregado para la UI
// ---------------------------------------------------------------------------

function toApiPlayer(player: PlayerRow, stats: Map<string, { season: number; last: number | null }>): ApiPlayer {
  const teamColors = Array.isArray(player.team?.colors) ? (player.team?.colors as string[]) : [];
  const playerStats = stats.get(player.id);
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    team: player.team?.name ?? "—",
    teamShort: player.team?.short_name ?? "?",
    teamColor: teamColors[0] ?? "#3b6c4f",
    teamLogo: player.team?.badge_url ?? (player.team?.external_id ? `https://media.api-sports.io/football/teams/${player.team.external_id}.png` : null),
    photo: player.photo_url ?? null,
    value: Number(player.current_value),
    seasonPoints: playerStats?.season ?? 0,
    lastPoints: playerStats?.last ?? null,
  };
}

export async function getLeagueState(db: Db, league: LeagueRow, member: MemberRow, user: { id: string; username: string; displayName: string }): Promise<LeagueState> {
  await refreshMarket(db, league).catch(() => undefined);

  const settings = leagueSettings(league);
  const players = await fetchPlayers(db, league.season);
  const playersById = new Map(players.map((p) => [p.id, p]));

  const { data: statRows } = await db.rpc("fantasy_league_player_stats", { p_league_id: league.id });
  const stats = new Map<string, { season: number; last: number | null }>();
  for (const row of (statRows ?? []) as { player_id: string; season_points: number; last_points: number | null }[]) {
    stats.set(row.player_id, { season: Number(row.season_points), last: row.last_points === null ? null : Number(row.last_points) });
  }
  const player = (id: string): ApiPlayer => {
    const row = playersById.get(id);
    return row ? toApiPlayer(row, stats) : { id, name: "Jugador", position: "MED", team: "—", teamShort: "?", teamColor: "#3b6c4f", teamLogo: null, photo: null, value: 0, seasonPoints: 0, lastPoints: null };
  };

  const { data: memberRows } = await db
    .from("fantasy_league_members")
    .select("id, user_id, role, team_name, budget, total_points, color, user:fantasy_users(display_name)")
    .eq("league_id", league.id);
  const membersData = (memberRows ?? []) as unknown as (MemberRow & { user: { display_name: string } | null })[];
  const memberIds = membersData.map((m) => m.id);

  const { data: squadRows } = await db
    .from("fantasy_squads")
    .select("league_member_id, player_id, purchase_price, clause_value")
    .in("league_member_id", memberIds.length > 0 ? memberIds : ["00000000-0000-0000-0000-000000000000"])
    .limit(2000);
  const squads = squadRows ?? [];

  const squadValueByMember = new Map<string, number>();
  const squadCountByMember = new Map<string, number>();
  for (const row of squads) {
    const value = Number(playersById.get(row.player_id as string)?.current_value ?? 0);
    squadValueByMember.set(row.league_member_id as string, (squadValueByMember.get(row.league_member_id as string) ?? 0) + value);
    squadCountByMember.set(row.league_member_id as string, (squadCountByMember.get(row.league_member_id as string) ?? 0) + 1);
  }

  // Última jornada disputada.
  const { data: lastFinished } = await db
    .from("fantasy_matchdays")
    .select("id, number")
    .eq("league_id", league.id)
    .eq("status", "finished")
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  let lastRoundByMember = new Map<string, number>();
  let lastMatchday: LeagueState["lastMatchday"] = null;
  if (lastFinished) {
    const { data: lastLineups } = await db.from("fantasy_lineups").select("league_member_id, total_points, id").eq("matchday_id", lastFinished.id);
    lastRoundByMember = new Map((lastLineups ?? []).map((row) => [row.league_member_id as string, Number(row.total_points)]));
    const myLineup = (lastLineups ?? []).find((row) => row.league_member_id === member.id);
    let myPlayerPoints: NonNullable<LeagueState["lastMatchday"]>["myPlayerPoints"] = [];
    if (myLineup) {
      const { data: myPlayers } = await db.from("fantasy_lineup_players").select("player_id, is_starter").eq("lineup_id", myLineup.id);
      const ids = (myPlayers ?? []).map((p) => p.player_id as string);
      const { data: scores } = ids.length > 0
        ? await db.from("fantasy_player_scores").select("player_id, points").eq("matchday_id", lastFinished.id).eq("league_id", league.id).in("player_id", ids)
        : { data: [] };
      const pointsByPlayer = new Map((scores ?? []).map((s) => [s.player_id as string, Number(s.points)]));
      myPlayerPoints = (myPlayers ?? [])
        .map((p) => {
          const apiPlayer = player(p.player_id as string);
          return {
            playerId: p.player_id as string,
            name: apiPlayer.name,
            team: apiPlayer.team,
            teamShort: apiPlayer.teamShort,
            teamColor: apiPlayer.teamColor,
            teamLogo: apiPlayer.teamLogo,
            photo: apiPlayer.photo,
            points: pointsByPlayer.get(p.player_id as string) ?? 0,
            starter: Boolean(p.is_starter),
          };
        })
        .sort((a, b) => Number(b.starter) - Number(a.starter) || b.points - a.points);
    }
    lastMatchday = {
      number: lastFinished.number,
      memberPoints: membersData.map((m) => ({ memberId: m.id, points: lastRoundByMember.get(m.id) ?? 0 })),
      myPlayerPoints,
    };
  }

  // Mi alineación actual.
  const matchday = await activeMatchday(db, league);
  let lineupLocksAt: string | null = null;
  if (matchday) {
    const { data: md } = await db.from("fantasy_matchdays").select("locks_at").eq("id", matchday.id).maybeSingle();
    lineupLocksAt = (md?.locks_at as string | null) ?? null;
  }
  const { data: finishedMatchdays } = await db
    .from("fantasy_matchdays")
    .select("id, number")
    .eq("league_id", league.id)
    .eq("status", "finished")
    .order("number", { ascending: false })
    .limit(TOTAL_MATCHDAYS);
  const finishedIds = (finishedMatchdays ?? []).map((row) => row.id as string);
  const { data: finishedLineups } = finishedIds.length > 0
    ? await db.from("fantasy_lineups").select("matchday_id, league_member_id, total_points").in("matchday_id", finishedIds)
    : { data: [] };
  const roundResults: LeagueState["roundResults"] = (finishedMatchdays ?? []).map((matchdayRow) => ({
    number: Number(matchdayRow.number),
    memberPoints: membersData.map((m) => ({
      memberId: m.id,
      points: Number((finishedLineups ?? []).find((row) => row.matchday_id === matchdayRow.id && row.league_member_id === m.id)?.total_points ?? 0),
    })),
  }));

  let lineup: LineupState = { formation: "4-4-2", captainPlayerId: null, starters: [], bench: [] };
  if (matchday) {
    const { data: lineupRow } = await db.from("fantasy_lineups").select("id, formation, captain_player_id").eq("matchday_id", matchday.id).eq("league_member_id", member.id).maybeSingle();
    if (lineupRow) {
      const { data: lineupPlayers } = await db.from("fantasy_lineup_players").select("player_id, slot, is_starter, bench_order").eq("lineup_id", lineupRow.id);
      const sorted = (lineupPlayers ?? []).sort((a, b) => (a.slot as number) - (b.slot as number));
      lineup = {
        formation: lineupRow.formation,
        captainPlayerId: lineupRow.captain_player_id,
        starters: sorted.filter((p) => p.is_starter).map((p) => p.player_id as string),
        bench: sorted.filter((p) => !p.is_starter).sort((a, b) => (a.bench_order ?? 9) - (b.bench_order ?? 9)).map((p) => p.player_id as string),
      };
    }
  }

  // Alineaciones de los rivales (jornada actual).
  const rivalLineups: LeagueState["rivalLineups"] = [];
  if (matchday) {
    const rivalIds = membersData.filter((m) => m.id !== member.id).map((m) => m.id);
    if (rivalIds.length > 0) {
      const { data: rlRows } = await db.from("fantasy_lineups").select("id, league_member_id, formation, captain_player_id, submitted_at").eq("matchday_id", matchday.id).in("league_member_id", rivalIds);
      const rlIds = (rlRows ?? []).map((r) => r.id);
      const { data: rlPlayers } = rlIds.length > 0
        ? await db.from("fantasy_lineup_players").select("lineup_id, player_id, slot, is_starter").in("lineup_id", rlIds)
        : { data: [] };
      for (const row of rlRows ?? []) {
        const ps = (rlPlayers ?? []).filter((p) => p.lineup_id === row.id).sort((a, b) => (a.slot as number) - (b.slot as number));
        rivalLineups.push({
          memberId: row.league_member_id as string,
          formation: row.formation,
          captainPlayerId: row.captain_player_id,
          starters: ps.filter((p) => p.is_starter).map((p) => p.player_id as string),
          submitted: row.submitted_at !== null,
        });
      }
    }
  }

  // Mercado abierto.
  const { data: listings } = await db
    .from("fantasy_market_listings")
    .select("id, player_id, seller_member_id, kind, asking_price, closes_at")
    .eq("league_id", league.id)
    .eq("status", "open")
    .order("closes_at", { ascending: true, nullsFirst: false });
  const listingIds = (listings ?? []).map((l) => l.id);
  const { data: allBids } = listingIds.length > 0
    ? await db.from("fantasy_bids").select("listing_id, bidder_member_id, amount").in("listing_id", listingIds)
    : { data: [] };
  const memberName = (id: string | null) => membersData.find((m) => m.id === id)?.team_name ?? null;
  const marketListings: MarketListing[] = (listings ?? []).map((listing) => {
    const bids = (allBids ?? []).filter((b) => b.listing_id === listing.id);
    const mine = bids.find((b) => b.bidder_member_id === member.id);
    return {
      id: listing.id,
      kind: listing.kind,
      player: player(listing.player_id as string),
      askingPrice: Number(listing.asking_price),
      closesAt: listing.closes_at,
      sellerMemberId: listing.seller_member_id,
      sellerName: memberName(listing.seller_member_id),
      myBid: mine ? Number(mine.amount) : null,
      bidCount: bids.length,
    };
  });

  // Ofertas directas.
  const { data: offers } = await db
    .from("fantasy_direct_offers")
    .select("id, player_id, from_member_id, to_member_id, amount, status, created_at")
    .eq("league_id", league.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  const toOffer = (row: NonNullable<typeof offers>[number]) => ({
    id: row.id,
    player: player(row.player_id as string),
    fromMemberId: row.from_member_id as string,
    fromName: memberName(row.from_member_id) ?? "—",
    toMemberId: row.to_member_id as string,
    toName: memberName(row.to_member_id) ?? "—",
    amount: Number(row.amount),
    status: row.status as "pending",
    createdAt: row.created_at as string,
  });

  // Actividad reciente.
  const { data: auditRows } = await db
    .from("fantasy_audit_log")
    .select("id, action, after_data, created_at, actor:fantasy_users(display_name)")
    .eq("league_id", league.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const activity: ActivityItem[] = ((auditRows ?? []) as unknown as { id: number; action: string; after_data: { detail?: string } | null; created_at: string; actor: { display_name: string } | null }[]).map((row) => ({
    id: row.id,
    action: row.action,
    detail: row.after_data?.detail ?? row.action,
    actorName: row.actor?.display_name ?? null,
    createdAt: row.created_at,
  }));

  // Notificaciones del usuario en esta liga.
  const { data: notifRows } = await db
    .from("fantasy_notifications")
    .select("id, kind, title, body, read_at, created_at")
    .eq("user_id", user.id)
    .eq("league_id", league.id)
    .order("created_at", { ascending: false })
    .limit(30);
  const notifications = ((notifRows ?? []) as { id: string; kind: string; title: string; body: string | null; read_at: string | null; created_at: string }[]).map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    read: row.read_at !== null,
    createdAt: row.created_at,
  }));
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Propuestas de cambio de normas abiertas y sus votos.
  const { data: proposalRows } = await db
    .from("fantasy_rule_proposals")
    .select("id, summary, proposed_by, created_at")
    .eq("league_id", league.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  const proposalIds = (proposalRows ?? []).map((p) => p.id);
  const { data: voteRows } = proposalIds.length > 0
    ? await db.from("fantasy_rule_votes").select("proposal_id, member_id, approve").in("proposal_id", proposalIds)
    : { data: [] };
  const proposals = ((proposalRows ?? []) as { id: string; summary: string; proposed_by: string | null; created_at: string }[]).map((p) => {
    const votes = (voteRows ?? []).filter((v) => v.proposal_id === p.id);
    const mine = votes.find((v) => v.member_id === member.id);
    return {
      id: p.id,
      summary: p.summary,
      proposedByName: membersData.find((m) => m.id === p.proposed_by)?.team_name ?? "—",
      createdAt: p.created_at,
      yes: votes.filter((v) => v.approve).length,
      no: votes.filter((v) => !v.approve).length,
      total: membersData.length,
      myVote: mine ? Boolean(mine.approve) : null,
      mine: p.proposed_by === member.id,
    };
  });

  // Historial de propuestas ya resueltas.
  const { data: historyRows } = await db
    .from("fantasy_rule_proposals")
    .select("id, summary, status, resolved_at")
    .eq("league_id", league.id)
    .neq("status", "pending")
    .order("resolved_at", { ascending: false })
    .limit(6);
  const proposalHistory = ((historyRows ?? []) as { id: string; summary: string; status: string; resolved_at: string | null }[]).map((r) => ({
    id: r.id,
    summary: r.summary,
    status: r.status as "approved" | "rejected" | "cancelled",
    resolvedAt: r.resolved_at,
  }));

  const mySquad = squads.filter((row) => row.league_member_id === member.id);
  const rivalSquads = squads.filter((row) => row.league_member_id !== member.id);

  // Forma: puntos de las últimas 5 jornadas reales de cada jugador de mi plantilla.
  const last5ByPlayer = new Map<string, number[]>();
  const mySquadIds = mySquad.map((row) => row.player_id as string);
  if (mySquadIds.length > 0) {
    const { data: wpMax } = await db.from("fantasy_player_week_points").select("week").order("week", { ascending: false }).limit(1).maybeSingle();
    const maxWeek = Number(wpMax?.week ?? 0);
    if (maxWeek > 0) {
      const { data: wpRows } = await db
        .from("fantasy_player_week_points")
        .select("player_id, week, points")
        .gte("week", Math.max(1, maxWeek - 4))
        .lte("week", maxWeek)
        .in("player_id", mySquadIds);
      const grouped = new Map<string, { week: number; points: number }[]>();
      for (const r of wpRows ?? []) {
        const arr = grouped.get(r.player_id as string) ?? [];
        arr.push({ week: Number(r.week), points: Number(r.points) });
        grouped.set(r.player_id as string, arr);
      }
      for (const [pid, arr] of grouped) last5ByPlayer.set(pid, arr.sort((a, b) => a.week - b.week).map((x) => x.points));
    }
  }

  return {
    user,
    league: {
      id: league.id,
      name: league.name,
      inviteCode: league.invite_code,
      season: league.season,
      currentMatchday: league.current_matchday,
      totalMatchdays: TOTAL_MATCHDAYS,
      startingBudget: Number(league.starting_budget),
      settings,
      isAdmin: isAdmin(member),
      lineupLocksAt,
    },
    myMember: {
      id: member.id,
      budget: Number(member.budget),
      teamName: member.team_name,
      role: member.role,
      debtAllowance: Math.floor((squadValueByMember.get(member.id) ?? 0) * settings.rules.maxDebtPercent / 100),
    },
    members: membersData
      .map((m) => ({
        id: m.id,
        userId: m.user_id,
        displayName: m.user?.display_name ?? "—",
        teamName: m.team_name,
        role: m.role,
        color: m.color ?? "#65d5ff",
        totalPoints: Number(m.total_points),
        squadValue: squadValueByMember.get(m.id) ?? 0,
        squadSize: squadCountByMember.get(m.id) ?? 0,
        lastRoundPoints: lastRoundByMember.has(m.id) ? lastRoundByMember.get(m.id)! : null,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints),
    squad: mySquad
      .map((row) => ({
        ...player(row.player_id as string),
        purchasePrice: Number(row.purchase_price),
        clauseValue: row.clause_value === null ? null : Number(row.clause_value),
        last5: last5ByPlayer.get(row.player_id as string) ?? [],
      }))
      .sort((a, b) => ["POR", "DEF", "MED", "DEL"].indexOf(a.position) - ["POR", "DEF", "MED", "DEL"].indexOf(b.position) || b.value - a.value),
    lineup,
    market: marketListings.filter((l) => l.kind === "bid" || l.sellerMemberId !== member.id),
    rivalSquads: rivalSquads.map((row) => ({
      ...player(row.player_id as string),
      clauseValue: row.clause_value === null ? null : Number(row.clause_value),
      memberId: row.league_member_id as string,
    })),
    rivalLineups,
    offersIn: (offers ?? []).filter((o) => o.to_member_id === member.id).map(toOffer),
    offersOut: (offers ?? []).filter((o) => o.from_member_id === member.id).map(toOffer),
    myListings: marketListings.filter((l) => l.sellerMemberId === member.id),
    lastMatchday,
    roundResults,
    activity,
    proposals,
    proposalHistory,
    notifications,
    unreadCount,
  };
}

// --- Propuestas de cambio de normas (votación por mayoría de la liga) ---

async function resolveProposalIfDecided(db: Db, league: LeagueRow, proposalId: string, force = false) {
  const { data: proposal } = await db.from("fantasy_rule_proposals").select("id, settings, status, summary").eq("id", proposalId).maybeSingle();
  if (!proposal || proposal.status !== "pending") return;
  const { count: totalCount } = await db.from("fantasy_league_members").select("id", { count: "exact", head: true }).eq("league_id", league.id);
  const total = totalCount ?? 0;
  const { data: votes } = await db.from("fantasy_rule_votes").select("approve").eq("proposal_id", proposalId);
  const cast = votes ?? [];
  const yes = cast.filter((v) => v.approve).length;
  const no = cast.filter((v) => !v.approve).length;
  const summary = (proposal.summary as string).slice(0, 120);
  const outcome = proposalOutcome(yes, no, total, cast.length >= total, force);
  if (outcome === "approved") {
    await db.from("fantasy_leagues").update({ settings: proposal.settings }).eq("id", league.id);
    await db.from("fantasy_rule_proposals").update({ status: "approved", resolved_at: new Date().toISOString() }).eq("id", proposalId);
    await audit(db, league.id, null, "proposal_approved", `Propuesta aprobada por mayoría: ${summary}`);
  } else if (outcome === "rejected") {
    await db.from("fantasy_rule_proposals").update({ status: "rejected", resolved_at: new Date().toISOString() }).eq("id", proposalId);
    await audit(db, league.id, null, "proposal_rejected", `Propuesta rechazada: ${summary}`);
  }
}

// Detalle de una jornada: todas las alineaciones con los puntos de cada jugador.
export async function getMatchdayDetail(db: Db, league: LeagueRow, number: number): Promise<MatchdayDetail> {
  const { data: md } = await db.from("fantasy_matchdays").select("id, number, status").eq("league_id", league.id).eq("number", number).maybeSingle();
  if (!md) return { number, finished: false, members: [] };
  const players = await fetchPlayers(db, league.season);
  const playersById = new Map(players.map((p) => [p.id, p]));
  const emptyStats = new Map<string, { season: number; last: number | null }>();
  const { data: memberRows } = await db
    .from("fantasy_league_members")
    .select("id, team_name, color, user:fantasy_users(display_name)")
    .eq("league_id", league.id);
  const membersData = (memberRows ?? []) as unknown as { id: string; team_name: string; color: string | null; user: { display_name: string } | null }[];
  const { data: lineups } = await db.from("fantasy_lineups").select("id, league_member_id, formation, captain_player_id, total_points").eq("matchday_id", md.id);
  const lineupIds = (lineups ?? []).map((l) => l.id);
  const { data: lps } = lineupIds.length > 0
    ? await db.from("fantasy_lineup_players").select("lineup_id, player_id, slot, is_starter").in("lineup_id", lineupIds)
    : { data: [] };
  const { data: scores } = await db.from("fantasy_player_scores").select("player_id, points").eq("matchday_id", md.id).eq("league_id", league.id);
  const scoreById = new Map((scores ?? []).map((s) => [s.player_id as string, Number(s.points)]));

  const members = membersData.map((m) => {
    const lineup = (lineups ?? []).find((l) => l.league_member_id === m.id);
    const rows = lineup ? (lps ?? []).filter((p) => p.lineup_id === lineup.id).sort((a, b) => (a.slot as number) - (b.slot as number)) : [];
    return {
      memberId: m.id,
      teamName: m.team_name,
      displayName: m.user?.display_name ?? "—",
      color: m.color ?? "#65d5ff",
      points: Number(lineup?.total_points ?? 0),
      formation: (lineup?.formation as string) ?? "4-4-2",
      captainPlayerId: (lineup?.captain_player_id as string | null) ?? null,
      players: rows.map((p) => {
        const row = playersById.get(p.player_id as string);
        const api = row ? toApiPlayer(row, emptyStats) : null;
        return {
          playerId: p.player_id as string,
          name: api?.name ?? "Jugador",
          team: api?.team ?? "—",
          teamColor: api?.teamColor ?? "#3b6c4f",
          teamLogo: api?.teamLogo ?? null,
          photo: api?.photo ?? null,
          position: api?.position ?? "MED",
          points: scoreById.get(p.player_id as string) ?? 0,
          starter: Boolean(p.is_starter),
        };
      }),
    };
  }).sort((a, b) => b.points - a.points);

  return { number: md.number, finished: md.status === "finished", members };
}

export async function createProposal(db: Db, league: LeagueRow, member: MemberRow, actorUserId: string, summary: string, rawSettings: unknown) {
  const clean = summary.trim().slice(0, 280) || "Cambio de normas de la liga";
  const settings = parseLeagueSettings(rawSettings);
  const { data: proposal, error } = await db
    .from("fantasy_rule_proposals")
    .insert({ league_id: league.id, proposed_by: member.id, summary: clean, settings, status: "pending" })
    .select("id")
    .single();
  if (error || !proposal) throw new ServiceError("No se pudo crear la propuesta.", 500);
  await db.from("fantasy_rule_votes").insert({ proposal_id: proposal.id, member_id: member.id, approve: true });
  await audit(db, league.id, actorUserId, "proposal_created", `${member.team_name} propuso: ${clean}`);
  // Avisa al resto de la liga para que voten.
  const { data: others } = await db.from("fantasy_league_members").select("user_id").eq("league_id", league.id).neq("id", member.id);
  for (const other of others ?? []) {
    await notify(db, other.user_id as string, league.id, "proposal_opened", "Nueva propuesta de normas", `${member.team_name} propone: ${clean}. ¡Entra en Normas y vota!`);
  }
  await resolveProposalIfDecided(db, league, proposal.id);
  return proposal.id;
}

export async function voteProposal(db: Db, league: LeagueRow, member: MemberRow, proposalId: string, approve: boolean) {
  const { data: proposal } = await db.from("fantasy_rule_proposals").select("id, status").eq("id", proposalId).eq("league_id", league.id).maybeSingle();
  if (!proposal || proposal.status !== "pending") throw new ServiceError("Esta propuesta ya no está abierta.");
  const { error } = await db.from("fantasy_rule_votes").upsert({ proposal_id: proposalId, member_id: member.id, approve }, { onConflict: "proposal_id,member_id" });
  if (error) throw new ServiceError("No se pudo registrar tu voto.", 500);
  await resolveProposalIfDecided(db, league, proposalId);
}

export async function closeProposal(db: Db, league: LeagueRow, member: MemberRow, proposalId: string) {
  if (!isAdmin(member)) throw new ServiceError("Solo un administrador puede cerrar la votación.", 403);
  await resolveProposalIfDecided(db, league, proposalId, true);
}

export async function cancelProposal(db: Db, league: LeagueRow, member: MemberRow, proposalId: string) {
  const { data: proposal } = await db.from("fantasy_rule_proposals").select("id, proposed_by, status").eq("id", proposalId).eq("league_id", league.id).maybeSingle();
  if (!proposal || proposal.status !== "pending") throw new ServiceError("Esta propuesta ya no está abierta.");
  if (proposal.proposed_by !== member.id && !isAdmin(member)) throw new ServiceError("Solo quien la propuso o un administrador puede retirarla.", 403);
  await db.from("fantasy_rule_proposals").update({ status: "cancelled", resolved_at: new Date().toISOString() }).eq("id", proposalId);
}
