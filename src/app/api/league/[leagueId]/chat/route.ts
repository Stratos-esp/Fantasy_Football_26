import { NextResponse } from "next/server";
import { withMember } from "@/lib/api-helpers";
import { ServiceError } from "@/lib/service";

export async function GET(request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const after = new URL(request.url).searchParams.get("after");
  return withMember(leagueId, async ({ db, league }) => {
    let query = db
      .from("fantasy_chat_messages")
      .select("id, body, created_at, user_id, user:fantasy_users(display_name)")
      .eq("league_id", league.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(150);
    if (after) query = query.gt("created_at", after);
    const { data, error } = await query;
    if (error) throw new ServiceError(`No se pudo cargar el chat: ${error.message}`, 500);
    const messages = ((data ?? []) as unknown as { id: string; body: string; created_at: string; user_id: string; user: { display_name: string } | null }[]).map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
      userId: row.user_id,
      displayName: row.user?.display_name ?? "—",
    }));
    return NextResponse.json({ messages });
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const body = await request.json().catch(() => null) as { body?: string } | null;
  return withMember(leagueId, async ({ db, user, league }) => {
    const text = body?.body?.trim();
    if (!text || text.length === 0 || text.length > 2000) throw new ServiceError("El mensaje debe tener entre 1 y 2000 caracteres.");
    const { error } = await db.from("fantasy_chat_messages").insert({ league_id: league.id, user_id: user.id, body: text });
    if (error) throw new ServiceError(`No se pudo enviar el mensaje: ${error.message}`, 500);
    return NextResponse.json({ ok: true });
  });
}
