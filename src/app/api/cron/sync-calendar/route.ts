import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkCronAuth, errorResponse } from "@/lib/api-helpers";
import { fetchCurrentJornada } from "@/lib/laliga-fantasy";
import { getJornadaState } from "@/lib/calendar";
import { CURRENT_SEASON } from "@/lib/service";

// Punto 3: calendario + auto-bloqueo, con doble fuente (LaLiga + football-data).
// Fija el cierre de alineaciones de la jornada en curso = hora del primer partido
// y guarda los fixtures (detalle desde LaLiga si está disponible). Protegido con
// CRON_SECRET. Debe ejecutarse a menudo durante la temporada (scheduler externo
// o Vercel Pro; en Hobby solo caben 2 crons).
export async function POST(request: Request) {
  if (!checkCronAuth(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "La base de datos no está configurada." }, { status: 503 });
  try {
    const state = await getJornadaState();
    if (!state.week) return NextResponse.json({ error: "No se pudo leer la jornada actual en ninguna fuente." }, { status: 502 });

    // Auto-bloqueo: cierre de la jornada = primer partido (todas las ligas en esa jornada).
    let matchdaysUpdated = 0;
    if (state.opensAt) {
      const { data } = await db
        .from("fantasy_matchdays")
        .update({ locks_at: state.opensAt, starts_at: state.opensAt, ends_at: state.closesAt })
        .eq("number", state.week)
        .select("id");
      matchdaysUpdated = (data ?? []).length;
    }

    // Fixtures de la jornada (detalle con equipos desde LaLiga; best-effort).
    let fixturesSaved = 0;
    try {
      const j = await fetchCurrentJornada();
      if (j.week === state.week && j.matches.length > 0) {
        const extIds = [...new Set(j.matches.flatMap((m) => [m.localId, m.visitorId]))].filter(Boolean).map(Number);
        const { data: teams } = await db.from("fantasy_teams").select("id, external_id").in("external_id", extIds);
        const teamByExt = new Map((teams ?? []).map((t) => [String(t.external_id), t.id as string]));
        const rows = j.matches
          .filter((m) => Number(m.externalId))
          .map((m) => ({
            external_id: Number(m.externalId),
            season: CURRENT_SEASON,
            matchday_number: state.week,
            home_team_id: teamByExt.get(m.localId) ?? null,
            away_team_id: teamByExt.get(m.visitorId) ?? null,
            kickoff_at: m.date,
            status: m.state === 7 ? "finished" : m.state === 0 ? "scheduled" : "live",
            home_score: m.localScore,
            away_score: m.visitorScore,
            raw_data: m as unknown as Record<string, unknown>,
          }));
        await db.from("fantasy_fixtures").delete().eq("season", CURRENT_SEASON).eq("matchday_number", state.week);
        const { error } = await db.from("fantasy_fixtures").insert(rows);
        if (!error) fixturesSaved = rows.length;
      }
    } catch { /* LaLiga no disponible: el bloqueo ya se hizo con el respaldo */ }

    return NextResponse.json({
      ok: true,
      source: state.source,
      week: state.week,
      opensAt: state.opensAt,
      closesAt: state.closesAt,
      allFinished: state.allFinished,
      matchdaysUpdated,
      fixturesSaved,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
