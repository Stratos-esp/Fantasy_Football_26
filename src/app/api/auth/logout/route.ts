import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { hashSessionToken } from "@/lib/passwords";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("stratos_session")?.value;
  const supabase = getSupabaseAdmin();
  if (token && supabase) await supabase.from("fantasy_sessions").delete().eq("token_hash", hashSessionToken(token));
  const response = NextResponse.json({ ok: true });
  response.cookies.set("stratos_session", "", { httpOnly: true, expires: new Date(0), path: "/" });
  return response;
}
