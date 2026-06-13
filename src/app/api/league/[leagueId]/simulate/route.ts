import { NextResponse } from "next/server";
import { withMember } from "@/lib/api-helpers";
import { isAdmin, simulateMatchday, ServiceError } from "@/lib/service";

export async function POST(_request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  return withMember(leagueId, async ({ db, user, league, member }) => {
    if (!isAdmin(member)) throw new ServiceError("Solo un administrador puede simular la jornada.", 403);
    const result = await simulateMatchday(db, league, user.id);
    return NextResponse.json({ ok: true, ...result });
  });
}
