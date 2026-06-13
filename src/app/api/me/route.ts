import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-helpers";

export async function GET() {
  return withUser(async (db, user) => {
    const { data } = await db
      .from("fantasy_league_members")
      .select("league_id, team_name, role, league:fantasy_leagues(name)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true });
    const memberships = ((data ?? []) as unknown as { league_id: string; team_name: string; role: string; league: { name: string } | null }[]).map((row) => ({
      leagueId: row.league_id,
      leagueName: row.league?.name ?? "Liga",
      teamName: row.team_name,
      role: row.role,
    }));
    return NextResponse.json({ user, memberships });
  });
}
