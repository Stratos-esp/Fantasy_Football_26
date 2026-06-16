"use client";

import { repairTextEncoding, repairTextTree } from "@/lib/text-encoding";

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
    if (!response.ok) return { ok: false, error: repairTextEncoding((data as { error?: string }).error ?? "Error de red"), status: response.status };
    return { ok: true, data: repairTextTree(data) as T };
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
    if (!response.ok) return { ok: false, error: repairTextEncoding((data as { error?: string }).error ?? "Error de red"), status: response.status };
    return { ok: true, data: repairTextTree(data) as T };
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

// Reparte `n` jugadores centrados en una línea. El ancho ocupado crece con el
// número de jugadores (en vez de ocupar siempre todo el campo), así las líneas
// cortas —p. ej. los 2 delanteros de un 4-4-2— quedan centradas y no en los
// extremos. `gap` es la separación entre jugadores y `maxSpread` el ancho tope.
function spreadLine(n: number, center: number, gap: number, maxSpread: number): number[] {
  if (n <= 1) return [center];
  const spread = Math.min(maxSpread, gap * (n - 1));
  const start = center - spread / 2;
  return Array.from({ length: n }, (_, i) => start + (spread * i) / (n - 1));
}

export function pitchCoordinates(formation: string, orientation: "horizontal" | "vertical" = "horizontal"): { left: number; top: number }[] {
  const shape = formation.split("-").map(Number);
  const [def, med, del] = shape.length === 3 ? shape : [4, 4, 2];
  if (orientation === "vertical") {
    const lines: { count: number; top: number }[] = [
      { count: 1, top: 88 },
      { count: def, top: 66 },
      { count: med, top: 43 },
      { count: del, top: 18 },
    ];
    const coordinates: { left: number; top: number }[] = [];
    for (const line of lines) {
      for (const left of spreadLine(line.count, 50, 24, 72)) {
        coordinates.push({ left, top: line.top });
      }
    }
    return coordinates;
  }
  // Campo apaisado: portero a la izquierda, líneas avanzando hacia la derecha.
  const columns: { count: number; left: number }[] = [
    { count: 1, left: 8 },
    { count: def, left: 30 },
    { count: med, left: 54 },
    { count: del, left: 80 },
  ];
  const coordinates: { left: number; top: number }[] = [];
  for (const column of columns) {
    for (const top of spreadLine(column.count, 50, 26, 76)) {
      coordinates.push({ left: column.left, top });
    }
  }
  return coordinates;
}
