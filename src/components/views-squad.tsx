"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, Crown, LockKeyhole, Plus, Shirt, Sparkles, X } from "lucide-react";
import { countdown, money, moneyInput, nameAndSurname, pitchCoordinates, positionOrder } from "@/lib/client";
import { formations, type LeagueState, type SquadEntry } from "@/lib/types";
import type { Notify } from "@/components/fantasy-app";
import { PlayerAvatar, PositionTag, TeamBadge } from "@/components/ui";
import { PlayerModal } from "@/components/player-modal";

type Act = (url: string, body?: unknown, method?: "POST" | "PUT") => Promise<boolean>;

// Forma reciente: puntos de las últimas jornadas como chips de color.
function FormStrip({ points }: { points?: number[] }) {
  if (!points || points.length === 0) return null;
  return (
    <span className="form-strip" title="Puntos de las últimas jornadas">
      {points.map((p, i) => <i key={i} className={p >= 0 ? "pos" : "neg"}>{Math.round(p)}</i>)}
    </span>
  );
}

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

// Evolución del valor respecto a la última jornada, en formato compacto.
function formatDelta(value: number): string {
  if (!value) return "";
  const sign = value > 0 ? "+" : "−";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}${(abs / 1e6).toLocaleString("es-ES", { maximumFractionDigits: 1 })} M€`;
  return `${sign}${Math.round(abs / 1000)} k€`;
}

// Posición que ocupa cada hueco del campo, en el mismo orden que pitchCoordinates.
function slotPositionList(formation: string): string[] {
  const shape = formations[formation] ?? formations["4-4-2"];
  return ["POR", ...Array(shape.DEF).fill("DEF"), ...Array(shape.MED).fill("MED"), ...Array(shape.DEL).fill("DEL")];
}

// Reparte los titulares por líneas según la formación. Los jugadores que ya no
// están en la plantilla (vendidos, robados por cláusula...) dejan su hueco
// vacío en lugar de hacer desaparecer la posición.
function buildSlots(formation: string, starterIds: string[], playersById: Map<string, SquadEntry>): (string | null)[] {
  const shape = formations[formation] ?? formations["4-4-2"];
  const lines: [string, number][] = [["POR", 1], ["DEF", shape.DEF], ["MED", shape.MED], ["DEL", shape.DEL]];
  const byPos: Record<string, string[]> = { POR: [], DEF: [], MED: [], DEL: [] };
  for (const id of starterIds) {
    const player = playersById.get(id);
    if (player) byPos[player.position]?.push(id);
  }
  const slots: (string | null)[] = [];
  for (const [pos, n] of lines) {
    for (let i = 0; i < n; i += 1) slots.push(byPos[pos][i] ?? null);
  }
  return slots;
}

export function SquadView({ state, act, notify }: { state: LeagueState; act: Act; notify: Notify }) {
  const settings = state.league.settings;
  const playersById = useMemo(() => new Map(state.squad.map((p) => [p.id, p])), [state.squad]);
  const [formation, setFormation] = useState(state.lineup.formation);
  const [slots, setSlots] = useState<(string | null)[]>(() => buildSlots(state.lineup.formation, state.lineup.starters, playersById));
  const [bench, setBench] = useState<string[]>(state.lineup.bench);
  const [captain, setCaptain] = useState<string | null>(state.lineup.captainPlayerId);
  const [dirty, setDirty] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [clauseId, setClauseId] = useState<string | null>(null);
  const [clauseAmount, setClauseAmount] = useState("");
  const [clauseBusy, setClauseBusy] = useState(false);
  const [manageId, setManageId] = useState<string | null>(null);
  const [swapForId, setSwapForId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dirty) {
      setFormation(state.lineup.formation);
      setSlots(buildSlots(state.lineup.formation, state.lineup.starters, playersById));
      setBench(state.lineup.bench);
      setCaptain(state.lineup.captainPlayerId);
    }
  }, [state.lineup, dirty, playersById]);

  const coordinates = pitchCoordinates(formation, "vertical");
  const slotPositions = useMemo(() => slotPositionList(formation), [formation]);
  const starterIds = slots.filter((id): id is string => Boolean(id));
  const benchIds = settings.bench ? bench : [];
  const emptyStarters = slots.filter((id) => id === null).length;
  const locksAt = state.league.lineupLocksAt;
  const locked = locksAt ? new Date(locksAt).getTime() <= Date.now() : false;

  function changeFormation(next: string) {
    const filled = autofill(state.squad, next);
    setFormation(next);
    setSlots(buildSlots(next, filled.starters, playersById));
    setBench(filled.bench.slice(0, settings.benchSlots));
    if (captain && !filled.starters.includes(captain)) setCaptain(filled.starters[0] ?? null);
    setDirty(true);
  }

  // Coloca un jugador en un hueco concreto del campo.
  function assignSlot(slotIndex: number, playerId: string) {
    const prev = slots[slotIndex];
    setSlots((current) => current.map((id, i) => (i === slotIndex ? playerId : id === playerId ? null : id)));
    setBench((current) => {
      let next = current.filter((id) => id !== playerId);
      if (prev && playersById.has(prev) && !next.includes(prev)) next = [...next, prev];
      return next.slice(0, settings.benchSlots);
    });
    if (captain === prev) setCaptain(playerId);
    setDirty(true);
    setSelectedSlot(null);
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
    setSaving(true);
    const cleanBench = settings.bench ? bench.filter((id) => playersById.has(id)) : [];
    const validCaptain = settings.captain && captain && starterIds.includes(captain) ? captain : null;
    const ok = await act(`/api/league/${state.league.id}/lineup`, { formation, starters: starterIds, bench: cleanBench, captainPlayerId: validCaptain }, "PUT");
    setSaving(false);
    if (ok) { setDirty(false); notify(emptyStarters > 0 ? `Alineación guardada con ${emptyStarters} hueco${emptyStarters === 1 ? "" : "s"} libre${emptyStarters === 1 ? "" : "s"}.` : "Alineación guardada."); }
  }

  // --- Gestión de roles desde la convocatoria y el banquillo ---
  function emptySlotIndexFor(position: string) {
    return slots.findIndex((id, i) => id === null && slotPositions[i] === position);
  }
  function makeStarter(id: string) {
    const player = playersById.get(id);
    if (!player) return;
    const empty = emptySlotIndexFor(player.position);
    if (empty >= 0) { assignSlot(empty, id); setManageId(null); return; }
    // Sin hueco libre de su posición: elige a qué titular sustituye.
    setSwapForId(id);
  }
  function moveToBench(id: string) {
    setSlots((current) => current.map((slot) => (slot === id ? null : slot)));
    setBench((current) => (current.includes(id) ? current : [...current, id]).slice(0, settings.benchSlots));
    setDirty(true);
    setManageId(null);
  }
  function unconvene(id: string) {
    setSlots((current) => current.map((slot) => (slot === id ? null : slot)));
    setBench((current) => current.filter((x) => x !== id));
    if (captain === id) setCaptain(null);
    setDirty(true);
    setManageId(null);
  }

  async function confirmClause() {
    if (!clauseId) return;
    const value = moneyInput(clauseAmount);
    if (!value) { notify("Indica cuánto quieres invertir en millones.", "error"); return; }
    if (value > state.myMember.budget) { notify("No tienes saldo suficiente para esa inversión.", "error"); return; }
    setClauseBusy(true);
    const ok = await act(`/api/league/${state.league.id}/market`, { action: "increaseClause", playerId: clauseId, amount: value });
    setClauseBusy(false);
    if (ok) { notify("Cláusula aumentada."); setClauseId(null); setClauseAmount(""); }
  }

  const selectedPos = selectedSlot !== null ? slotPositions[selectedSlot] : null;
  const selectedCurrentId = selectedSlot !== null ? slots[selectedSlot] : null;
  const selectedCurrent = selectedCurrentId ? playersById.get(selectedCurrentId) : null;
  const candidates = selectedPos
    ? state.squad.filter((p) => p.position === selectedPos && !slots.includes(p.id))
    : [];

  const clausePlayer = clauseId ? playersById.get(clauseId) : null;
  const clauseInvestment = moneyInput(clauseAmount);

  return (
    <div className="squad-layout">
      <section className="panel squad-pitch-panel">
        <div className="panel-head">
          <div><span className="kicker">FORMACIÓN</span><h2>Jornada {state.league.currentMatchday}</h2></div>
          <div className="head-actions">
            <select value={formation} onChange={(event) => changeFormation(event.target.value)}>
              {Object.keys(formations).map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <button className="button button-small" disabled={saving || !dirty || locked} onClick={save}>{locked ? "Cerrada" : saving ? "Guardando..." : dirty ? "Guardar" : <><Check size={14} /> Guardado</>}</button>
          </div>
        </div>
        <div className="pitch full-pitch vertical-pitch">
          {slots.map((id, index) => {
            const player = id ? playersById.get(id) : undefined;
            const coordinate = coordinates[index];
            return (
              <button key={index} className={`pitch-player ${player ? "" : "empty"}`} style={{ left: `${coordinate?.left ?? 50}%`, top: `${coordinate?.top ?? 50}%` }} onClick={() => setSelectedSlot(index)}>
                {player ? (
                  <>
                    <PlayerAvatar player={player} points={player.seasonPoints} />
                    {settings.captain && id === captain && <Crown className="captain-crown" />}
                    <strong><TeamBadge player={player} />{nameAndSurname(player.name)}</strong>
                    <span>{money(player.value)}</span>
                  </>
                ) : (
                  <>
                    <span className="empty-slot"><Plus /></span>
                    <strong>{slotPositions[index]}</strong>
                    <span>Vacío</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
        <div className="squad-hint"><Sparkles /> {locked ? "La alineación está cerrada para esta jornada." : locksAt ? `Cierre de la alineación en ${countdown(locksAt)}.` : "Toca un titular para cambiarlo"}{!locked && !locksAt && (settings.captain ? " o nombrarlo capitán" : "")}{!locked && " Si un hueco queda vacío (por una venta o cláusula), tócalo para asignar otro jugador."}</div>
        {settings.bench && (
          <div className="bench-strip">
            <span className="kicker">BANQUILLO ({bench.length}/{settings.benchSlots})</span>
            <div className="bench-row">
              {bench.map((id, index) => {
                const player = playersById.get(id);
                if (!player) return null;
                return (
                  <div key={id} className="bench-chip">
                    <button type="button" className="bench-chip-id" onClick={() => setManageId(id)}>
                      <PlayerAvatar player={player} small />
                      <PositionTag position={player.position} />
                      <span><strong><TeamBadge player={player} />{nameAndSurname(player.name)}</strong><small>{player.position}</small></span>
                    </button>
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
          const isStarter = starterIds.includes(player.id);
          const isBench = benchIds.includes(player.id);
          const role = isStarter ? "titular" : isBench ? "suplente" : "fuera";
          const roleLabel = isStarter ? "Titular" : isBench ? "Suplente" : "Sin convocar";
          return (
            <button className={`squad-row clickable ${role === "fuera" ? "bench" : ""}`} key={player.id} onClick={() => setManageId(player.id)}>
              <PlayerAvatar player={player} small points={player.seasonPoints} />
              <span className="sq-club">
                <TeamBadge player={player} />
                <PositionTag position={player.position} />
              </span>
              <span className="sq-main">
                <strong>{player.name}{settings.captain && player.id === captain && <Crown />}<span className={`role-pill ${role}`}>{roleLabel}</span></strong>
                <FormStrip points={player.last5} />
              </span>
              <span className="sq-value">
                <b>{money(player.value)}</b>
                {player.valueDelta !== 0 && <small className={player.valueDelta > 0 ? "up" : "down"}>{formatDelta(player.valueDelta)}</small>}
              </span>
            </button>
          );
        })}
        <div className="bench-label">Valor total: {money(state.squad.reduce((sum, p) => sum + p.value, 0))} · Saldo: {money(state.myMember.budget)}</div>
      </aside>

      {selectedSlot !== null && (
        <div className="modal-backdrop" onMouseDown={() => setSelectedSlot(null)}>
          <div className="bid-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedSlot(null)}><X /></button>
            {selectedCurrent ? (
              <>
                <PlayerAvatar player={selectedCurrent} />
                <PositionTag position={selectedCurrent.position} />
                <h2><TeamBadge player={selectedCurrent} />{selectedCurrent.name}</h2>
                <p>{selectedCurrent.team} · {money(selectedCurrent.value)} · {Math.round(selectedCurrent.seasonPoints)} pts</p>
                {settings.captain && selectedCurrentId !== captain && (
                  <button className="button full" onClick={() => { setCaptain(selectedCurrentId); setDirty(true); setSelectedSlot(null); }}><Crown size={16} /> Hacer capitán (x{settings.captainMultiplier})</button>
                )}
              </>
            ) : (
              <>
                <PositionTag position={selectedPos ?? "MED"} />
                <h2>Hueco libre</h2>
                <p>Elige un {selectedPos} para esta posición.</p>
              </>
            )}
            {candidates.length > 0 && <label>{selectedCurrent ? "CAMBIAR POR" : "ELEGIR JUGADOR"}</label>}
            <div className="player-select-list">
              {candidates.map((candidate) => (
                <button key={candidate.id} onClick={() => assignSlot(selectedSlot, candidate.id)}>
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

      {manageId && (() => {
        const player = playersById.get(manageId);
        if (!player) return null;
        const isStarter = starterIds.includes(manageId);
        const isBench = benchIds.includes(manageId);
        const swapTargets = swapForId
          ? slots.map((sid, i) => ({ sid, i })).filter(({ sid, i }) => sid !== null && slotPositions[i] === player.position)
          : [];
        return (
          <div className="modal-backdrop" onMouseDown={() => { setManageId(null); setSwapForId(null); }}>
            <div className="bid-modal" onMouseDown={(event) => event.stopPropagation()}>
              <button className="modal-close" onClick={() => { setManageId(null); setSwapForId(null); }}><X /></button>
              <PlayerAvatar player={player} />
              <PositionTag position={player.position} />
              <h2><TeamBadge player={player} />{player.name}</h2>
              <p>{player.team} · {money(player.value)} · {Math.round(player.seasonPoints)} pts</p>
              {swapForId ? (
                <>
                  <label>¿A QUÉ TITULAR SUSTITUYE?</label>
                  <div className="player-select-list">
                    {swapTargets.map(({ sid, i }) => {
                      const current = playersById.get(sid as string);
                      if (!current) return null;
                      return (
                        <button key={i} onClick={() => { assignSlot(i, manageId); setManageId(null); setSwapForId(null); }}>
                          <PlayerAvatar player={current} small />
                          <span><strong><TeamBadge player={current} />{current.name}</strong><small>Titular · {Math.round(current.seasonPoints)} pts</small></span>
                          <em>{money(current.value)}</em>
                        </button>
                      );
                    })}
                  </div>
                  <button className="ghost-button" onClick={() => setSwapForId(null)}>Volver</button>
                </>
              ) : (
                <div className="manage-actions">
                  <button className="button full" disabled={isStarter} onClick={() => makeStarter(manageId)}><Shirt size={15} /> Poner de titular</button>
                  {settings.bench && <button className="ghost-button" disabled={isBench} onClick={() => moveToBench(manageId)}><ArrowDown size={14} /> Mandar al banquillo</button>}
                  <button className="ghost-button" disabled={!isStarter && !isBench} onClick={() => unconvene(manageId)}>Quitar de la convocatoria</button>
                  {settings.captain && isStarter && manageId !== captain && <button className="ghost-button" onClick={() => { setCaptain(manageId); setDirty(true); setManageId(null); }}><Crown size={14} /> Hacer capitán</button>}
                  <button className="ghost-button" onClick={() => { setDetailId(manageId); setManageId(null); }}>Ver ficha y cláusula</button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {clausePlayer && (
        <div className="modal-backdrop" onMouseDown={() => setClauseId(null)}>
          <div className="bid-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setClauseId(null)}><X /></button>
            <PlayerAvatar player={clausePlayer} />
            <PositionTag position={clausePlayer.position} />
            <h2><TeamBadge player={clausePlayer} />{clausePlayer.name}</h2>
            <p>{clausePlayer.team} · Valor {money(clausePlayer.value)}</p>
            <label>INVERTIR (RELACIÓN {settings.rules.clauseInvestCost}:1)</label>
            <div className="money-input">
              <input autoFocus inputMode="decimal" value={clauseAmount} onChange={(event) => setClauseAmount(event.target.value)} placeholder="0,0" />
              <span>M€</span>
            </div>
            <small>Cláusula actual: {clausePlayer.clauseValue !== null ? money(clausePlayer.clauseValue) : "—"}{clauseInvestment ? ` → nueva ${money((clausePlayer.clauseValue ?? clausePlayer.value) + Math.round(clauseInvestment / settings.rules.clauseInvestCost))}` : ""}</small>
            <small>Saldo disponible: {money(state.myMember.budget)}</small>
            <button className="button full" disabled={clauseBusy} onClick={confirmClause}><LockKeyhole size={16} /> Subir cláusula</button>
          </div>
        </div>
      )}

      {detailId && (
        <PlayerModal
          leagueId={state.league.id}
          playerId={detailId}
          actions={[
            ...(settings.market.clauses ? [{
              label: "Subir cláusula",
              tone: "ghost" as const,
              onClick: () => { setClauseId(detailId); setClauseAmount(""); setDetailId(null); },
            }] : []),
            ...(state.squad.length > 11 ? [{
              label: "Vender al mercado",
              tone: "ghost" as const,
              onClick: async () => {
                const player = playersById.get(detailId);
                if (player && window.confirm(`¿Vender a ${player.name} al mercado por ${money(player.value)}?`)) {
                  if (await act(`/api/league/${state.league.id}/market`, { action: "sellToMarket", playerId: detailId })) { notify("Jugador vendido al mercado."); setDetailId(null); }
                }
              },
            }] : []),
          ]}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}
