"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, Crown, Sparkles, X } from "lucide-react";
import { money, nameAndSurname, pitchCoordinates, positionOrder } from "@/lib/client";
import { formations, type LeagueState, type SquadEntry } from "@/lib/types";
import type { Notify } from "@/components/fantasy-app";
import { PlayerAvatar, PositionTag, TeamBadge } from "@/components/ui";
import { PlayerModal } from "@/components/player-modal";

type Act = (url: string, body?: unknown, method?: "POST" | "PUT") => Promise<boolean>;

function autofill(squad: SquadEntry[], formation: string) {
  const shape = formations[formation];
  const sorted = [...squad].sort((a, b) => b.seasonPoints - a.seasonPoints || b.value - a.value);
  const pick = (position: string, count: number) => sorted.filter((p) => p.position === position).slice(0, count);
  const starters = [
    ...pick("POR", 1),
    ...pick("DEF", shape.DEF),
    ...pick("MED", shape.MED),
    ...pick("DEL", shape.DEL),
  ].map((p) => p.id);
  const bench = sorted.filter((p) => !starters.includes(p.id)).sort((a, b) => b.value - a.value).map((p) => p.id);
  return { starters, bench };
}

export function SquadView({ state, act, notify }: { state: LeagueState; act: Act; notify: Notify }) {
  const settings = state.league.settings;
  const playersById = useMemo(() => new Map(state.squad.map((p) => [p.id, p])), [state.squad]);
  const [formation, setFormation] = useState(state.lineup.formation);
  const [starters, setStarters] = useState<string[]>(state.lineup.starters);
  const [bench, setBench] = useState<string[]>(state.lineup.bench);
  const [captain, setCaptain] = useState<string | null>(state.lineup.captainPlayerId);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dirty) {
      setFormation(state.lineup.formation);
      setStarters(state.lineup.starters);
      setBench(state.lineup.bench);
      setCaptain(state.lineup.captainPlayerId);
    }
  }, [state.lineup, dirty]);

  const coordinates = pitchCoordinates(formation);
  const starterPlayers = starters.map((id) => playersById.get(id));
  const valid = starters.length === 11 && starterPlayers.every(Boolean);

  function changeFormation(next: string) {
    const filled = autofill(state.squad, next);
    setFormation(next);
    setStarters(filled.starters);
    setBench(filled.bench.slice(0, settings.benchSlots));
    if (captain && !filled.starters.includes(captain)) setCaptain(filled.starters[1] ?? null);
    setDirty(true);
  }

  function swap(starterId: string, replacementId: string) {
    setStarters((current) => current.map((id) => (id === starterId ? replacementId : id)));
    setBench((current) => {
      const without = current.filter((id) => id !== replacementId);
      return [...without, starterId].slice(0, settings.benchSlots);
    });
    if (captain === starterId) setCaptain(replacementId);
    setDirty(true);
    setSelected(null);
  }

  function moveBench(id: string, direction: -1 | 1) {
    setBench((current) => {
      const index = current.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirty(true);
  }

  async function save() {
    if (!valid) { notify("Completa los 11 titulares antes de guardar.", "error"); return; }
    setSaving(true);
    const ok = await act(`/api/league/${state.league.id}/lineup`, { formation, starters, bench, captainPlayerId: settings.captain ? captain : null }, "PUT");
    setSaving(false);
    if (ok) { setDirty(false); notify("Alineación guardada."); }
  }

  const selectedPlayer = selected ? playersById.get(selected) : null;
  const candidates = selectedPlayer
    ? state.squad.filter((p) => p.position === selectedPlayer.position && !starters.includes(p.id))
    : [];

  return (
    <div className="squad-layout">
      <section className="panel squad-pitch-panel">
        <div className="panel-head">
          <div><span className="kicker">FORMACIÓN</span><h2>Jornada {state.league.currentMatchday}</h2></div>
          <div className="head-actions">
            <select value={formation} onChange={(event) => changeFormation(event.target.value)}>
              {Object.keys(formations).map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <button className="button button-small" disabled={saving || !dirty} onClick={save}>{saving ? "Guardando..." : dirty ? "Guardar" : <><Check size={14} /> Guardado</>}</button>
          </div>
        </div>
        <div className="pitch full-pitch">
          {starters.map((id, index) => {
            const player = playersById.get(id);
            if (!player) return null;
            return (
              <button key={id} className="pitch-player" style={{ left: `${coordinates[index]?.left ?? 50}%`, top: `${coordinates[index]?.top ?? 50}%` }} onClick={() => setSelected(id)}>
                <PlayerAvatar player={player} />
                {settings.captain && id === captain && <Crown className="captain-crown" />}
                <strong><TeamBadge player={player} />{nameAndSurname(player.name)}</strong>
                <span>{money(player.value)}</span>
              </button>
            );
          })}
        </div>
        <div className="squad-hint"><Sparkles /> Toca un titular para cambiarlo{settings.captain ? " o nombrarlo capitán" : ""}. {settings.bench ? "El banquillo entra automáticamente si un titular no juega." : ""}</div>
        {settings.bench && (
          <div className="bench-strip">
            <span className="kicker">BANQUILLO ({bench.length}/{settings.benchSlots})</span>
            <div className="bench-row">
              {bench.map((id, index) => {
                const player = playersById.get(id);
                if (!player) return null;
                return (
                  <div key={id} className="bench-chip">
                    <PlayerAvatar player={player} small />
                    <span><strong><TeamBadge player={player} />{nameAndSurname(player.name)}</strong><small>{player.position}</small></span>
                    <div className="bench-actions">
                      <button onClick={() => moveBench(id, -1)} disabled={index === 0} aria-label="Subir"><ArrowUp /></button>
                      <button onClick={() => moveBench(id, 1)} disabled={index === bench.length - 1} aria-label="Bajar"><ArrowDown /></button>
                    </div>
                  </div>
                );
              })}
              {bench.length === 0 && <small className="empty-mini">Sin suplentes seleccionados.</small>}
            </div>
          </div>
        )}
      </section>

      <aside className="panel squad-list">
        <div className="panel-head"><div><span className="kicker">CONVOCATORIA</span><h2>Jugadores</h2></div><span className="counter">{state.squad.length}</span></div>
        {state.squad.slice().sort((a, b) => positionOrder[a.position] - positionOrder[b.position] || b.value - a.value).map((player) => {
          const isStarter = starters.includes(player.id);
          const isBench = bench.includes(player.id);
          return (
            <button className={`squad-row clickable ${!isStarter && !isBench ? "bench" : ""}`} key={player.id} onClick={() => setDetailId(player.id)}>
              <PlayerAvatar player={player} small />
              <span>
                <strong><TeamBadge player={player} />{player.name}{settings.captain && player.id === captain && <Crown />}</strong>
                <small>{player.position} · {player.team} · {isStarter ? "Titular" : isBench ? "Suplente" : "Sin convocar"}</small>
              </span>
              <div><b>{Math.round(player.seasonPoints)}</b><small>pts</small></div>
            </button>
          );
        })}
        <div className="bench-label">Valor total: {money(state.squad.reduce((sum, p) => sum + p.value, 0))} · Saldo: {money(state.myMember.budget)}</div>
      </aside>

      {selectedPlayer && (
        <div className="modal-backdrop" onMouseDown={() => setSelected(null)}>
          <div className="bid-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)}><X /></button>
            <PlayerAvatar player={selectedPlayer} />
            <PositionTag position={selectedPlayer.position} />
            <h2><TeamBadge player={selectedPlayer} />{selectedPlayer.name}</h2>
            <p>{selectedPlayer.team} · {money(selectedPlayer.value)} · {Math.round(selectedPlayer.seasonPoints)} pts</p>
            {settings.captain && selected !== captain && (
              <button className="button full" onClick={() => { setCaptain(selected); setDirty(true); setSelected(null); }}><Crown size={16} /> Hacer capitán (x{settings.captainMultiplier})</button>
            )}
            {candidates.length > 0 && <label>CAMBIAR POR</label>}
            <div className="player-select-list">
              {candidates.map((candidate) => (
                <button key={candidate.id} onClick={() => selected && swap(selected, candidate.id)}>
                  <PlayerAvatar player={candidate} small />
                  <span><strong><TeamBadge player={candidate} />{candidate.name}</strong><small>{candidate.team} · {Math.round(candidate.seasonPoints)} pts</small></span>
                  <em>{money(candidate.value)}</em>
                </button>
              ))}
              {candidates.length === 0 && <small className="empty-mini">No tienes más jugadores de esa posición.</small>}
            </div>
          </div>
        </div>
      )}

      {detailId && (
        <PlayerModal
          leagueId={state.league.id}
          playerId={detailId}
          actions={state.squad.length > 11 ? [{
            label: "Vender al mercado",
            tone: "ghost",
            onClick: async () => {
              const player = playersById.get(detailId);
              if (player && window.confirm(`¿Vender a ${player.name} al mercado por ${money(player.value)}?`)) {
                if (await act(`/api/league/${state.league.id}/market`, { action: "sellToMarket", playerId: detailId })) { notify("Jugador vendido al mercado."); setDetailId(null); }
              }
            },
          }] : []}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}
