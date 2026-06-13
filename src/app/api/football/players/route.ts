import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return NextResponse.json({ error: "API_FOOTBALL_KEY no está configurada." }, { status: 503 });

  const search = request.nextUrl.searchParams.get("search")?.trim();
  const page = request.nextUrl.searchParams.get("page") || "1";
  const baseUrl = process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io";
  const params = new URLSearchParams({ league: process.env.API_FOOTBALL_LALIGA_ID || "140", season: process.env.API_FOOTBALL_SEASON || "2025", page });
  if (search && search.length >= 3) params.set("search", search);

  const response = await fetch(`${baseUrl}/players?${params}`, { headers: { "x-apisports-key": key }, next: { revalidate: 3600 } });
  if (!response.ok) return NextResponse.json({ error: "El proveedor de datos no respondió correctamente." }, { status: response.status });
  return NextResponse.json(await response.json());
}
