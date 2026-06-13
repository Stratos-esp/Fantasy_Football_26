import { NextResponse } from "next/server";
import { withMember } from "@/lib/api-helpers";
import { isAdmin, simulateMatchday, ServiceError } from "@/lib/service";

export async function POST(request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const body = await request.json().catch(() => null) as { count?: number } | null;
  return withMember(leagueId, async ({ db, user, league, member }) => {
    if (!isAdmin(member)) throw new ServiceError("Solo un administrador puede simular jornadas.", 403);
    const count = Math.min(38, Math.max(1, Math.round(Number(body?.count ?? 1))));
    let current = league;
    let played = 0;
    const lastNumbers: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const { data: refreshed } = await db.from("fantasy_leagues").select("id, owner_id, name, invite_code, season, starting_budget, squad_size, settings, scoring_rules, current_matchday").eq("id", league.id).single();
      if (!refreshed) break;
      current = refreshed;
      if (current.current_matchday > 38) break;
      try {
        const result = await simulateMatchday(db, current, user.id);
        lastNumbers.push(result.matchday);
        played += 1;
      } catch {
        break; // temporada completada o sin jornada activa
      }
    }
    if (played === 0) throw new ServiceError("No quedan jornadas por disputar. Reinicia la liga para empezar otra temporada.");
    return NextResponse.json({ ok: true, played, jornadas: lastNumbers });
  });
}
