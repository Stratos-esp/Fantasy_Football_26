import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-helpers";

// Catálogo global de jugadores de LaLiga (independiente de la liga del usuario):
// identidad, valor actual, puntos de la temporada y forma (últimas 5 jornadas reales).
export async function GET() {
  return withUser(async (db) => {
    const { data: rows } = await db
      .from("fantasy_players")
      .select("id, external_id, name, position, photo_url, current_value, metadata, team:fantasy_teams(name, short_name, badge_url, external_id, colors)")
      .order("current_value", { ascending: false })
      .limit(1000);
    const players = rows ?? [];

    const { data: maxRow } = await db
      .from("fantasy_player_week_points")
      .select("week")
      .order("week", { ascending: false })
      .limit(1)
      .maybeSingle();
    const maxWeek = Number(maxRow?.week ?? 0);
    const fromWeek = Math.max(1, maxWeek - 4);

    const last5Map = new Map<string, { week: number; points: number }[]>();
    if (maxWeek > 0) {
      const { data: wp } = await db
        .from("fantasy_player_week_points")
        .select("player_id, week, points")
        .gte("week", fromWeek)
        .lte("week", maxWeek)
        .limit(20000);
      for (const r of wp ?? []) {
        const arr = last5Map.get(r.player_id as string) ?? [];
        arr.push({ week: Number(r.week), points: Number(r.points) });
        last5Map.set(r.player_id as string, arr);
      }
    }

    return NextResponse.json({
      maxWeek,
      players: players.map((p) => {
        const team = p.team as unknown as { name?: string; short_name?: string; badge_url?: string; external_id?: number; colors?: unknown } | null;
        const colors = Array.isArray(team?.colors) ? (team!.colors as string[]) : [];
        const last5 = (last5Map.get(p.id as string) ?? []).sort((a, b) => a.week - b.week).map((x) => x.points);
        const meta = (p.metadata as Record<string, unknown> | null) ?? {};
        return {
          id: p.id,
          externalId: p.external_id,
          name: p.name,
          position: p.position,
          team: team?.name ?? "—",
          teamShort: team?.short_name ?? "?",
          teamColor: colors[0] ?? "#3b6c4f",
          teamLogo: team?.badge_url ?? (team?.external_id ? `https://media.api-sports.io/football/teams/${team.external_id}.png` : null),
          photo: p.photo_url ?? null,
          value: Number(p.current_value),
          seasonPoints: Number(meta.seasonPoints ?? 0),
          last5,
        };
      }),
    });
  });
}
