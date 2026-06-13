import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkCronAuth, errorResponse } from "@/lib/api-helpers";
import { seedLaLigaReal } from "@/lib/service";
import { currentWeek, fetchSeason } from "@/lib/laliga-fantasy";

// Importa jugadores, equipos, fotos y puntos reales de LaLiga Fantasy.
// Protegido con CRON_SECRET. Acepta ?from= y ?to= para limitar jornadas.
export async function POST(request: Request) {
  if (!checkCronAuth(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "La base de datos no está configurada." }, { status: 503 });
  try {
    const url = new URL(request.url);
    const season = Number(process.env.API_FOOTBALL_SEASON ?? 2025);
    const from = Number(url.searchParams.get("from") ?? 1);
    const to = url.searchParams.get("to") ? Number(url.searchParams.get("to")) : await currentWeek();
    const players = await fetchSeason(from, Math.max(from, to));
    if (players.length === 0) return NextResponse.json({ error: "LaLiga no devolvió jugadores." }, { status: 502 });
    const result = await seedLaLigaReal(db, season, players.map((p) => ({ ...p, weekPoints: [...p.weekPoints.entries()] })));
    return NextResponse.json({ ok: true, season, from, to, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
