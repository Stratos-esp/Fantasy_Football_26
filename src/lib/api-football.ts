import "server-only";

export type ApiFootballPlayer = {
  player: { id: number; name: string; photo?: string; injured?: boolean };
  statistics: Array<{
    team: { id: number; name: string; logo?: string };
    games: { position?: string; rating?: string; appearences?: number };
    goals: { total?: number; assists?: number };
  }>;
};

type ApiFootballResponse<T> = {
  response: T[];
  paging: { current: number; total: number };
  errors: Record<string, string> | string[];
};

export async function fetchApiFootball<T>(path: string, params: Record<string, string>) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY no está configurada");
  const baseUrl = process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io";
  const response = await fetch(`${baseUrl}/${path}?${new URLSearchParams(params)}`, { headers: { "x-apisports-key": key }, cache: "no-store" });
  if (!response.ok) throw new Error(`API-Football respondió con ${response.status}`);
  return response.json() as Promise<ApiFootballResponse<T>>;
}
