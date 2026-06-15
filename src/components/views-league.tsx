"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Crown, Gavel, Play, Shield, Trophy } from "lucide-react";
import { apiGet, apiPost, money, timeAgo } from "@/lib/client";
import type { LeagueState } from "@/lib/types";
import type { Notify } from "@/components/fantasy-app";
import { PlayerAvatar, TeamBadge } from "@/components/ui";

type Act = (url: string, body?: unknown, method?: "POST" | "PUT") => Promise<boolean>;

export function StandingsView({ state }: { state: LeagueState }) {
  const members = state.members;
  const average = members.length > 0 ? Math.round(members.reduce((sum, m) => sum + m.totalPoints, 0) / members.length) : 0;
  const topValue = Math.max(0, ...members.map((m) => m.squadValue));
  const bestRound = Math.max(0, ...members.map((m) => m.lastRoundPoints ?? 0));

  return (
    <div className="standings-layout">
      <section className="panel standings-panel">
        <div className="standings-head"><span>#</span><span>EQUIPO</span><span>JORNADA</span><span>VALOR</span><span>PUNTOS</span></div>
        {members.map((member, index) => (
          <div className={`standings-row ${member.id === state.myMember.id ? "current" : ""}`} key={member.id}>
            <b>{index + 1}</b>
            <i style={{ background: member.color }}>{member.teamName.slice(0, 2).toUpperCase()}</i>
            <span><strong>{member.teamName}</strong><small>{member.displayName}{member.id === state.myMember.id ? " · Tú" : ""}{member.role !== "member" ? " · Admin" : ""}</small></span>
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
      </aside>
    </div>
  );
}

export function MatchdayView({ state, act, notify }: { state: LeagueState; act: Act; notify: Notify }) {
  const [busy, setBusy] = useState(false);
  const last = state.lastMatchday;
  const myPoints = last?.memberPoints.find((m) => m.memberId === state.myMember.id)?.points ?? null;
  const averagePoints = last && last.memberPoints.length > 0 ? last.memberPoints.reduce((sum, m) => sum + m.points, 0) / last.memberPoints.length : null;
  const best = last?.myPlayerPoints.filter((p) => p.starter).sort((a, b) => b.points - a.points)[0] ?? null;
  const memberName = (id: string) => state.members.find((m) => m.id === id);

  async function simulate() {
    if (!window.confirm(`¿Disputar la jornada ${state.league.currentMatchday}? Se calcularán los puntos de todos los equipos y los valores de mercado se actualizarán.`)) return;
    setBusy(true);
    const ok = await act(`/api/league/${state.league.id}/simulate`);
    setBusy(false);
    if (ok) notify(`Jornada ${state.league.currentMatchday} disputada. ¡Mira los resultados!`);
  }

  return (
    <div className="matchday-layout">
      <section className="panel matchday-main">
        <div className="matchday-score">
          <div><span>{last ? `JORNADA ${last.number}` : "SIN JORNADAS"}</span><strong>{myPoints === null ? "—" : Math.round(myPoints)}</strong><small>Tus puntos</small></div>
          <div><span>MEDIA DE LIGA</span><strong>{averagePoints === null ? "—" : Math.round(averagePoints)}</strong><small>{myPoints !== null && averagePoints !== null ? `${myPoints >= averagePoints ? "+" : ""}${Math.round(myPoints - averagePoints)} puntos` : ""}</small></div>
          <div><span>MEJOR JUGADOR</span><strong>{best ? Math.round(best.points) : "—"}</strong><small>{best?.name ?? "Aún sin datos"}</small></div>
        </div>

        <div className="panel-head">
          <div><span className="kicker">RESULTADOS</span><h2>{last ? `Puntos de la jornada ${last.number}` : "Todavía no se ha disputado ninguna jornada"}</h2></div>
          {state.league.isAdmin && state.league.currentMatchday <= state.league.totalMatchdays && (
            <button className="button button-small" disabled={busy} onClick={simulate}><Play size={14} /> {busy ? "Disputando..." : `Disputar jornada ${state.league.currentMatchday}`}</button>
          )}
        </div>

        {last ? (
          <div className="fixture-list">
            {last.memberPoints.slice().sort((a, b) => b.points - a.points).map((row, index) => {
              const member = memberName(row.memberId);
              if (!member) return null;
              return (
                <article key={row.memberId}>
                  <time>{index + 1}º</time>
                  <div>
                    <i style={{ background: member.color }}>{member.teamName.slice(0, 2).toUpperCase()}</i>
                    <strong>{member.teamName}</strong>
                    <span>{member.displayName}</span>
                  </div>
                  <em>{Math.round(row.points)} pts</em>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state"><Trophy /><h3>La temporada está lista</h3><p>{state.league.isAdmin ? "Pulsa «Disputar jornada» para calcular los primeros puntos." : "El administrador disputará la primera jornada en breve."}</p></div>
        )}
      </section>

      <aside className="panel round-team">
        <span className="kicker">TU EQUIPO</span>
        <h2>{last ? `Rendimiento · J${last.number}` : "Rendimiento"}</h2>
        {(last?.myPlayerPoints ?? []).slice(0, 15).map((player, index) => (
          <div key={player.playerId}>
            <b>{index + 1}</b>
            <PlayerAvatar player={player} small />
            <span><strong><TeamBadge player={player} />{player.name}</strong><small>{player.team} · {player.starter ? "Titular" : "Banquillo"}</small></span>
            <em>{Math.round(player.points)} pts</em>
          </div>
        ))}
        {!last && <div className="empty-mini">Cuando se dispute una jornada verás aquí los puntos de cada uno de tus jugadores.</div>}
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
