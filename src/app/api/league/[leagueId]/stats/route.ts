import { NextResponse } from "next/server";
import { withMember } from "@/lib/api-helpers";
import { getLeagueStats } from "@/lib/service";

// Récords de la liga (máximo de goles, mejor jugador-jornada, tarjetas totales,
// jornadas ganadas) para el cuadro de estadísticas generales de la vista Jornada.
export async function GET(_request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  return withMember(leagueId, async ({ db, league }) => {
    const stats = await getLeagueStats(db, league);
    return NextResponse.json(stats);
  });
}
