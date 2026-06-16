"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Search, X } from "lucide-react";
import { apiGet, initials, money } from "@/lib/client";
import { PlayerAvatar, PositionTag, TeamBadge } from "@/components/ui";
import { Sparkline } from "@/components/player-modal";

type CatalogPlayer = {
  id: string;
  externalId: number | null;
  name: string;
  position: string;
  team: string;
  teamShort: string;
  teamColor: string;
  teamLogo: string | null;
  photo: string | null;
  value: number;
  seasonPoints: number;
  last5: number[];
};

type ProfileDetail = {
  externalId: number;
  name: string;
  teamName: string | null;
  position: string | null;
  marketValue: number;
  photo: string | null;
  weekStats: { week: number; points: number }[];
  totals: { matches: number; goals: number; assists: number; minutes: number; saves: number; yellow: number; red: number };
  marketValues: { date: string; value: number }[];
};

const POSITIONS = ["Todas", "POR", "DEF", "MED", "DEL"] as const;

// Mini "forma": las últimas jornadas como barras pequeñas.
function FormBars({ points }: { points: number[] }) {
  if (points.length === 0) return <span className="form-empty">—</span>;
  const max = Math.max(6, ...points.map((p) => Math.abs(p)));
  return (
    <span className="form-bars" title={`Últimas ${points.length} jornadas: ${points.join(", ")}`}>
      {points.map((p, i) => (
        <i key={i} className={p >= 0 ? "pos" : "neg"} style={{ height: `${Math.max(3, (Math.abs(p) / max) * 22)}px` }} />
      ))}
    </span>
  );
}

