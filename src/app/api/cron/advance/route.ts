import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkCronAuth, errorResponse } from "@/lib/api-helpers";
import { fetchSeason } from "@/lib/laliga-fantasy";
import { getJornadaState } from "@/lib/calendar";
import { CURRENT_SEASON, seedLaLigaReal, simulateMatchday, type LeagueRow } from "@/lib/service";

const LEAGUE_COLUMNS = "id, owner_id, name, invite_code, season, starting_budget, squad_size, settings, scoring_rules, current_matchday";

// Punto 4+5: auto-avance robusto. Cuando la jornada REAL ha terminado, sincroniza
// sus puntos y resuelve la jornada de cada liga que esté en ese número. Nunca
// resuelve si la jornada sigue en curso, si la API falla/está en mantenimiento o
// si aún no hay puntos: en esos casos no toca nada y se reintenta al siguiente ciclo.
export async function POST(request: Request) {
  if (!checkCronAuth(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "La base de datos no está configurada." }, { status: 503 });
  try {
    // 1) Estado de la jornada real (doble fuente: LaLiga + football-data).
    const jornada = await getJornadaState();
    if (!jornada.week) return NextResponse.json({ skipped: true, reason: "no se pudo leer el calendario en ninguna fuente" });
    const closed = jornada.closesAt ? new Date(jornada.closesAt).getTime() <= Date.now() : false;
    if (!jornada.allFinished || !closed) {
      return NextResponse.json({ skipped: true, reason: "jornada en curso", week: jornada.week, allFinished: jornada.allFinished, closed });
    }

    // 2) Sincroniza los puntos reales de esa jornada. Si la API no devuelve datos
    //    frescos (mantenimiento o aún sin publicar), NO resolvemos con datos viejos.
    let players;
    try {
      players = await fetchSeason(jornada.week, jornada.week);
    } catch (error) {
      return NextResponse.json({ skipped: true, reason: "sync de puntos falló (¿mantenimiento?)", week: jornada.week, error: String(error) });
    }
    if (players.length === 0) {
      return NextResponse.json({ skipped: true, reason: "la jornada aún no tiene datos (¿mantenimiento?)", week: jornada.week });
    }
    await seedLaLigaReal(db, CURRENT_SEASON, players.map((p) => ({ ...p, weekPoints: [...p.weekPoints.entries()], playerMasterStatusId: p.playerMasterStatusId })));

    // 4) Resuelve la jornada en cada liga que esté en ese número (sin bloquear por un fallo).
    const { data: leagues } = await db.from("fantasy_leagues").select(LEAGUE_COLUMNS).eq("current_matchday", jornada.week);
    const resolved: string[] = [];
    const failed: { league: string; error: string }[] = [];
    for (const league of (leagues ?? []) as LeagueRow[]) {
      try {
        await simulateMatchday(db, league, league.owner_id as string);
        resolved.push(league.id);
      } catch (error) {
        failed.push({ league: league.id, error: String(error) });
      }
    }

    return NextResponse.json({ ok: true, week: jornada.week, resolved: resolved.length, failed });
  } catch (error) {
    return errorResponse(error);
  }
}
