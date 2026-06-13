import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-helpers";
import { createLeague } from "@/lib/service";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { name?: string; teamName?: string } | null;
  return withUser(async (db, user) => {
    const league = await createLeague(db, user.id, body?.name ?? "", body?.teamName ?? "");
    return NextResponse.json({ leagueId: league.id, inviteCode: league.invite_code });
  });
}
