import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-helpers";
import { fetchPlayerProfile, fetchMarketValues } from "@/lib/laliga-fantasy";

// Ficha en vivo de un jugador desde LaLiga Fantasy: puntos por jornada,
// estadísticas de la temporada y la serie real de valor de mercado.
export async function GET(_request: Request, { params }: { params: Promise<{ externalId: string }> }) {
  const { externalId } = await params;
  const id = Number(externalId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Jugador no válido." }, { status: 400 });
  }
  return withUser(async () => {
    try {
      const [profile, marketValues] = await Promise.all([
        fetchPlayerProfile(id),
        fetchMarketValues(id).catch(() => []),
      ]);
      return NextResponse.json({ ...profile, marketValues });
    } catch {
      return NextResponse.json({ error: "No se pudo cargar la ficha del jugador." }, { status: 502 });
    }
  });
}
