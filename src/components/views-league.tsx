"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleDollarSign, Crown, Gavel, LockKeyhole, Play, Shield, Shirt, Trophy, X } from "lucide-react";
import { apiGet, apiPost, money, moneyInput, nameAndSurname, pitchCoordinates, positionOrder, timeAgo } from "@/lib/client";
import { formations, type LeagueState, type LeagueStats, type MatchdayDetail, type MatchdayDetailMember, type MatchdayDetailPlayer, type RivalSquadEntry } from "@/lib/types";
import type { Notify } from "@/components/fantasy-app";
import { PlayerAvatar, PositionTag, TeamBadge, UserAvatar } from "@/components/ui";

type Act = (url: string, body?: unknown, method?: "POST" | "PUT") => Promise<boolean>;

export function StandingsView({ state, act, notify }: { state: LeagueState; act: Act; notify: Notify }) {
  const [selectedRoundNumber, setSelectedRoundNumber] = useState<number | null>(null);
  const [selectedRivalId, setSelectedRivalId] = useState<string | null>(null);
  const [offerTarget, setOfferTarget] = useState<RivalSquadEntry | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const members = state.members;
  const average = members.length > 0 ? Math.round(members.reduce((sum, m) => sum + m.totalPoints, 0) / members.length) : 0;
  const topValue = Math.max(0, ...members.map((m) => m.squadValue));
  const bestRound = Math.max(0, ...members.map((m) => m.lastRoundPoints ?? 0));
  const roundNumber = selectedRoundNumber ?? state.roundResults[0]?.number ?? null;
  const selectedRound = state.roundResults.find((round) => round.number === roundNumber) ?? null;
  const memberName = (id: string) => members.find((m) => m.id === id);
  const marketUrl = `/api/league/${state.league.id}/market`;
  const selectedRival = members.find((member) => member.id === selectedRivalId && member.id !== state.myMember.id) ?? null;
  const rivalSquad = selectedRival
    ? state.rivalSquads
        .filter((player) => player.memberId === selectedRival.id)
        .sort((a, b) => positionOrder[a.position] - positionOrder[b.position] || b.value - a.value)
    : [];
  const rivalLineup = selectedRival ? state.rivalLineups.find((lineup) => lineup.memberId === selectedRival.id) ?? null : null;
  const rivalById = new Map(rivalSquad.map((player) => [player.id, player]));
  const rivalCoordinates = rivalLineup ? pitchCoordinates(rivalLineup.formation, "vertical") : [];

  // Evolución del usuario por jornada: puntos y posición.
  const myId = state.myMember.id;
  const myHistory = state.roundResults
    .map((round) => {
      const ranked = [...round.memberPoints].sort((a, b) => b.points - a.points);
      const points = round.memberPoints.find((m) => m.memberId === myId)?.points ?? 0;
      return { number: round.number, points, rank: ranked.findIndex((m) => m.memberId === myId) + 1 };
    })
    .sort((a, b) => a.number - b.number);
  const myMaxRound = Math.max(6, ...myHistory.map((r) => Math.abs(r.points)));
  const myBestRound = myHistory.length > 0 ? myHistory.reduce((best, r) => (r.points > best.points ? r : best)) : null;

  async function runMarket(body: unknown, message?: string) {
    setBusy(true);
    const ok = await act(marketUrl, body);
    setBusy(false);
    if (ok && message) notify(message);
    return ok;
  }

  async function confirmOffer() {
    if (!offerTarget) return;
    const value = moneyInput(amount);
    if (!value) { notify("Indica una cantidad válida en millones.", "error"); return; }
    if (await runMarket({ action: "makeOffer", playerId: offerTarget.id, amount: value }, "Oferta enviada al mánager.")) {
      setOfferTarget(null);
      setAmount("");
    }
  }

  return (
    <div className="standings-layout">
      <section className="panel standings-panel">
        <div className="panel-head">
          <div><span className="kicker">CLASIFICACION</span><h2>Tabla general</h2></div>
        </div>
        <div className="standings-head"><span>#</span><span>EQUIPO</span><span>JORNADA</span><span>VALOR</span><span>PUNTOS</span></div>
        {members.map((member, index) => (
          <div className={`standings-row ${member.id === state.myMember.id ? "current" : ""}`} key={member.id}>
            <b>{index + 1}</b>
            <UserAvatar name={member.teamName} color={member.color} avatarUrl={member.avatarUrl} />
            {member.id === state.myMember.id ? (
              <span><strong>{member.teamName}</strong><small>{member.displayName} · Tú{member.role !== "member" ? " · Admin" : ""}</small></span>
            ) : (
              <button type="button" className="standings-team-button" onClick={() => setSelectedRivalId(member.id)}>
                <strong>{member.teamName}</strong>
                <small>{member.displayName}{member.role !== "member" ? " · Admin" : ""} · Ver plantilla</small>
              </button>
            )}
            <em className={member.lastRoundPoints !== null && member.lastRoundPoints >= bestRound && bestRound > 0 ? "positive" : ""}>{member.lastRoundPoints === null ? "—" : Math.round(member.lastRoundPoints)}</em>
            <em>{money(member.squadValue)}</em>
            <strong>{Math.round(member.totalPoints)}</strong>
          </div>
        ))}
      </section>
      <aside>
        {members.length >= 3 && (
          <section className="panel podium">
            <span className="kicker">PODIO ACTUAL</span>
            <div className="podium-bars">
              <div><i style={{ background: members[1].color }}>{members[1].teamName.slice(0, 2).toUpperCase()}</i><span>2</span></div>
              <div className="winner"><Crown /><i style={{ background: members[0].color }}>{members[0].teamName.slice(0, 2).toUpperCase()}</i><span>1</span></div>
              <div><i style={{ background: members[2].color }}>{members[2].teamName.slice(0, 2).toUpperCase()}</i><span>3</span></div>
            </div>
          </section>
        )}
        <section className="panel league-facts">
          <h3>Datos de la liga</h3>
          <p><span>Media de puntos</span><strong>{average.toLocaleString("es-ES")}</strong></p>
          <p><span>Equipo más valioso</span><strong>{money(topValue)}</strong></p>
          <p><span>Jornada actual</span><strong>{state.league.currentMatchday} / {state.league.totalMatchdays}</strong></p>
          <p><span>Miembros</span><strong>{members.length}</strong></p>
        </section>
        {myHistory.length > 0 && (
          <section className="panel league-facts">
            <h3>Tu evolución</h3>
            <div className="points-bars points-bars-scroll">
              {myHistory.map((r) => (
                <div key={r.number} className="points-bar" title={`Jornada ${r.number}: ${Math.round(r.points)} pts · ${r.rank}º`}>
                  <i className={r.points >= 0 ? "pos" : "neg"} style={{ height: `${Math.max(4, (Math.abs(r.points) / myMaxRound) * 46)}px` }} />
                  <em>{Math.round(r.points)}</em>
                  <small>{r.rank}º</small>
                </div>
              ))}
            </div>
            {myBestRound && <p><span>Mejor jornada</span><strong>J{myBestRound.number} · {Math.round(myBestRound.points)} pts</strong></p>}
          </section>
        )}
        <section className="panel round-results-panel">
          <div className="panel-head">
            <div><span className="kicker">RESULTADOS</span><h2>Por jornada</h2></div>
            {state.roundResults.length > 0 && selectedRound && (
              <select value={selectedRound.number} onChange={(event) => setSelectedRoundNumber(Number(event.target.value))}>
                {state.roundResults.map((round) => <option key={round.number} value={round.number}>Jornada {round.number}</option>)}
              </select>
            )}
          </div>
          {selectedRound ? (
            <div className="round-results-list">
              {selectedRound.memberPoints
                .slice()
                .sort((a, b) => b.points - a.points)
                .map((row, index) => {
                  const member = memberName(row.memberId);
                  if (!member) return null;
                  return (
                    <div key={row.memberId}>
                      <b>{index + 1}</b>
                      <UserAvatar name={member.teamName} color={member.color} avatarUrl={member.avatarUrl} />
                      <span><strong>{member.teamName}</strong><small>{member.displayName}</small></span>
                      <em>{Math.round(row.points)} pts</em>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="empty-mini"><Trophy size={14} /> Aún no se ha disputado ninguna jornada.</div>
          )}
        </section>
      </aside>
      {selectedRival && (
        <div className="modal-backdrop" onMouseDown={() => setSelectedRivalId(null)}>
          <div className="lineup-modal standings-rival-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedRivalId(null)}><X /></button>
            <div className="lineup-modal-head">
              <span className="kicker">{selectedRival.displayName.toUpperCase()}</span>
              <h2>{selectedRival.teamName}</h2>
              <p>{Math.round(selectedRival.totalPoints)} pts · Valor {money(selectedRival.squadValue)}</p>
            </div>
            <div className="standings-rival-body">
              <section>
                <h3><Shirt size={15} /> Alineación</h3>
                {rivalLineup && rivalLineup.starters.length > 0 ? (
                  <div className="pitch full-pitch vertical-pitch rival-modal-pitch">
                    {rivalLineup.starters.map((id, index) => {
                      const player = rivalById.get(id);
                      if (!player) return null;
                      return (
                        <div key={id} className="pitch-player" style={{ left: `${rivalCoordinates[index]?.left ?? 50}%`, top: `${rivalCoordinates[index]?.top ?? 50}%` }}>
                          <PlayerAvatar player={player} />
                          {state.league.settings.captain && id === rivalLineup.captainPlayerId && <Crown className="captain-crown" />}
                          <strong><TeamBadge player={player} />{nameAndSurname(player.name)}</strong>
                          <span>{money(player.value)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-mini"><Shirt size={14} /> Este rival aún no tiene once para la jornada actual.</div>
                )}
              </section>
              <section>
                <h3>Plantilla completa</h3>
                <div className="rival-squad-list">
                  {rivalSquad.map((player) => (
                    <div className="rival-player-row" key={player.id}>
                      <PlayerAvatar player={player} small />
                      <PositionTag position={player.position} />
                      <span><strong><TeamBadge player={player} />{player.name}</strong><small>{player.team}</small></span>
                      <em>{money(player.value)}</em>
                      <div className="row-actions">
                        {state.league.settings.market.clauses && player.clauseValue !== null && (
                          <button className="ghost-button danger" disabled={busy || player.clauseValue > state.myMember.budget} title={player.clauseValue > state.myMember.budget ? "Saldo insuficiente" : ""} onClick={async () => {
                            if (window.confirm(`¿Pagar la cláusula de ${player.name} (${money(player.clauseValue!)})? El traspaso es inmediato.`)) {
                              if (await runMarket({ action: "payClause", playerId: player.id }, "¡Cláusula pagada! El jugador ya es tuyo.")) setSelectedRivalId(null);
                            }
                          }}><LockKeyhole size={13} /> {money(player.clauseValue)}</button>
                        )}
                        {state.league.settings.market.directTransfers && (
                          <button className="ghost-button" disabled={busy} onClick={() => { setOfferTarget(player); setAmount(String(player.value / 1e6)); }}>Ofertar</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {rivalSquad.length === 0 && <div className="empty-mini">No hay jugadores visibles para este rival.</div>}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
      {offerTarget && (
        <div className="modal-backdrop" onMouseDown={() => setOfferTarget(null)}>
          <div className="bid-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setOfferTarget(null)}><X /></button>
            <PlayerAvatar player={offerTarget} />
            <PositionTag position={offerTarget.position} />
            <h2><TeamBadge player={offerTarget} />{offerTarget.name}</h2>
            <p>{offerTarget.team} · Valor {money(offerTarget.value)}</p>
            <label>TU OFERTA</label>
            <div className="money-input">
              <input autoFocus inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,0" />
              <span>M€</span>
            </div>
            <small>Saldo disponible: {money(state.myMember.budget)}</small>
            <button className="button full" disabled={busy} onClick={confirmOffer}>Enviar oferta <CircleDollarSign size={17} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

// Coloca los titulares de un once por líneas de la formación para el campo.
function arrangeStarters(formation: string, players: MatchdayDetailPlayer[]): MatchdayDetailPlayer[] {
  const shape = formations[formation] ?? formations["4-4-2"];
  const lines: [string, number][] = [["POR", 1], ["DEF", shape.DEF], ["MED", shape.MED], ["DEL", shape.DEL]];
  const byPos: Record<string, MatchdayDetailPlayer[]> = { POR: [], DEF: [], MED: [], DEL: [] };
  for (const p of players.filter((x) => x.starter)) byPos[p.position]?.push(p);
  const ordered: MatchdayDetailPlayer[] = [];
  for (const [pos, n] of lines) for (let i = 0; i < n; i += 1) if (byPos[pos][i]) ordered.push(byPos[pos][i]);
  return ordered;
}

export function MatchdayView({ state, act, notify }: { state: LeagueState; act: Act; notify: Notify }) {
  const [busy, setBusy] = useState(false);
  const myId = state.myMember.id;
  const rounds = state.roundResults.map((r) => r.number).sort((a, b) => a - b);
  const latest = rounds.length > 0 ? rounds[rounds.length - 1] : null;
  const [round, setRound] = useState<number | null>(latest);
  const [detail, setDetail] = useState<MatchdayDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [openManager, setOpenManager] = useState<string | null>(null);
  const [leagueStats, setLeagueStats] = useState<LeagueStats | null>(null);

  useEffect(() => {
    let active = true;
    apiGet<LeagueStats>(`/api/league/${state.league.id}/stats`).then((result) => {
      if (active) setLeagueStats(result.ok ? result.data : null);
    });
    return () => { active = false; };
  }, [state.league.id, state.lastMatchday?.number]);

  useEffect(() => {
    if (round === null) { setDetail(null); return; }
    let active = true;
    setLoadingDetail(true);
    apiGet<MatchdayDetail>(`/api/league/${state.league.id}/matchday?number=${round}`).then((result) => {
      if (!active) return;
      setDetail(result.ok ? result.data : null);
      setLoadingDetail(false);
    });
    return () => { active = false; };
  }, [round, state.league.id, state.lastMatchday?.number]);

  const ranked = detail ? detail.members : [];
  const average = ranked.length > 0 ? ranked.reduce((s, m) => s + m.points, 0) / ranked.length : null;
  const mine = ranked.find((m) => m.memberId === myId) ?? null;
  const myRank = mine ? ranked.findIndex((m) => m.memberId === myId) + 1 : null;
  const captainEntry = mine && mine.captainPlayerId ? mine.players.find((p) => p.playerId === mine.captainPlayerId) ?? null : null;
  const starters = mine ? mine.players.filter((p) => p.starter) : [];
  const subs = mine ? mine.players.filter((p) => !p.starter) : [];
  const startersTotal = starters.reduce((s, p) => s + p.points, 0);
  const scorers = starters.filter((p) => p.points > 0).length;
  const leader = ranked[0] ?? null;

  // Mi evolución por jornada (de roundResults, ya en el estado).
  const myHistory = state.roundResults
    .map((r) => ({ number: r.number, points: r.memberPoints.find((m) => m.memberId === myId)?.points ?? 0 }))
    .sort((a, b) => a.number - b.number);
  const maxHistory = Math.max(6, ...myHistory.map((r) => Math.abs(r.points)));
  const seasonRank = [...state.members].sort((a, b) => b.totalPoints - a.totalPoints).findIndex((m) => m.id === myId) + 1;
  const myTotal = state.members.find((m) => m.id === myId)?.totalPoints ?? 0;
  const myBestRound = myHistory.reduce((max, r) => Math.max(max, r.points), 0);

  async function simulate() {
    if (!window.confirm(`¿Disputar la jornada ${state.league.currentMatchday}? Se calcularán los puntos de todos los equipos y los valores de mercado se actualizarán.`)) return;
    setBusy(true);
    const ok = await act(`/api/league/${state.league.id}/simulate`);
    setBusy(false);
    if (ok) notify(`Jornada ${state.league.currentMatchday} disputada. ¡Mira los resultados!`);
  }

  const playerRow = (player: MatchdayDetailPlayer, index: number, captainId: string | null) => (
    <div key={player.playerId} className={player.points > 0 ? "scored" : ""}>
      <b>{index + 1}</b>
      <PlayerAvatar player={player} small />
      <span><strong><TeamBadge player={player} />{player.name}{captainId === player.playerId ? <Crown className="captain-inline" /> : null}</strong><small>{player.team}</small></span>
      <em className={player.points > 0 ? "positive" : player.points < 0 ? "negative" : ""}>{Math.round(player.points)} pts</em>
    </div>
  );

  const openMember = openManager ? ranked.find((m) => m.memberId === openManager) ?? null : null;
  const openMemberHistory = openManager
    ? state.roundResults.map((r) => ({ number: r.number, points: r.memberPoints.find((m) => m.memberId === openManager)?.points ?? 0 })).sort((a, b) => a.number - b.number)
    : [];
  const openMaxHistory = Math.max(6, ...openMemberHistory.map((r) => Math.abs(r.points)));
  const openCoords = openMember ? pitchCoordinates(openMember.formation, "vertical") : [];
  const openStarters = openMember ? arrangeStarters(openMember.formation, openMember.players) : [];

  if (rounds.length === 0) {
    return (
      <div className="matchday-layout">
        <section className="panel matchday-main">
          <div className="panel-head"><div><span className="kicker">JORNADA</span><h2>Todavía no se ha disputado ninguna jornada</h2></div>
            {state.league.isAdmin && <button className="button button-small" disabled={busy} onClick={simulate}><Play size={14} /> {busy ? "Disputando..." : `Disputar jornada ${state.league.currentMatchday}`}</button>}
          </div>
          <div className="empty-state"><Trophy /><h3>La temporada está lista</h3><p>{state.league.isAdmin ? "Pulsa «Disputar jornada» para calcular los primeros puntos." : "El administrador disputará la primera jornada en breve."}</p></div>
        </section>
      </div>
    );
  }

  return (
    <div className="matchday-layout">
      <section className="panel matchday-main">
        <div className="matchday-score">
          <div><span>JORNADA {round}</span><strong>{mine ? Math.round(mine.points) : "—"}</strong><small>{myRank ? `Tus puntos · ${myRank}º de ${ranked.length}` : "Tus puntos"}</small></div>
          <div><span>MEDIA DE LIGA</span><strong>{average === null ? "—" : Math.round(average)}</strong><small>{mine && average !== null ? `${mine.points >= average ? "+" : ""}${Math.round(mine.points - average)} vs media` : ""}</small></div>
          <div><span>{captainEntry ? "TU CAPITÁN" : "LÍDER"}</span><strong>{captainEntry ? Math.round(captainEntry.points) : leader ? Math.round(leader.points) : "—"}</strong><small>{captainEntry?.name ?? leader?.teamName ?? "—"}</small></div>
        </div>

        <div className="matchday-stats">
          <div><span>PUNTOS TOTALES</span><strong>{Math.round(myTotal)}</strong></div>
          <div><span>POSICIÓN GENERAL</span><strong>{seasonRank || "—"}<small> / {state.members.length}</small></strong></div>
          <div><span>MEJOR JORNADA</span><strong>{Math.round(myBestRound)}</strong></div>
          <div><span>LÍDER DE LA JORNADA</span><strong className="lead-name">{leader ? (leader.memberId === myId ? "¡Tú!" : leader.teamName) : "—"}</strong></div>
        </div>

        <div className="panel-head matchday-rounds">
          <div><span className="kicker">CLASIFICACIÓN DE LA JORNADA</span><h2>Resultados por jornada</h2></div>
          <div className="head-actions">
            <select value={round ?? ""} onChange={(event) => setRound(Number(event.target.value))}>
              {rounds.slice().reverse().map((n) => <option key={n} value={n}>Jornada {n}</option>)}
            </select>
            {state.league.isAdmin && state.league.currentMatchday <= state.league.totalMatchdays && (
              <button className="button button-small" disabled={busy} onClick={simulate}><Play size={14} /> {busy ? "..." : `Disputar J${state.league.currentMatchday}`}</button>
            )}
          </div>
        </div>

        {loadingDetail && !detail ? (
          <div className="empty-mini">Cargando jornada...</div>
        ) : (
          <>
            <div className="fixture-list">
              {ranked.map((member, index) => {
                const diff = average !== null ? member.points - average : 0;
                return (
                  <article key={member.memberId} className={member.memberId === myId ? "mine clickable-row" : "clickable-row"} onClick={() => setOpenManager(member.memberId)}>
                    <time>{index + 1}º</time>
                    <div>
                      <UserAvatar name={member.teamName} color={member.color} avatarUrl={member.avatarUrl} />
                      <strong>{member.teamName}</strong>
                      <span>{member.displayName}{member.memberId === myId ? " · Tú" : ""} · ver alineación</span>
                    </div>
                    <em>{Math.round(member.points)} pts<small className={diff >= 0 ? "positive" : "negative"}>{diff >= 0 ? "+" : ""}{Math.round(diff)}</small></em>
                    <div className="md-row-stats">
                      <span><b>{member.goals}</b> ⚽</span>
                      <span><b>{member.yellow}</b> 🟨</span>
                      <span><b>{member.red}</b> 🟥</span>
                      <span><b>{member.played}/{member.startersCount}</b> jugaron</span>
                      {member.topName && <span className="md-row-top">Top: <b>{member.topName}</b> ({Math.round(member.topPoints)} pts)</span>}
                    </div>
                  </article>
                );
              })}
            </div>

            {myHistory.length > 1 && (
              <div className="matchday-evolution">
                <span className="kicker">TU EVOLUCIÓN POR JORNADA</span>
                <div className="points-bars points-bars-scroll">
                  {myHistory.map((r) => (
                    <button type="button" key={r.number} className={`points-bar ${r.number === round ? "active" : ""}`} title={`Jornada ${r.number}: ${Math.round(r.points)} pts`} onClick={() => setRound(r.number)}>
                      <i className={r.points >= 0 ? "pos" : "neg"} style={{ height: `${Math.max(4, (Math.abs(r.points) / maxHistory) * 46)}px` }} />
                      <em>{Math.round(r.points)}</em>
                      <small>J{r.number}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {leagueStats && leagueStats.jornadasPlayed > 0 && (
              <div className="matchday-records">
                <span className="kicker">ESTADÍSTICAS GENERALES DE LA LIGA</span>
                <div className="records-grid">
                  <div>
                    <small>MÁX. GOLES (EQUIPO · JORNADA)</small>
                    <strong>{leagueStats.topTeamGoals ? `${leagueStats.topTeamGoals.goals} ⚽` : "—"}</strong>
                    <span>{leagueStats.topTeamGoals ? `${leagueStats.topTeamGoals.teamName} · J${leagueStats.topTeamGoals.jornada}` : "Sin datos"}</span>
                  </div>
                  <div>
                    <small>MEJOR JUGADOR EN UNA JORNADA</small>
                    <strong>{leagueStats.bestPlayerRound ? `${Math.round(leagueStats.bestPlayerRound.points)} pts` : "—"}</strong>
                    <span>{leagueStats.bestPlayerRound ? `${leagueStats.bestPlayerRound.playerName} · ${leagueStats.bestPlayerRound.teamName} · J${leagueStats.bestPlayerRound.jornada}` : "Sin datos"}</span>
                  </div>
                  <div>
                    <small>TARJETAS EN LA LIGA</small>
                    <strong>{leagueStats.totalYellow} 🟨 · {leagueStats.totalRed} 🟥</strong>
                    <span>En {leagueStats.jornadasPlayed} jornada{leagueStats.jornadasPlayed === 1 ? "" : "s"} disputada{leagueStats.jornadasPlayed === 1 ? "" : "s"}</span>
                  </div>
                  <div>
                    <small>JORNADAS QUE HAS GANADO</small>
                    <strong>{leagueStats.myJornadasWon}<small> / {leagueStats.jornadasPlayed}</small></strong>
                    <span>{state.myMember.teamName}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <aside className="panel round-team">
        <span className="kicker">TU EQUIPO</span>
        <h2>Rendimiento · J{round}</h2>
        {mine ? (
          <>
            <div className="round-team-sub"><span>Titulares</span><strong>{Math.round(startersTotal)} pts · {scorers}/{starters.length} puntuaron</strong></div>
            {starters.map((player, index) => playerRow(player, index, mine.captainPlayerId))}
            {subs.length > 0 && <div className="round-team-sub"><span>Banquillo</span><strong>{subs.length} suplentes</strong></div>}
            {subs.map((player, index) => playerRow(player, starters.length + index, mine.captainPlayerId))}
          </>
        ) : (
          <div className="empty-mini">No tienes alineación registrada en esta jornada.</div>
        )}
      </aside>

      {openMember && (
        <div className="modal-backdrop" onMouseDown={() => setOpenManager(null)}>
          <div className="lineup-modal standings-rival-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpenManager(null)}><X /></button>
            <div className="lineup-modal-head">
              <span className="kicker">{openMember.displayName.toUpperCase()}</span>
              <h2>{openMember.teamName}</h2>
              <p>Jornada {round} · {Math.round(openMember.points)} pts · {openMember.formation}</p>
            </div>
            <div className="standings-rival-body">
              <section>
                <h3><Shirt size={15} /> Alineación</h3>
                {openStarters.length > 0 ? (
                  <div className="pitch full-pitch vertical-pitch rival-modal-pitch">
                    {openStarters.map((player, index) => (
                      <div key={player.playerId} className="pitch-player" style={{ left: `${openCoords[index]?.left ?? 50}%`, top: `${openCoords[index]?.top ?? 50}%` }}>
                        <PlayerAvatar player={player} />
                        {openMember.captainPlayerId === player.playerId && <Crown className="captain-crown" />}
                        <strong><TeamBadge player={player} />{nameAndSurname(player.name)}</strong>
                        <span>{Math.round(player.points)} pts</span>
                      </div>
                    ))}
                  </div>
                ) : <div className="empty-mini"><Shirt size={14} /> Sin alineación en esta jornada.</div>}
              </section>
              <section>
                <h3>Evolución de puntos</h3>
                {openMemberHistory.length > 0 ? (
                  <div className="points-bars points-bars-scroll">
                    {openMemberHistory.map((r) => (
                      <div key={r.number} className={`points-bar ${r.number === round ? "active" : ""}`} title={`Jornada ${r.number}: ${Math.round(r.points)} pts`}>
                        <i className={r.points >= 0 ? "pos" : "neg"} style={{ height: `${Math.max(4, (Math.abs(r.points) / openMaxHistory) * 46)}px` }} />
                        <em>{Math.round(r.points)}</em>
                        <small>J{r.number}</small>
                      </div>
                    ))}
                  </div>
                ) : <div className="empty-mini">Sin histórico todavía.</div>}
                <div className="round-results-list" style={{ marginTop: 12 }}>
                  {openMember.players.filter((p) => p.starter).map((player) => (
                    <div key={player.playerId}>
                      <b />
                      <PlayerAvatar player={player} small />
                      <span><strong><TeamBadge player={player} />{player.name}</strong><small>{player.team}</small></span>
                      <em>{Math.round(player.points)} pts</em>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type ChatMessage = { id: string; body: string; createdAt: string; userId: string; displayName: string };

export function CommunityView({ state, notify }: { state: LeagueState; notify: Notify }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatUrl = `/api/league/${state.league.id}/chat`;

  const load = useCallback(async () => {
    const result = await apiGet<{ messages: ChatMessage[] }>(chatUrl);
    if (result.ok) setMessages(result.data.messages);
  }, [chatUrl]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => { void load(); }, 5000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const result = await apiPost(chatUrl, { body: text });
    setSending(false);
    if (!result.ok) { notify(result.error, "error"); return; }
    setDraft("");
    await load();
  }

  const colorFor = (userId: string) => state.members.find((m) => m.userId === userId)?.color ?? "#65d5ff";
  const avatarFor = (userId: string) => state.members.find((m) => m.userId === userId)?.avatarUrl ?? null;

  return (
    <div className="community-layout">
      <section className="panel chat-panel">
        <div className="panel-head"><div><span className="kicker">CHAT DE LIGA</span><h2>El vestuario</h2></div><span className="online"><i /> {state.members.length} mánagers</span></div>
        <div className="messages" ref={scrollRef}>
          {messages.map((message) => (
            <div key={message.id} className={message.userId === state.user.id ? "own" : ""}>
              <UserAvatar name={message.displayName} color={colorFor(message.userId)} avatarUrl={avatarFor(message.userId)} />
              <span><strong>{message.displayName}<time>{timeAgo(message.createdAt)}</time></strong><p>{message.body}</p></span>
            </div>
          ))}
          {messages.length === 0 && <div className="empty-mini">Todavía no hay mensajes. ¡Rompe el hielo!</div>}
        </div>
        <div className="chat-input">
          <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void send()} placeholder="Escribe un mensaje..." maxLength={2000} />
          <button className="button button-small" disabled={sending} onClick={send}>Enviar</button>
        </div>
      </section>

      <aside className="panel activity-panel">
        <div className="panel-head"><div><span className="kicker">MOVIMIENTOS</span><h2>Última actividad</h2></div></div>
        <div className="activity-list">
          {state.activity.map((item) => (
            <div key={item.id}>
              <i className={item.action.startsWith("transfer") || item.action.startsWith("listing") ? "market" : item.action === "matchday_simulated" ? "points" : "admin"}>
                {item.action.startsWith("transfer") || item.action.startsWith("listing") ? <Gavel /> : item.action === "matchday_simulated" ? <Trophy /> : <Shield />}
              </i>
              <span><strong>{item.detail}</strong><small>{item.actorName ?? "Sistema"}</small></span>
              <time>{timeAgo(item.createdAt)}</time>
            </div>
          ))}
          {state.activity.length === 0 && <div className="empty-mini">Sin movimientos todavía.</div>}
        </div>
      </aside>
    </div>
  );
}
