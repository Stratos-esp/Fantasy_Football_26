import "server-only";
import type { Position } from "@/lib/types";

// Cliente de la API pública de LaLiga Fantasy. El token de /dsp/v3/token es de
// aplicación (no requiere login) y dura ~1 h; lo cacheamos en memoria del proceso.
const BASE = "https://api-fantasy.llt-services.com";
const COMMON_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
  Origin: "https://fantasy.laliga.com",
  Referer: "https://fantasy.laliga.com/",
  "x-lang": "es",
};

let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getLaLigaToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const response = await fetch(`${BASE}/dsp/v3/token`, { headers: COMMON_HEADERS, cache: "no-store" });
  if (!response.ok) throw new Error(`No se pudo obtener el token de LaLiga (${response.status})`);
  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3000) * 1000 };
  return cachedToken.value;
}

async function authedFetch(path: string) {
  const token = await getLaLigaToken();
  const response = await fetch(`${BASE}${path}`, {
    headers: { ...COMMON_HEADERS, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`LaLiga API ${path} → ${response.status}`);
  return response.json();
}

export type RealPlayer = {
  externalId: number;
  name: string;
  position: Position;
  teamExternalId: number;
  teamName: string;
  teamBadge: string | null;
  photo: string | null;
  weekPoints: Map<number, number>; // jornada → puntos
  playerMasterStatusId?: number;   // estado actual (0=ok, 2=lesionado, 3=sancionado)
};

type RawPlayer = {
  id: number;
  name: string;
  nickname?: string;
  positionId: number;
  teamId: number;
  weekPoints?: number;
  images?: { transparent?: Record<string, string> };
  // Estado del jugador: 0=disponible, 1=duda, 2=lesionado, 3=sancionado (varía según versión de API)
  playerMasterStatusId?: number;
  // Tarjetas acumuladas en la temporada (para detectar sanción por acumulación)
  sanctions?: { yellowCards?: number; redCard?: boolean };
};

type RawTeam = { id: number; mainName: string; badgeColor?: string; players: RawPlayer[] };
type RawMatch = { id: number; local: RawTeam; visitor: RawTeam };

const POSITION_BY_ID: Record<number, Position | null> = { 1: "POR", 2: "DEF", 3: "MED", 4: "DEL", 5: null };

function photoFrom(player: RawPlayer): string | null {
  const transparent = player.images?.transparent;
  if (!transparent) return null;
  return transparent["256x256"] ?? Object.values(transparent)[0] ?? null;
}

export async function fetchWeek(week: number): Promise<RawMatch[]> {
  return (await authedFetch(`/stats/v1/stats/week/${week}`)) as RawMatch[];
}

// Recorre un rango de jornadas y construye el maestro de jugadores con sus puntos reales.
export async function fetchSeason(fromWeek: number, toWeek: number): Promise<RealPlayer[]> {
  const players = new Map<number, RealPlayer>();
  for (let week = fromWeek; week <= toWeek; week += 1) {
    let matches: RawMatch[];
    try {
      matches = await fetchWeek(week);
    } catch {
      continue; // jornada no disponible todavía
    }
    for (const match of matches) {
      for (const team of [match.local, match.visitor]) {
        if (!team?.players) continue;
        for (const raw of team.players) {
          const position = POSITION_BY_ID[raw.positionId];
          if (!position) continue; // entrenadores u otros
          let entry = players.get(raw.id);
          if (!entry) {
            entry = {
              externalId: raw.id,
              name: raw.nickname?.trim() || raw.name,
              position,
              teamExternalId: team.id,
              teamName: team.mainName,
              teamBadge: team.badgeColor ?? null,
              photo: photoFrom(raw),
              weekPoints: new Map(),
            };
            players.set(raw.id, entry);
          }
          // Mantén el equipo más reciente y la foto si aparece.
          entry.teamExternalId = team.id;
          entry.teamName = team.mainName;
          entry.teamBadge = team.badgeColor ?? entry.teamBadge;
          entry.photo = photoFrom(raw) ?? entry.photo;
          if (typeof raw.weekPoints === "number") entry.weekPoints.set(week, raw.weekPoints);
          // Captura el estado más reciente del jugador si la API lo proporciona
          if (raw.playerMasterStatusId !== undefined) entry.playerMasterStatusId = raw.playerMasterStatusId;
        }
      }
    }
  }
  return [...players.values()];
}

export async function currentWeek(): Promise<number> {
  const data = (await authedFetch(`/api/v3/week/current`)) as { weekNumber?: number };
  return data.weekNumber ?? 38;
}

// --- Ficha individual: puntos por jornada, estadísticas y valor de mercado real ---

export type PlayerWeekStat = { week: number; points: number };
export type PlayerStatTotals = {
  matches: number; goals: number; assists: number; minutes: number; saves: number; yellow: number; red: number;
};
export type PlayerProfile = {
  externalId: number;
  name: string;
  teamName: string | null;
  position: Position | null;
  marketValue: number;
  photo: string | null;
  weekStats: PlayerWeekStat[];
  totals: PlayerStatTotals;
};

type RawPlayerStat = { stats?: Record<string, unknown[]>; weekNumber: number; totalPoints?: number };
type RawPlayerFull = RawPlayer & {
  marketValue?: number;
  team?: { name?: string; mainName?: string } | null;
  playerStats?: RawPlayerStat[];
};

export async function fetchPlayerProfile(externalId: number): Promise<PlayerProfile> {
  const raw = (await authedFetch(`/api/v3/player/${externalId}`)) as RawPlayerFull;
  const playerStats = Array.isArray(raw.playerStats) ? raw.playerStats : [];
  const weekStats = playerStats
    .map((s) => ({ week: s.weekNumber, points: Number(s.totalPoints ?? 0) }))
    .sort((a, b) => a.week - b.week);
  const sum = (key: string) =>
    playerStats.reduce((acc, s) => acc + (Array.isArray(s.stats?.[key]) ? Number(s.stats![key][0] ?? 0) : 0), 0);
  const matches = playerStats.filter(
    (s) => Array.isArray(s.stats?.mins_played) && Number(s.stats!.mins_played[0]) > 0,
  ).length;
  return {
    externalId: raw.id,
    name: raw.nickname?.trim() || raw.name,
    teamName: raw.team?.name ?? raw.team?.mainName ?? null,
    position: POSITION_BY_ID[raw.positionId] ?? null,
    marketValue: Number(raw.marketValue ?? 0),
    photo: photoFrom(raw),
    weekStats,
    totals: {
      matches,
      goals: sum("goals"),
      assists: sum("goal_assist"),
      minutes: sum("mins_played"),
      saves: sum("saves"),
      yellow: sum("yellow_card"),
      red: sum("red_card"),
    },
  };
}

// Serie histórica de valor de mercado (submuestreada a ~60 puntos para el gráfico).
export async function fetchMarketValues(externalId: number): Promise<{ date: string; value: number }[]> {
  const raw = (await authedFetch(`/api/v3/player/${externalId}/market-value`)) as { date: string; marketValue: number }[];
  const series = (Array.isArray(raw) ? raw : []).map((r) => ({ date: r.date, value: Number(r.marketValue) }));
  if (series.length <= 60) return series;
  const step = Math.ceil(series.length / 60);
  const out = series.filter((_, i) => i % step === 0);
  const last = series[series.length - 1];
  if (out[out.length - 1]?.date !== last.date) out.push(last);
  return out;
}
