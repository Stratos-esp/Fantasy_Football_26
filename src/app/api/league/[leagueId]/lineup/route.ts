import { NextResponse } from "next/server";
import { withMember } from "@/lib/api-helpers";
import { leagueSettings, ServiceError } from "@/lib/service";
import { formations } from "@/lib/types";

type Payload = { formation?: string; starters?: string[]; bench?: string[]; captainPlayerId?: string | null };

export async function PUT(request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const body = await request.json().catch(() => null) as Payload | null;
  return withMember(leagueId, async ({ db, league, member }) => {
    const formation = body?.formation ?? "4-4-2";
    const shape = formations[formation];
    if (!shape) throw new ServiceError("Formación no válida.");
    const starters = body?.starters ?? [];
    const bench = body?.bench ?? [];
    const settings = leagueSettings(league);
    if (starters.length > 11) throw new ServiceError("No puedes alinear más de 11 titulares.");
    if (new Set([...starters, ...bench]).size !== starters.length + bench.length) throw new ServiceError("Hay jugadores repetidos en la alineación.");
    if (bench.length > settings.benchSlots) throw new ServiceError(`El banquillo admite como máximo ${settings.benchSlots} jugadores.`);

    const { data: squadRows } = await db.from("fantasy_squads").select("player_id").eq("league_member_id", member.id);
    const owned = new Set((squadRows ?? []).map((row) => row.player_id as string));
    for (const id of [...starters, ...bench]) {
      if (!owned.has(id)) throw new ServiceError("Solo puedes alinear jugadores de tu plantilla.");
    }

    // Se permite guardar con menos de 11: cada hueco vacío puntuará la
    // penalización configurada. Solo validamos que no se exceda la formación.
    const { data: playerRows } = await db.from("fantasy_players").select("id, position").in("id", starters.length > 0 ? starters : ["00000000-0000-0000-0000-000000000000"]);
    const counts: Record<string, number> = { POR: 0, DEF: 0, MED: 0, DEL: 0 };
    for (const row of playerRows ?? []) counts[row.position as string] += 1;
    if (counts.POR > 1 || counts.DEF > shape.DEF || counts.MED > shape.MED || counts.DEL > shape.DEL) {
      throw new ServiceError(`La formación ${formation} admite como máximo 1 POR, ${shape.DEF} DEF, ${shape.MED} MED y ${shape.DEL} DEL.`);
    }

    const captain = body?.captainPlayerId ?? null;
    if (captain && !starters.includes(captain)) throw new ServiceError("El capitán debe ser titular.");

    const { data: matchday } = await db.from("fantasy_matchdays").select("id, status, locks_at").eq("league_id", league.id).eq("number", league.current_matchday).maybeSingle();
    if (!matchday || matchday.status === "finished") throw new ServiceError("La temporada ha terminado: no hay jornada activa.");
    if (matchday.locks_at && new Date(matchday.locks_at as string).getTime() <= Date.now()) throw new ServiceError("La alineación ya está cerrada para esta jornada.");

    const { data: lineup, error } = await db.from("fantasy_lineups").upsert({
      matchday_id: matchday.id,
      league_member_id: member.id,
      formation,
      captain_player_id: captain,
      submitted_at: new Date().toISOString(),
    }, { onConflict: "matchday_id,league_member_id" }).select("id").single();
    if (error || !lineup) throw new ServiceError("No se pudo guardar la alineación.", 500);

    await db.from("fantasy_lineup_players").delete().eq("lineup_id", lineup.id);
    const rows = [
      ...starters.map((playerId, index) => ({ lineup_id: lineup.id, player_id: playerId, slot: index + 1, is_starter: true, bench_order: null as number | null })),
      ...bench.map((playerId, index) => ({ lineup_id: lineup.id, player_id: playerId, slot: 12 + index, is_starter: false, bench_order: index + 1 })),
    ];
    const { error: insertError } = await db.from("fantasy_lineup_players").insert(rows);
    if (insertError) throw new ServiceError(`No se pudo guardar la alineación: ${insertError.message}`, 500);
    return NextResponse.json({ ok: true });
  });
}
