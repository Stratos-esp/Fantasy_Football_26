import { NextResponse } from "next/server";
import { withMember } from "@/lib/api-helpers";
import { getLeagueState } from "@/lib/service";

export async function GET(_request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  return withMember(leagueId, async ({ db, user, league, member }) => {
    const state = await getLeagueState(db, league, member, { id: user.id, username: user.username, displayName: user.displayName });
    return NextResponse.json(state);
  });
}
