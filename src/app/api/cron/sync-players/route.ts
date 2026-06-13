import { NextRequest, NextResponse } from "next/server";
import { ApiFootballPlayer, fetchApiFootball } from "@/lib/api-football";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const maxDuration = 60;

function fantasyPosition(position?: string) {
  if (position === "Goalkeeper") return "POR";
  if (position === "Defender") return "DEF";
  if (position === "Midfielder") return "MED";
  return "DEL";
}

function initialValue(entry: ApiFootballPlayer) {
  const stats = entry.statistics[0];
  const rating = Number(stats?.games.rating || 6);
  const appearances = stats?.games.appearences || 0;
  const goals = stats?.goals.total || 0;
  const assists = stats?.goals.assists || 0;
  return Math.round(Math.max(500_000, (rating - 5) * 2_500_000 + appearances * 80_000 + goals * 450_000 + assists * 300_000));
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado" }, { status: 503 });

  const season = Number(process.env.API_FOOTBALL_SEASON || "2025");
  const league = process.env.API_FOOTBALL_LALIGA_ID || "140";
  const page = request.nextUrl.searchParams.get("page") || "1";
  const data = await fetchApiFootball<ApiFootballPlayer>("players", { league, season: String(season), page });
  if (Array.isArray(data.errors) ? data.errors.length : Object.keys(data.errors || {}).length) return NextResponse.json({ error: data.errors }, { status: 502 });

  let synced = 0;
  for (const entry of data.response) {
    const stats = entry.statistics[0];
    if (!stats?.team?.id) continue;
    const { data: team, error: teamError } = await supabase.from("fantasy_teams").upsert({ external_id: stats.team.id, competition_external_id: Number(league), season, name: stats.team.name, badge_url: stats.team.logo }, { onConflict: "external_id,season" }).select("id").single();
    if (teamError || !team) continue;
    const value = initialValue(entry);
    const { data: existing } = await supabase
      .from("fantasy_players")
      .select("current_value, metadata")
      .eq("external_id", entry.player.id)
      .eq("season", season)
      .maybeSingle();
    const { data: player, error: playerError } = await supabase.from("fantasy_players").upsert({
      external_id: entry.player.id,
      team_id: team.id,
      season,
      name: entry.player.name,
      common_name: entry.player.name,
      position: fantasyPosition(stats.games.position),
      photo_url: entry.player.photo,
      status: entry.player.injured ? "injured" : "available",
      current_value: existing ? Number(existing.current_value) : value,
      metadata: {
        ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
        provider: "api-football",
        appearances: stats.games.appearences,
        rating: stats.games.rating,
        baseValue: (existing?.metadata as Record<string, unknown> | null)?.baseValue ?? value,
      },
    }, { onConflict: "external_id,season" }).select("id").single();
    if (playerError || !player) continue;
    await supabase.from("fantasy_player_values").insert({ player_id: player.id, value: existing ? Number(existing.current_value) : value });
    synced += 1;
  }

  return NextResponse.json({ synced, page: data.paging.current, totalPages: data.paging.total, nextPage: data.paging.current < data.paging.total ? data.paging.current + 1 : null });
}
