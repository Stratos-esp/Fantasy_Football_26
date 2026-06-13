import { NextResponse } from "next/server";
import { withMember } from "@/lib/api-helpers";
import { audit, isAdmin, ServiceError } from "@/lib/service";
import { parseLeagueSettings } from "@/lib/types";

export async function PUT(request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const body = await request.json().catch(() => null) as { settings?: unknown } | null;
  return withMember(leagueId, async ({ db, user, league, member }) => {
    if (!isAdmin(member)) throw new ServiceError("Solo un administrador puede cambiar las reglas.", 403);
    const settings = parseLeagueSettings(body?.settings);
    const { error } = await db.from("fantasy_leagues").update({ settings }).eq("id", league.id);
    if (error) throw new ServiceError(`No se pudieron guardar los ajustes: ${error.message}`, 500);
    await audit(db, league.id, user.id, "settings_updated", `${member.team_name} actualizó las reglas de la liga`);
    return NextResponse.json({ ok: true, settings });
  });
}
