import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createSessionToken, hashPassword } from "@/lib/passwords";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { username?: string; email?: string; password?: string; displayName?: string } | null;
  const username = body?.username?.trim().toLowerCase();
  const email = body?.email?.trim().toLowerCase() || null;
  const password = body?.password || "";
  const displayName = body?.displayName?.trim() || username || "";

  if (!username || !/^[a-z0-9_.-]{3,24}$/.test(username)) return NextResponse.json({ error: "El usuario debe tener entre 3 y 24 caracteres (letras, números, punto, guion)." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "La base de datos aún no está configurada." }, { status: 503 });

  const { data: user, error } = await supabase.from("fantasy_users").insert({ username, email, password_hash: hashPassword(password), display_name: displayName }).select("id, username, display_name").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Ese usuario o correo ya existe." : "No se pudo crear la cuenta." }, { status: 400 });

  const { token, tokenHash } = createSessionToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await supabase.from("fantasy_sessions").insert({ user_id: user.id, token_hash: tokenHash, expires_at: expiresAt.toISOString() });

  const response = NextResponse.json({ user: { id: user.id, username: user.username, displayName: user.display_name } });
  response.cookies.set("stratos_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
  return response;
}
