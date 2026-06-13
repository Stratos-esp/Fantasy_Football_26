import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-helpers";
import { joinLeague } from "@/lib/service";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { inviteCode?: string; teamName?: string } | null;
  return withUser(async (db, user) => {
    const league = await joinLeague(db, user.id, body?.inviteCode ?? "", body?.teamName ?? "");
    return NextResponse.json({ leagueId: league.id });
  });
}
