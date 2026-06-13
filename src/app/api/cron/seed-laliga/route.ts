import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkCronAuth, errorResponse } from "@/lib/api-helpers";
import { seedLaLiga } from "@/lib/service";

export async function POST(request: Request) {
  if (!checkCronAuth(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "La base de datos no está configurada." }, { status: 503 });
  try {
    const season = Number(process.env.API_FOOTBALL_SEASON ?? 2025);
    const result = await seedLaLiga(db, season);
    return NextResponse.json({ ok: true, season, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
