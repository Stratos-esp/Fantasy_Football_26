import { NextResponse } from "next/server";
import { withMember } from "@/lib/api-helpers";
import { isAdmin, resetLeague, ServiceError } from "@/lib/service";

export async function POST(_request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  return withMember(leagueId, async ({ db, user, league, member }) => {
    if (!isAdmin(member)) throw new ServiceError("Solo un administrador puede reiniciar la liga.", 403);
    const result = await resetLeague(db, league, user.id);
    return NextResponse.json({ ok: true, ...result });
  });
}
