import { NextResponse } from "next/server";
import { withMember } from "@/lib/api-helpers";
import { audit, ServiceError } from "@/lib/service";

type Payload = { teamName?: string };

export async function PUT(request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const body = await request.json().catch(() => null) as Payload | null;
  return withMember(leagueId, async ({ db, user, league, member }) => {
    const teamName = body?.teamName?.trim().replace(/\s+/g, " ") ?? "";
    if (teamName.length < 3 || teamName.length > 32) {
      throw new ServiceError("El nombre del equipo debe tener entre 3 y 32 caracteres.");
    }
    if (teamName === member.team_name) return NextResponse.json({ ok: true, teamName });

    const { error } = await db
      .from("fantasy_league_members")
      .update({ team_name: teamName })
      .eq("id", member.id)
      .eq("league_id", league.id);
    if (error?.code === "23505") throw new ServiceError("Ya hay un equipo con ese nombre en la liga.");
    if (error) throw new ServiceError(`No se pudo cambiar el nombre del equipo: ${error.message}`, 500);

    await audit(db, league.id, user.id, "team_renamed", `${member.team_name} ahora se llama ${teamName}`);
    return NextResponse.json({ ok: true, teamName });
  });
}
