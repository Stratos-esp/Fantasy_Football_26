import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkCronAuth } from "@/lib/api-helpers";

export const maxDuration = 300;

// Copia de seguridad mensual: vuelca el histórico completo a un JSON en el
// bucket privado "backups" de Supabase Storage. Vercel lo invoca el día 1 de
// cada mes (ver vercel.json). Protegido con CRON_SECRET.
const TABLES = [
  "fantasy_leagues",
  "fantasy_league_members",
  "fantasy_users",
  "fantasy_teams",
  "fantasy_players",
  "fantasy_matchdays",
  "fantasy_lineups",
  "fantasy_lineup_players",
  "fantasy_player_scores",
  "fantasy_player_week_points",
  "fantasy_standings_history",
  "fantasy_squad_history",
  "fantasy_squads",
  "fantasy_transfers",
  "fantasy_market_listings",
  "fantasy_bids",
  "fantasy_direct_offers",
  "fantasy_player_values",
  "fantasy_rule_proposals",
  "fantasy_rule_votes",
  "fantasy_audit_log",
  "fantasy_notifications",
  "fantasy_chat_messages",
];

async function runBackup(request: Request) {
  if (!checkCronAuth(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "La base de datos no está configurada." }, { status: 503 });

  const dump: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const table of TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(table).select("*").range(from, from + 999);
      if (error) break;
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    dump[table] = rows;
    counts[table] = rows.length;
  }

  const now = new Date();
  const path = `${now.getUTCFullYear()}/backup-${now.toISOString().slice(0, 10)}-${now.getTime()}.json`;
  const body = Buffer.from(JSON.stringify({ generatedAt: now.toISOString(), counts, data: dump }));

  const { error: upErr } = await db.storage.from("backups").upload(path, body, {
    contentType: "application/json",
    upsert: true,
  });
  if (upErr) {
    return NextResponse.json({ error: `No se pudo subir el backup: ${upErr.message}`, counts }, { status: 500 });
  }
  return NextResponse.json({ ok: true, path, counts });
}

export async function GET(request: Request) {
  return runBackup(request);
}

export async function POST(request: Request) {
  return runBackup(request);
}
