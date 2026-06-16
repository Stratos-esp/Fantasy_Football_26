import { NextResponse } from "next/server";
import { withMember } from "@/lib/api-helpers";
import { audit, getMatchdayDetail, isAdmin, ServiceError } from "@/lib/service";

export async function GET(request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const number = Number(new URL(request.url).searchParams.get("number"));
  if (!Number.isFinite(number) || number <= 0) return NextResponse.json({ error: "Jornada no válida." }, { status: 400 });
  return withMember(leagueId, async ({ db, league }) => {
    const detail = await getMatchdayDetail(db, league, number);
    return NextResponse.json(detail);
  });
}

// El administrador fija (o quita) la hora de cierre de la jornada actual. A
// partir de ese momento no se pueden cambiar alineaciones.
export async function PUT(request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const body = await request.json().catch(() => null) as { locksAt?: string | null } | null;
  return withMember(leagueId, async ({ db, league, member, user }) => {
    if (!isAdmin(member)) throw new ServiceError("Solo un administrador puede fijar el cierre de la jornada.", 403);
    let locksAt: string | null = null;
    if (body?.locksAt) {
      const when = new Date(body.locksAt);
      if (Number.isNaN(when.getTime())) throw new ServiceError("Fecha de cierre no válida.");
      locksAt = when.toISOString();
    }
    const { error } = await db.from("fantasy_matchdays").update({ locks_at: locksAt }).eq("league_id", league.id).eq("number", league.current_matchday);
    if (error) throw new ServiceError(`No se pudo guardar el cierre: ${error.message}`, 500);
    await audit(db, league.id, user.id, "matchday_lock_set", locksAt
      ? `${member.team_name} fijó el cierre de la jornada ${league.current_matchday}`
      : `${member.team_name} quitó el cierre de la jornada ${league.current_matchday}`);
    return NextResponse.json({ ok: true });
  });
}
