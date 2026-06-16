"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleDollarSign, Crown, Gavel, LockKeyhole, Play, Shield, Shirt, Trophy, X } from "lucide-react";
import { apiGet, apiPost, money, moneyInput, nameAndSurname, pitchCoordinates, positionOrder, timeAgo } from "@/lib/client";
import type { LeagueState, RivalSquadEntry } from "@/lib/types";
import type { Notify } from "@/components/fantasy-app";
import { PlayerAvatar, PositionTag, TeamBadge } from "@/components/ui";

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
            <i style={{ background: member.color }}>{member.teamName.slice(0, 2).toUpperCase()}</i>
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
                      <i style={{ background: member.color }}>{member.teamName.slice(0, 2).toUpperCase()}</i>
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

export function MatchdayView({ state, act, notify }: { state: LeagueState; act: Act; notify: Notify }) {
  const [busy, setBusy] = useState(false);
  const myId = state.myMember.id;
  const last = state.lastMatchday;
  const memberName = (id: string) => state.members.find((m) => m.id === id);

  const myPoints = last?.memberPoints.find((m) => m.memberId === myId)?.points ?? null;
  const averagePoints = last && last.memberPoints.length > 0 ? last.memberPoints.reduce((sum, m) => sum + m.points, 0) / last.memberPoints.length : null;
  const sortedRound = last ? [...last.memberPoints].sort((a, b) => b.points - a.points) : [];
  const myRoundRank = last ? sortedRound.findIndex((m) => m.memberId === myId) + 1 : null;
  const roundLeader = sortedRound[0] ? memberName(sortedRound[0].memberId) : null;
  const best = last?.myPlayerPoints.filter((p) => p.starter).sort((a, b) => b.points - a.points)[0] ?? null;

  // Histórico de mis jornadas: puntos y posición en cada una.
  const myHistory = state.roundResults
    .map((round) => {
      const ranked = [...round.memberPoints].sort((a, b) => b.points - a.points);
      const points = round.memberPoints.find((m) => m.memberId === myId)?.points ?? 0;
      return { number: round.number, points, rank: ranked.findIndex((m) => m.memberId === myId) + 1 };
    })
    .sort((a, b) => a.number - b.number);
  const myBestRound = myHistory.reduce((max, r) => Math.max(max, r.points), 0);
  const maxHistory = Math.max(6, ...myHistory.map((r) => Math.abs(r.points)));

  const seasonSorted = [...state.members].sort((a, b) => b.totalPoints - a.totalPoints);
  const seasonRank = seasonSorted.findIndex((m) => m.id === myId) + 1;
  const myTotal = state.members.find((m) => m.id === myId)?.totalPoints ?? 0;

  const captainId = state.lineup.captainPlayerId;
  const captainEntry = captainId ? last?.myPlayerPoints.find((p) => p.playerId === captainId) ?? null : null;
  const starters = (last?.myPlayerPoints ?? []).filter((p) => p.starter);
  const subs = (last?.myPlayerPoints ?? []).filter((p) => !p.starter);
  const startersTotal = starters.reduce((sum, p) => sum + p.points, 0);
  const scorers = starters.filter((p) => p.points > 0).length;

  async function simulate() {
    if (!window.confirm(`¿Disputar la jornada ${state.league.currentMatchday}? Se calcularán los puntos de todos los equipos y los valores de mercado se actualizarán.`)) return;
    setBusy(true);
    const ok = await act(`/api/league/${state.league.id}/simulate`);
    setBusy(false);
    if (ok) notify(`Jornada ${state.league.currentMatchday} disputada. ¡Mira los resultados!`);
  }

  const playerRow = (player: NonNullable<LeagueState["lastMatchday"]>["myPlayerPoints"][number], index: number) => (
    <div key={player.playerId} className={player.points > 0 ? "scored" : ""}>
      <b>{index + 1}</b>
      <PlayerAvatar player={player} small />
      <span><strong><TeamBadge player={player} />{player.name}{captainId === player.playerId ? <Crown className="captain-inline" /> : null}</strong><small>{player.team}</small></span>
      <em className={player.points > 0 ? "positive" : player.points < 0 ? "negative" : ""}>{Math.round(player.points)} pts</em>
    </div>
  );

  return (
    <div className="matchday-layout">
      <section className="panel matchday-main">
        <div className="matchday-score">
          <div><span>{last ? `JORNADA ${last.number}` : "SIN JORNADAS"}</span><strong>{myPoints === null ? "—" : Math.round(myPoints)}</strong><small>{myRoundRank ? `Tus puntos · ${myRoundRank}º de ${sortedRound.length}` : "Tus puntos"}</small></div>
          <div><span>MEDIA DE LIGA</span><strong>{averagePoints === null ? "—" : Math.round(averagePoints)}</strong><small>{myPoints !== null && averagePoints !== null ? `${myPoints >= averagePoints ? "+" : ""}${Math.round(myPoints - averagePoints)} vs media` : ""}</small></div>
          <div><span>{captainEntry ? "TU CAPITÁN" : "MEJOR JUGADOR"}</span><strong>{captainEntry ? Math.round(captainEntry.points) : best ? Math.round(best.points) : "—"}</strong><small>{captainEntry?.name ?? best?.name ?? "Aún sin datos"}</small></div>
        </div>

        <div className="matchday-stats">
          <div><span>PUNTOS TOTALES</span><strong>{Math.round(myTotal)}</strong></div>
          <div><span>POSICIÓN GENERAL</span><strong>{seasonRank || "—"}<small> / {state.members.length}</small></strong></div>
          <div><span>MEJOR JORNADA</span><strong>{myHistory.length > 0 ? Math.round(myBestRound) : "—"}</strong></div>
          <div><span>LÍDER DE LA JORNADA</span><strong className="lead-name">{roundLeader ? (roundLeader.id === myId ? "¡Tú!" : roundLeader.teamName) : "—"}</strong></div>
        </div>

        <div className="panel-head">
          <div><span className="kicker">CLASIFICACIÓN DE LA JORNADA</span><h2>{last ? `Puntos de la jornada ${last.number}` : "Todavía no se ha disputado ninguna jornada"}</h2></div>
          {state.league.isAdmin && state.league.currentMatchday <= state.league.totalMatchdays && (
            <button className="button button-small" disabled={busy} onClick={simulate}><Play size={14} /> {busy ? "Disputando..." : `Disputar jornada ${state.league.currentMatchday}`}</button>
          )}
        </div>

        {last ? (
          <>
            <div className="fixture-list">
              {sortedRound.map((row, index) => {
                const member = memberName(row.memberId);
                if (!member) return null;
                const diff = averagePoints !== null ? row.points - averagePoints : 0;
                return (
                  <article key={row.memberId} className={row.memberId === myId ? "mine" : ""}>
                    <time>{index + 1}º</time>
                    <div>
                      <i style={{ background: member.color }}>{member.teamName.slice(0, 2).toUpperCase()}</i>
                      <strong>{member.teamName}</strong>
                      <span>{member.displayName}{row.memberId === myId ? " · Tú" : ""}</span>
                    </div>
                    <em>{Math.round(row.points)} pts<small className={diff >= 0 ? "positive" : "negative"}>{diff >= 0 ? "+" : ""}{Math.round(diff)}</small></em>
                  </article>
                );
              })}
            </div>

            {myHistory.length > 1 && (
              <div className="matchday-evolution">
                <span className="kicker">TU EVOLUCIÓN POR JORNADA</span>
                <div className="points-bars points-bars-scroll">
                  {myHistory.map((r) => (
                    <div key={r.number} className="points-bar" title={`Jornada ${r.number}: ${Math.round(r.points)} pts · ${r.rank}º`}>
                      <i className={r.points >= 0 ? "pos" : "neg"} style={{ height: `${Math.max(4, (Math.abs(r.points) / maxHistory) * 46)}px` }} />
                      <em>{Math.round(r.points)}</em>
                      <small>J{r.number}</small>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state"><Trophy /><h3>La temporada está lista</h3><p>{state.league.isAdmin ? "Pulsa «Disputar jornada» para calcular los primeros puntos." : "El administrador disputará la primera jornada en breve."}</p></div>
        )}
      </section>

      <aside className="panel round-team">
        <span className="kicker">TU EQUIPO</span>
        <h2>{last ? `Rendimiento · J${last.number}` : "Rendimiento"}</h2>
        {last ? (
          <>
            <div className="round-team-sub"><span>Titulares</span><strong>{Math.round(startersTotal)} pts · {scorers}/{starters.length} puntuaron</strong></div>
            {starters.map((player, index) => playerRow(player, index))}
            {subs.length > 0 && <div className="round-team-sub"><span>Banquillo</span><strong>{subs.length} suplentes</strong></div>}
            {subs.map((player, index) => playerRow(player, starters.length + index))}
          </>
        ) : (
          <div className="empty-mini">Cuando se dispute una jornada verás aquí los puntos de cada uno de tus jugadores.</div>
        )}
      </aside>
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

  return (
    <div className="community-layout">
      <section className="panel chat-panel">
        <div className="panel-head"><div><span className="kicker">CHAT DE LIGA</span><h2>El vestuario</h2></div><span className="online"><i /> {state.members.length} mánagers</span></div>
        <div className="messages" ref={scrollRef}>
          {messages.map((message) => (
            <div key={message.id} className={message.userId === state.user.id ? "own" : ""}>
              <i style={{ background: colorFor(message.userId) }}>{message.displayName.slice(0, 2).toUpperCase()}</i>
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
