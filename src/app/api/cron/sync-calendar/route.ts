import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkCronAuth, errorResponse } from "@/lib/api-helpers";
import { fetchCurrentJornada } from "@/lib/laliga-fantasy";
import { CURRENT_SEASON } from "@/lib/service";

// Punto 3: calendario + auto-bloqueo. Trae la jornada en curso (fecha del primer
// partido y estado de cada partido), fija el cierre de alineaciones de esa
// jornada = hora del primer partido, y guarda los fixtures. Protegido con
// CRON_SECRET. Debe ejecutarse a menudo durante la temporada (scheduler externo
// o Vercel Pro; en Hobby solo caben 2 crons).
export async function POST(request: Request) {
  if (!checkCronAuth(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "La base de datos no está configurada." }, { status: 503 });
  try {
    const jornada = await fetchCurrentJornada();
    if (!jornada.week) return NextResponse.json({ error: "No se pudo leer la jornada actual." }, { status: 502 });

    // Auto-bloqueo: cierre de la jornada = primer partido (todas las ligas en esa jornada).
    let matchdaysUpdated = 0;
    if (jornada.opensAt) {
      const { data } = await db
        .from("fantasy_matchdays")
        .update({ locks_at: jornada.opensAt, starts_at: jornada.opensAt, ends_at: jornada.closesAt })
        .eq("number", jornada.week)
        .select("id");
      matchdaysUpdated = (data ?? []).length;
    }

    // Fixtures de la jornada en curso (reemplaza los de esa jornada).
    let fixturesSaved = 0;
    if (jornada.matches.length > 0) {
      const extIds = [...new Set(jornada.matches.flatMap((m) => [m.localId, m.visitorId]))].filter(Boolean).map(Number);
      const { data: teams } = await db.from("fantasy_teams").select("id, external_id").in("external_id", extIds);
      const teamByExt = new Map((teams ?? []).map((t) => [String(t.external_id), t.id as string]));
      const rows = jornada.matches
        .filter((m) => Number(m.externalId))
        .map((m) => ({
          external_id: Number(m.externalId),
          season: CURRENT_SEASON,
          matchday_number: jornada.week,
          home_team_id: teamByExt.get(m.localId) ?? null,
          away_team_id: teamByExt.get(m.visitorId) ?? null,
          kickoff_at: m.date,
          status: m.state === 7 ? "finished" : m.state === 0 ? "scheduled" : "live",
          home_score: m.localScore,
          away_score: m.visitorScore,
          raw_data: m as unknown as Record<string, unknown>,
        }));
      await db.from("fantasy_fixtures").delete().eq("season", CURRENT_SEASON).eq("matchday_number", jornada.week);
      const { error } = await db.from("fantasy_fixtures").insert(rows);
      if (!error) fixturesSaved = rows.length;
    }

    return NextResponse.json({
      ok: true,
      week: jornada.week,
      opensAt: jornada.opensAt,
      closesAt: jornada.closesAt,
      allFinished: jornada.allFinished,
      matchdaysUpdated,
      fixturesSaved,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
