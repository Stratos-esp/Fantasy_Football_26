import { NextResponse } from "next/server";
import { withMember } from "@/lib/api-helpers";

// Marca como leídas las notificaciones del usuario en esta liga.
export async function POST(_request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  return withMember(leagueId, async ({ db, user, league }) => {
    await db.from("fantasy_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).eq("league_id", league.id).is("read_at", null);
    return NextResponse.json({ ok: true });
  });
}
