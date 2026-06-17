import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-helpers";

// Guardar (o quitar) la foto de perfil del usuario. Se recibe un data URL ya
// recortado y reducido por el cliente; limitamos el tamaño para no inflar la BD.
export async function PUT(request: Request) {
  const body = await request.json().catch(() => null) as { avatarUrl?: string | null } | null;
  return withUser(async (db, user) => {
    let avatarUrl: string | null = null;
    if (body?.avatarUrl) {
      if (typeof body.avatarUrl !== "string" || !body.avatarUrl.startsWith("data:image/")) {
        return NextResponse.json({ error: "Imagen no válida." }, { status: 400 });
      }
      if (body.avatarUrl.length > 300_000) {
        return NextResponse.json({ error: "La imagen es demasiado grande." }, { status: 400 });
      }
      avatarUrl = body.avatarUrl;
    }
    const { error } = await db.from("fantasy_users").update({ avatar_url: avatarUrl }).eq("id", user.id);
    if (error) return NextResponse.json({ error: "No se pudo guardar la foto." }, { status: 500 });
    return NextResponse.json({ ok: true });
  });
}

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
