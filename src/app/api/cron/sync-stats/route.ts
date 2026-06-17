import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkCronAuth, errorResponse } from "@/lib/api-helpers";
import { fetchPlayerWeekStats } from "@/lib/laliga-fantasy";

export const maxDuration = 300;

// Sincroniza el detalle por jornada de cada jugador (goles, asistencias,
// tarjetas y minutos) desde la ficha de LaLiga Fantasy y lo guarda en
// fantasy_player_week_points. Una llamada por jugador (≈678), pensado para
// ejecutarse desde el servidor local. Protegido con CRON_SECRET.
// Acepta ?offset= y ?limit= para sincronizar por bloques.
export async function POST(request: Request) {
  if (!checkCronAuth(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "La base de datos no está configurada." }, { status: 503 });
  try {
    const url = new URL(request.url);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 0;

    const { data: players } = await db
      .from("fantasy_players")
      .select("id, external_id")
      .not("external_id", "is", null)
      .order("external_id", { ascending: true });
    let list = players ?? [];
    if (offset) list = list.slice(offset);
    if (limit) list = list.slice(0, limit);

    const rows: Record<string, unknown>[] = [];
    let fetched = 0;
    let failed = 0;
    for (const p of list) {
      try {
        const weeks = await fetchPlayerWeekStats(Number(p.external_id));
        for (const w of weeks) {
          // Solo jornadas en las que el jugador participó (evita filas a cero).
          if (w.minutes <= 0 && w.points === 0) continue;
          rows.push({
            player_id: p.id as string,
            week: w.week,
            points: w.points,
            played: w.minutes > 0,
            goals: w.goals,
            assists: w.assists,
            yellow_cards: w.yellow,
            red_cards: w.red,
            minutes: w.minutes,
          });
        }
        fetched += 1;
      } catch {
        failed += 1;
      }
    }

    let written = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { error } = await db.from("fantasy_player_week_points").upsert(batch, { onConflict: "player_id,week" });
      if (!error) written += batch.length;
    }

    return NextResponse.json({ ok: true, players: list.length, fetched, failed, rowsWritten: written });
  } catch (error) {
    return errorResponse(error);
  }
}
