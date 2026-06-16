"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { apiGet, initials, money } from "@/lib/client";
import { PositionTag, TeamBadge } from "@/components/ui";

export type PlayerDetail = {
  id: string;
  name: string;
  position: string;
  status: string;
  value: number;
  baseValue: number;
  photo: string | null;
  team: string;
  teamShort: string;
  teamColor: string;
  teamLogo: string | null;
  priceHistory: { value: number; at: string }[];
  pointsHistory: { matchday: number; points: number; breakdown: Record<string, number> }[];
  owner: { memberId: string; teamName: string; clauseValue: number | null; purchasePrice: number } | null;
};

export type PlayerAction = { label: string; onClick: () => void; tone?: "primary" | "danger" | "ghost"; disabled?: boolean };

function sparkDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

export function Sparkline({ points, dates }: { points: number[]; dates?: string[] }) {
  const [active, setActive] = useState<number | null>(null);
  if (points.length < 2) return <div className="spark-empty">Aún no hay histórico de precios. Se registrará tras cada jornada.</div>;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 280;
  const h = 70;
  const pad = 6;
  const step = w / (points.length - 1);
  const coords = points.map((value, index) => [index * step, h - ((value - min) / range) * (h - 2 * pad) - pad] as const);
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;
  const up = points[points.length - 1] >= points[0];
  const color = up ? "var(--positive)" : "var(--danger)";

  function track(clientX: number, target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setActive(Math.round(frac * (points.length - 1)));
  }

  const activeLeft = active === null ? 0 : (active / (points.length - 1)) * 100;

  return (
    <div className="sparkline-wrap">
      <div
        className="sparkline-plot"
        onPointerDown={(e) => track(e.clientX, e.currentTarget)}
        onPointerMove={(e) => track(e.clientX, e.currentTarget)}
        onPointerLeave={() => setActive(null)}
      >
        <svg viewBox={`0 0 ${w} ${h}`} className="sparkline" preserveAspectRatio="none">
          <path d={area} fill={color} opacity="0.12" />
          <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {active !== null && <line className="spark-cursor" x1={coords[active][0]} y1="0" x2={coords[active][0]} y2={h} />}
          {coords.map(([x, y], i) => i === coords.length - 1 && active === null && <circle key={i} cx={x} cy={y} r="3" fill={color} />)}
          {active !== null && <circle cx={coords[active][0]} cy={coords[active][1]} r="3.5" fill={color} stroke="var(--surface)" strokeWidth="1.5" />}
        </svg>
        <span className="spark-axis-y spark-axis-max">{money(max)}</span>
        <span className="spark-axis-y spark-axis-min">{money(min)}</span>
        {active !== null && (
          <div className="spark-tooltip" style={{ left: `${activeLeft}%` }}>
            <strong>{money(points[active])}</strong>
            {dates && dates[active] && <small>{sparkDate(dates[active])}</small>}
          </div>
        )}
      </div>
      <div className="spark-axis-x">
        <span>{dates && dates[0] ? sparkDate(dates[0]) : "Inicio"}</span>
        <span className="spark-axis-hint">Toca la gráfica para ver el valor</span>
        <span>{dates && dates[dates.length - 1] ? sparkDate(dates[dates.length - 1]) : "Ahora"}</span>
      </div>
    </div>
  );
}

export function PlayerModal({ leagueId, playerId, actions = [], onClose }: { leagueId: string; playerId: string; actions?: PlayerAction[]; onClose: () => void }) {
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiGet<PlayerDetail>(`/api/league/${leagueId}/player/${playerId}`).then((result) => {
      if (!active) return;
      if (result.ok) setDetail(result.data);
      else setError(result.error);
    });
    return () => { active = false; };
  }, [leagueId, playerId]);

  const maxPoints = detail ? Math.max(6, ...detail.pointsHistory.map((p) => Math.abs(p.points))) : 6;
  const valueDelta = detail ? detail.value - detail.baseValue : 0;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="player-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X /></button>
        {!detail ? (
          <div className="player-modal-loading">{error || "Cargando jugador..."}</div>
        ) : (
          <>
            <div className="player-modal-head">
              <span className="player-photo" style={{ background: detail.teamColor }}>
                {detail.photo ? <Image src={detail.photo} alt={detail.name} width={72} height={72} unoptimized /> : <b>{initials(detail.name)}</b>}
              </span>
              <div>
                <div className="player-modal-tags"><PositionTag position={detail.position} />{detail.status === "injured" && <span className="status-pill injured">Lesionado</span>}</div>
                <h2><TeamBadge player={detail} />{detail.name}</h2>
                <p>{detail.team}</p>
              </div>
            </div>

            <div className="player-modal-stats">
              <div><small>VALOR</small><strong>{money(detail.value)}</strong></div>
              <div><small>DESDE INICIO</small><strong className={valueDelta >= 0 ? "positive" : "negative"}>{valueDelta >= 0 ? "+" : ""}{money(valueDelta)}</strong></div>
              <div><small>PUNTOS TOTALES</small><strong>{Math.round(detail.pointsHistory.reduce((sum, p) => sum + p.points, 0))}</strong></div>
            </div>

            <div className="player-modal-section">
              <span className="kicker">EVOLUCIÓN DEL VALOR</span>
              <Sparkline points={detail.priceHistory.map((p) => p.value)} dates={detail.priceHistory.map((p) => p.at)} />
            </div>

            <div className="player-modal-section">
              <span className="kicker">PUNTOS POR JORNADA</span>
              {detail.pointsHistory.length === 0 ? (
                <div className="spark-empty">Todavía no ha puntuado en esta liga.</div>
              ) : (
                <div className="points-bars">
                  {detail.pointsHistory.slice(-12).map((p) => (
                    <div key={p.matchday} className="points-bar" title={`Jornada ${p.matchday}: ${Math.round(p.points)} pts`}>
                      <i className={p.points >= 0 ? "pos" : "neg"} style={{ height: `${Math.max(4, (Math.abs(p.points) / maxPoints) * 46)}px` }} />
                      <em>{Math.round(p.points)}</em>
                      <small>J{p.matchday}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {detail.owner && (
              <div className="player-modal-owner">
                <span>En el equipo de <strong>{detail.owner.teamName}</strong></span>
                {detail.owner.clauseValue !== null && <span>Cláusula: <strong>{money(detail.owner.clauseValue)}</strong></span>}
              </div>
            )}

            {actions.length > 0 && (
              <div className="player-modal-actions">
                {actions.map((action) => (
                  <button key={action.label} className={`button ${action.tone === "danger" ? "danger" : action.tone === "ghost" ? "ghost-button" : ""}`} disabled={action.disabled} onClick={() => { action.onClick(); }}>{action.label}</button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
