import "server-only";
import { fetchCurrentJornada } from "@/lib/laliga-fantasy";
import { fetchLaLigaSeason, fetchLaLigaMatchday } from "@/lib/football-data";

// Estado de la jornada en curso con DOBLE FUENTE:
//  1) LaLiga Fantasy (primaria) — da también el estado exacto de cada partido.
//  2) football-data.org (respaldo) — sigue disponible aunque LaLiga esté en
//     mantenimiento entre temporadas, e incluso adelanta la temporada nueva.
export type JornadaState = {
  week: number;
  opensAt: string | null;   // primer partido de la jornada
  closesAt: string | null;  // fin aproximado de la jornada
  allFinished: boolean;
  source: "laliga" | "football-data" | "none";
  matchCount: number;
};

export async function getJornadaState(): Promise<JornadaState> {
  // Primaria: LaLiga.
  try {
    const j = await fetchCurrentJornada();
    if (j.week && j.matches.length > 0) {
      return { week: j.week, opensAt: j.opensAt, closesAt: j.closesAt, allFinished: j.allFinished, source: "laliga", matchCount: j.matches.length };
    }
  } catch { /* pasa al respaldo */ }

  // Respaldo: football-data.org.
  try {
    const info = await fetchLaLigaSeason();
    if (info) {
      const matches = await fetchLaLigaMatchday(info.season, info.currentMatchday);
      if (matches.length > 0) {
        const times = matches.map((m) => new Date(m.utcDate).getTime()).filter(Number.isFinite).sort((a, b) => a - b);
        return {
          week: info.currentMatchday,
          opensAt: times.length ? new Date(times[0]).toISOString() : null,
          // Cierre aproximado: 2 h tras el último partido (football-data no da hora de fin).
          closesAt: times.length ? new Date(times[times.length - 1] + 2 * 3600 * 1000).toISOString() : null,
          allFinished: matches.every((m) => m.status === "FINISHED"),
          source: "football-data",
          matchCount: matches.length,
        };
      }
    }
  } catch { /* nada disponible */ }

  return { week: 0, opensAt: null, closesAt: null, allFinished: false, source: "none", matchCount: 0 };
}
