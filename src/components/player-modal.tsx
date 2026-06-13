"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { apiGet, initials, money } from "@/lib/client";
import { PositionTag } from "@/components/ui";

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

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return <div className="spark-empty">Aún no hay histórico de precios. Se registrará tras cada jornada.</div>;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 280;
  const h = 70;
  const step = w / (points.length - 1);
  const coords = points.map((value, index) => [index * step, h - ((value - min) / range) * (h - 10) - 5] as const);
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;
  const up = points[points.length - 1] >= points[0];
  const color = up ? "var(--positive)" : "var(--danger)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="sparkline" preserveAspectRatio="none">
      <path d={area} fill={color} opacity="0.12" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {coords.map(([x, y], i) => i === coords.length - 1 && <circle key={i} cx={x} cy={y} r="3" fill={color} />)}
    </svg>
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
                {detail.teamLogo && <Image className="player-photo-badge" src={detail.teamLogo} alt={detail.team} width={26} height={26} unoptimized />}
              </span>
              <div>
                <div className="player-modal-tags"><PositionTag position={detail.position} />{detail.status === "injured" && <span className="status-pill injured">Lesionado</span>}</div>
                <h2>{detail.name}</h2>
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
              <Sparkline points={detail.priceHistory.map((p) => p.value)} />
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
