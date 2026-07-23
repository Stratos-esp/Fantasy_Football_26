import "server-only";

// Segunda fuente (respaldo) de calendario y resultados de LaLiga vía
// football-data.org. Plan gratuito: ~10 req/min, competición PD (Primera
// División). Da fixtures con fecha, estado y marcador — NO estadísticas por
// jugador (para eso solo sirve la API de LaLiga). Configurar FOOTBALL_DATA_TOKEN.
const BASE = "https://api.football-data.org/v4";
const COMPETITION = "PD";

function fdToken(): string | null {
  return process.env.FOOTBALL_DATA_TOKEN ?? null;
}

async function fdFetch(path: string) {
  const token = fdToken();
  if (!token) throw new Error("FOOTBALL_DATA_TOKEN no configurado");
  const res = await fetch(`${BASE}${path}`, { headers: { "X-Auth-Token": token }, cache: "no-store" });
  if (!res.ok) throw new Error(`football-data ${res.status}`);
  return res.json();
}

export type FdMatch = {
  utcDate: string;
  status: string; // SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED | POSTPONED ...
  matchday: number;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
};

// Temporada en curso de LaLiga (año de inicio y jornada actual).
export async function fetchLaLigaSeason(): Promise<{ season: number; currentMatchday: number; startDate: string } | null> {
  if (!fdToken()) return null;
  const j = (await fdFetch(`/competitions/${COMPETITION}`)) as { currentSeason?: { startDate?: string; currentMatchday?: number } };
  const cs = j.currentSeason;
  if (!cs?.startDate) return null;
  return { season: new Date(cs.startDate).getFullYear(), currentMatchday: Number(cs.currentMatchday ?? 1), startDate: cs.startDate };
}

// Partidos de una jornada concreta (respaldo de calendario/resultados).
export async function fetchLaLigaMatchday(season: number, matchday: number): Promise<FdMatch[]> {
  if (!fdToken()) return [];
  const j = (await fdFetch(`/competitions/${COMPETITION}/matches?season=${season}&matchday=${matchday}`)) as { matches?: Record<string, unknown>[] };
  return (j.matches ?? []).map((m) => {
    const home = (m.homeTeam ?? {}) as Record<string, unknown>;
    const away = (m.awayTeam ?? {}) as Record<string, unknown>;
    const score = ((m.score ?? {}) as Record<string, unknown>).fullTime as Record<string, unknown> | undefined;
    return {
      utcDate: String(m.utcDate ?? ""),
      status: String(m.status ?? ""),
      matchday: Number(m.matchday ?? matchday),
      homeName: String(home.name ?? ""),
      awayName: String(away.name ?? ""),
      homeScore: score?.home == null ? null : Number(score.home),
      awayScore: score?.away == null ? null : Number(score.away),
    };
  });
}
