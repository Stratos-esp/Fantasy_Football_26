import { NextResponse } from "next/server";
import { withMember } from "@/lib/api-helpers";

// Detalle de un jugador: valor actual, histórico de precios, puntos por jornada y propietario en la liga.
export async function GET(_request: Request, { params }: { params: Promise<{ leagueId: string; playerId: string }> }) {
  const { leagueId, playerId } = await params;
  return withMember(leagueId, async ({ db, league }) => {
    const { data: player } = await db
      .from("fantasy_players")
      .select("id, name, position, current_value, status, photo_url, metadata, team:fantasy_teams(name, short_name, badge_url, external_id, colors)")
      .eq("id", playerId)
      .maybeSingle();
    if (!player) return NextResponse.json({ error: "Jugador no encontrado." }, { status: 404 });

    const team = player.team as unknown as { name: string; short_name: string | null; badge_url: string | null; external_id: number | null; colors: unknown } | null;

    const { data: priceRows } = await db
      .from("fantasy_player_values")
      .select("value, recorded_at")
      .eq("player_id", playerId)
      .order("recorded_at", { ascending: true })
      .limit(60);

    const { data: scoreRows } = await db
      .from("fantasy_player_scores")
      .select("points, breakdown, matchday:fantasy_matchdays(number)")
      .eq("player_id", playerId)
      .eq("league_id", league.id)
      .order("updated_at", { ascending: true })
      .limit(60);

    const { data: members } = await db.from("fantasy_league_members").select("id, team_name").eq("league_id", league.id);
    const memberIds = (members ?? []).map((m) => m.id);
    const { data: ownerRow } = memberIds.length > 0
      ? await db.from("fantasy_squads").select("league_member_id, clause_value, purchase_price").eq("player_id", playerId).in("league_member_id", memberIds).maybeSingle()
      : { data: null };
    const owner = ownerRow ? (members ?? []).find((m) => m.id === ownerRow.league_member_id) : null;

    const baseValue = Number((player.metadata as Record<string, unknown> | null)?.baseValue ?? player.current_value);
    const colors = Array.isArray(team?.colors) ? (team?.colors as string[]) : [];

    return NextResponse.json({
      id: player.id,
      name: player.name,
      position: player.position,
      status: player.status,
      value: Number(player.current_value),
      baseValue,
      photo: player.photo_url ?? null,
      team: team?.name ?? "—",
      teamShort: team?.short_name ?? "?",
      teamColor: colors[0] ?? "#3b6c4f",
      teamLogo: team?.badge_url ?? (team?.external_id ? `https://media.api-sports.io/football/teams/${team.external_id}.png` : null),
      priceHistory: (priceRows ?? []).map((row) => ({ value: Number(row.value), at: row.recorded_at as string })),
      pointsHistory: ((scoreRows ?? []) as unknown as { points: number; breakdown: Record<string, unknown>; matchday: { number: number } | null }[]).map((row) => ({
        matchday: row.matchday?.number ?? 0,
        points: Number(row.points),
        breakdown: row.breakdown ?? {},
      })),
      owner: owner ? { memberId: owner.id, teamName: owner.team_name, clauseValue: ownerRow?.clause_value === null ? null : Number(ownerRow?.clause_value), purchasePrice: Number(ownerRow?.purchase_price ?? 0) } : null,
    });
  });
}
