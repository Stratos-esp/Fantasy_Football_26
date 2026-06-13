import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, type SessionUser } from "@/lib/session";
import { getLeagueAndMember, ServiceError, type LeagueRow, type MemberRow } from "@/lib/service";

export type MemberContext = {
  db: SupabaseClient;
  user: SessionUser;
  league: LeagueRow;
  member: MemberRow;
};

export function errorResponse(error: unknown) {
  if (error instanceof ServiceError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(error);
  return NextResponse.json({ error: "Error inesperado del servidor." }, { status: 500 });
}

export async function withMember(leagueId: string, handler: (context: MemberContext) => Promise<NextResponse>) {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "La base de datos no está configurada." }, { status: 503 });
  const user = await getSessionUser(db);
  if (!user) return NextResponse.json({ error: "Sesión caducada. Vuelve a entrar." }, { status: 401 });
  try {
    const { league, member } = await getLeagueAndMember(db, leagueId, user.id);
    return await handler({ db, user, league, member });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function withUser(handler: (db: SupabaseClient, user: SessionUser) => Promise<NextResponse>) {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "La base de datos no está configurada." }, { status: 503 });
  const user = await getSessionUser(db);
  if (!user) return NextResponse.json({ error: "Sesión caducada. Vuelve a entrar." }, { status: 401 });
  try {
    return await handler(db, user);
  } catch (error) {
    return errorResponse(error);
  }
}

export function checkCronAuth(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}
