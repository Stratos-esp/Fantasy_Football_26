import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkCronAuth, errorResponse } from "@/lib/api-helpers";
import { refreshMarket, type LeagueRow } from "@/lib/service";

// Resuelve las pujas vencidas y repone el mercado de todas las ligas.
// Vercel lo invoca a diario; además, cada carga del estado lo hace de forma diferida.
export async function GET(request: Request) {
  if (!checkCronAuth(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "La base de datos no está configurada." }, { status: 503 });
  try {
    const { data: leagues } = await db
      .from("fantasy_leagues")
      .select("id, owner_id, name, invite_code, season, starting_budget, squad_size, settings, scoring_rules, current_matchday");
    let processed = 0;
    for (const league of (leagues ?? []) as LeagueRow[]) {
      await refreshMarket(db, league);
      processed += 1;
    }
    return NextResponse.json({ ok: true, leagues: processed });
  } catch (error) {
    return errorResponse(error);
  }
}

export const POST = GET;
