"use client";

export function money(value: number) {
  return `${(value / 1_000_000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} M€`;
}

export function moneyInput(raw: string): number | null {
  const value = Number(raw.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 1_000_000);
}

export function timeAgo(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "ahora";
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)} h`;
  return `hace ${Math.floor(seconds / 86400)} d`;
}

export function countdown(iso: string | null) {
  if (!iso) return "Sin cierre";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Cerrando...";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

export async function apiGet<T>(url: string): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: (data as { error?: string }).error ?? "Error de red", status: response.status };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "No hay conexión con el servidor.", status: 0 };
  }
}

export async function apiPost<T>(url: string, body?: unknown, method: "POST" | "PUT" = "POST"): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: (data as { error?: string }).error ?? "Error de red", status: response.status };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "No hay conexión con el servidor.", status: 0 };
  }
}

export const positionOrder: Record<string, number> = { POR: 0, DEF: 1, MED: 2, DEL: 3 };

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Nombre y apellido para las etiquetas: "José María Giménez" -> "José Giménez".
export function nameAndSurname(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export function pitchCoordinates(formation: string): { left: number; top: number }[] {
  const shape = formation.split("-").map(Number);
  const [def, med, del] = shape.length === 3 ? shape : [4, 4, 2];
  const rows: { count: number; top: number }[] = [
    { count: 1, top: 90 },
    { count: def, top: 68 },
    { count: med, top: 44 },
    { count: del, top: 17 },
  ];
  const coordinates: { left: number; top: number }[] = [];
  for (const row of rows) {
    for (let i = 0; i < row.count; i += 1) {
      coordinates.push({ left: ((i + 1) * 100) / (row.count + 1), top: row.top });
    }
  }
  return coordinates;
}
