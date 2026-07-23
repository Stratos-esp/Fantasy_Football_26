import { NextResponse } from "next/server";
import { withMember } from "@/lib/api-helpers";
import { isAdmin, recomputeMatchday, ServiceError } from "@/lib/service";

// Punto 6: el admin recalcula una jornada ya disputada (p. ej. tras un partido
// aplazado). Re-sincroniza y recomputa puntos + clasificación de esa jornada.
export async function POST(request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const body = (await request.json().catch(() => null)) as { matchday?: number } | null;
  const number = Number(body?.matchday);
  if (!Number.isFinite(number) || number <= 0) {
    return NextResponse.json({ error: "Jornada no válida." }, { status: 400 });
  }
  return withMember(leagueId, async ({ db, league, member, user }) => {
    if (!isAdmin(member)) throw new ServiceError("Solo un administrador puede recalcular una jornada.", 403);
    const result = await recomputeMatchday(db, league, number, user.id);
    return NextResponse.json({ ok: true, ...result });
  });
}