export function PlayersView() {
  const [players, setPlayers] = useState<CatalogPlayer[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<(typeof POSITIONS)[number]>("Todas");
  const [team, setTeam] = useState("Todos");
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    apiGet<{ players: CatalogPlayer[] }>("/api/football/catalog").then((result) => {
      if (result.ok) setPlayers(result.data.players);
      else setError(result.error);
    });
  }, []);

  const teams = useMemo(
    () => ["Todos", ...Array.from(new Set((players ?? []).map((p) => p.team))).sort((a, b) => a.localeCompare(b))],
    [players],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (players ?? []).filter((p) => {
      if (position !== "Todas" && p.position !== position) return false;
      if (team !== "Todos" && p.team !== team) return false;
      if (query && !p.name.toLowerCase().includes(query) && !p.team.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [players, search, position, team]);

  return (
    <div className="players-layout">
      <section className="panel players-panel">
        <div className="panel-head">
          <div><span className="kicker">BASE DE DATOS</span><h2>Jugadores de LaLiga</h2></div>
          <span className="counter">{filtered.length}</span>
        </div>

        <div className="players-filters">
          <div className="players-search">
            <Search size={15} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar jugador o equipo..." />
          </div>
          <select value={position} onChange={(e) => setPosition(e.target.value as (typeof POSITIONS)[number])}>
            {POSITIONS.map((p) => <option key={p} value={p}>{p === "Todas" ? "Todas las posiciones" : p}</option>)}
          </select>
          <select value={team} onChange={(e) => setTeam(e.target.value)}>
            {teams.map((t) => <option key={t} value={t}>{t === "Todos" ? "Todos los equipos" : t}</option>)}
          </select>
        </div>

        <div className="players-head"><span>JUGADOR</span><span className="hide-sm">FORMA</span><span>PTS</span><span>VALOR</span></div>
        <div className="players-list">
          {players === null && !error && <div className="empty-mini">Cargando jugadores...</div>}
          {error && <div className="empty-mini">{error}</div>}
          {players !== null && filtered.length === 0 && <div className="empty-mini">Sin resultados para esos filtros.</div>}
          {filtered.map((p) => (
            <button
              key={p.id}
              className="player-row clickable"
              disabled={!p.externalId}
              onClick={() => p.externalId && setSelected(p.externalId)}
            >
              <PlayerAvatar player={p} small />
              <PositionTag position={p.position} />
              <span className="player-row-name">
                <strong><TeamBadge player={p} />{p.name}</strong>
                <small>{p.team}</small>
              </span>
              <span className="hide-sm"><FormBars points={p.last5} /></span>
              <b className="player-row-pts">{Math.round(p.seasonPoints)}</b>
              <em className="player-row-val">{money(p.value)}</em>
            </button>
          ))}
        </div>
      </section>

      {selected !== null && <GlobalPlayerModal externalId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function GlobalPlayerModal({ externalId, onClose }: { externalId: number; onClose: () => void }) {
  const [detail, setDetail] = useState<ProfileDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setDetail(null);
    setError("");
    apiGet<ProfileDetail>(`/api/football/player/${externalId}`).then((result) => {
      if (!active) return;
      if (result.ok) setDetail(result.data);
      else setError(result.error);
    });
    return () => { active = false; };
  }, [externalId]);

  const seasonPoints = detail ? detail.weekStats.reduce((sum, w) => sum + w.points, 0) : 0;
  const average = detail && detail.totals.matches > 0 ? seasonPoints / detail.totals.matches : 0;
  const maxPoints = detail ? Math.max(6, ...detail.weekStats.map((w) => Math.abs(w.points))) : 6;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="player-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X /></button>
        {!detail ? (
          <div className="player-modal-loading">{error || "Cargando jugador..."}</div>
        ) : (
          <>
            <div className="player-modal-head">
              <span className="player-photo" style={{ background: "#23402f" }}>
                {detail.photo ? <Image src={detail.photo} alt={detail.name} width={72} height={72} unoptimized /> : <b>{initials(detail.name)}</b>}
              </span>
              <div>
                <div className="player-modal-tags">{detail.position && <PositionTag position={detail.position} />}</div>
                <h2>{detail.name}</h2>
                <p>{detail.teamName ?? "—"}</p>
              </div>
            </div>

            <div className="player-modal-stats">
              <div><small>VALOR</small><strong>{money(detail.marketValue)}</strong></div>
              <div><small>PUNTOS TEMP.</small><strong>{Math.round(seasonPoints)}</strong></div>
              <div><small>MEDIA</small><strong>{average.toFixed(1)}</strong></div>
            </div>

            <div className="player-modal-section">
              <span className="kicker">EVOLUCIÓN DEL VALOR DE MERCADO</span>
              <Sparkline points={detail.marketValues.map((v) => v.value)} />
            </div>

            <div className="player-modal-section">
              <span className="kicker">ESTADÍSTICAS DE LA TEMPORADA</span>
              <div className="stat-grid">
                <div><strong>{detail.totals.matches}</strong><small>Partidos</small></div>
                <div><strong>{detail.totals.goals}</strong><small>Goles</small></div>
                <div><strong>{detail.totals.assists}</strong><small>Asist.</small></div>
                <div><strong>{detail.totals.minutes}</strong><small>Minutos</small></div>
                {detail.position === "POR" && <div><strong>{detail.totals.saves}</strong><small>Paradas</small></div>}
                <div><strong>{detail.totals.yellow}</strong><small>Amarillas</small></div>
                <div><strong>{detail.totals.red}</strong><small>Rojas</small></div>
              </div>
            </div>

            <div className="player-modal-section">
              <span className="kicker">PUNTOS POR JORNADA</span>
              {detail.weekStats.length === 0 ? (
                <div className="spark-empty">Sin datos de jornadas todavía.</div>
              ) : (
                <div className="points-bars points-bars-scroll">
                  {detail.weekStats.map((w) => (
                    <div key={w.week} className="points-bar" title={`Jornada ${w.week}: ${Math.round(w.points)} pts`}>
                      <i className={w.points >= 0 ? "pos" : "neg"} style={{ height: `${Math.max(4, (Math.abs(w.points) / maxPoints) * 46)}px` }} />
                      <em>{Math.round(w.points)}</em>
                      <small>J{w.week}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
