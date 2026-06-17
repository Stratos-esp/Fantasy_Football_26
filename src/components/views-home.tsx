"use client";

import { Activity, Check, Crown, Gavel, Shield, Trophy, TrendingUp, Users } from "lucide-react";
import { money, nameAndSurname, pitchCoordinates, timeAgo } from "@/lib/client";
import { formations, type LeagueState } from "@/lib/types";
import type { Section } from "@/components/fantasy-app";
import { PlayerAvatar, TeamBadge, Trend, UserAvatar } from "@/components/ui";

export function HomeView({ state, onNavigate }: { state: LeagueState; onNavigate: (section: Section) => void }) {
  const rank = state.members.findIndex((m) => m.id === state.myMember.id) + 1;
  const myMember = state.members.find((m) => m.id === state.myMember.id);
  const average = state.members.length > 0 ? Math.round(state.members.reduce((sum, m) => sum + m.totalPoints, 0) / state.members.length) : 0;
  const lastRound = myMember?.lastRoundPoints;
  const lastAverage = state.lastMatchday && state.lastMatchday.memberPoints.length > 0
    ? state.lastMatchday.memberPoints.reduce((sum, m) => sum + m.points, 0) / state.lastMatchday.memberPoints.length
    : null;
  const squadValue = state.squad.reduce((sum, p) => sum + p.value, 0);
  const playersById = new Map(state.squad.map((p) => [p.id, p]));
  // Coloca cada titular en su posición fija de la formación; los huecos vacíos
  // (por una venta o cláusula) se quedan vacíos sin descuadrar al resto.
  const shape = formations[state.lineup.formation] ?? formations["4-4-2"];
  const slotLines: [string, number][] = [["POR", 1], ["DEF", shape.DEF], ["MED", shape.MED], ["DEL", shape.DEL]];
  const byPosition: Record<string, NonNullable<ReturnType<typeof playersById.get>>[]> = { POR: [], DEF: [], MED: [], DEL: [] };
  for (const id of state.lineup.starters) {
    const player = playersById.get(id);
    if (player) byPosition[player.position]?.push(player);
  }
  const slots: (typeof state.squad[number] | null)[] = [];
  for (const [pos, n] of slotLines) {
    for (let i = 0; i < n; i += 1) slots.push(byPosition[pos][i] ?? null);
  }
  const filledStarters = slots.filter(Boolean) as typeof state.squad;
  const coordinates = pitchCoordinates(state.lineup.formation, "vertical");
  const chaser = rank === 1 && state.members.length > 1 ? state.members[1] : null;

  return (
    <div className="dashboard-grid">
      <section className="stat-row span-all">
        <article className="stat-card featured"><div><span>POSICIÓN</span><strong>{rank}<sup>º</sup></strong><small><TrendingUp /> de {state.members.length} equipos</small></div><Trophy /></article>
        <article className="stat-card"><span>PUNTOS TOTALES</span><strong>{Math.round(myMember?.totalPoints ?? 0).toLocaleString("es-ES")}</strong><small>Media de liga: {average.toLocaleString("es-ES")}</small></article>
        <article className="stat-card"><span>ÚLTIMA JORNADA</span><strong>{lastRound === null || lastRound === undefined ? "—" : Math.round(lastRound)} <small>pts</small></strong>{lastAverage !== null && lastRound !== null && lastRound !== undefined && <small className={lastRound >= lastAverage ? "positive" : ""}>{lastRound >= lastAverage ? "+" : ""}{Math.round(lastRound - lastAverage)} sobre la media</small>}</article>
        <article className="stat-card"><span>VALOR DE PLANTILLA</span><strong>{(squadValue / 1e6).toLocaleString("es-ES", { maximumFractionDigits: 1 })} <small>M€</small></strong><small className="positive">Saldo: {money(state.myMember.budget)}</small></article>
      </section>

      <section className="panel lineup-panel">
        <div className="panel-head"><div><span className="kicker">TU ONCE</span><h2>Alineación de la jornada {state.league.currentMatchday}</h2></div><button className="ghost-button" onClick={() => onNavigate("plantilla")}>Editar once</button></div>
        <div className="pitch compact-pitch vertical-pitch home-vertical-pitch">
          {slots.map((player, index) => {
            const coordinate = coordinates[index];
            const style = { left: `${coordinate?.left ?? 50}%`, top: `${coordinate?.top ?? 50}%` };
            if (!player) {
              return <button key={`empty-${index}`} className="pitch-player empty" style={style} onClick={() => onNavigate("plantilla")}><span className="empty-slot" /></button>;
            }
            return (
              <button key={player.id} className="pitch-player" style={style} onClick={() => onNavigate("plantilla")}>
                <PlayerAvatar player={player} small />
                {state.league.settings.captain && player.id === state.lineup.captainPlayerId && <Crown className="captain-crown" />}
                <strong><TeamBadge player={player} />{nameAndSurname(player.name)}</strong>
                <span>{player.lastPoints ?? "—"}</span>
              </button>
            );
          })}
        </div>
        <div className="lineup-footer">
          <span><Check /> {filledStarters.length === 11 ? "Once completo" : `Faltan ${11 - filledStarters.length} titulares`}</span>
          <span>{state.lineup.formation}</span>
          <span>Valor: {money(filledStarters.reduce((sum, p) => sum + p.value, 0))}</span>
        </div>
      </section>

      <section className="panel ranking-panel">
        <div className="panel-head"><div><span className="kicker">{state.league.name.toUpperCase()}</span><h2>Clasificación</h2></div><button className="text-button" onClick={() => onNavigate("clasificacion")}>Ver completa</button></div>
        <div className="ranking-list">
          {state.members.map((member, index) => (
            <div key={member.id} className={member.id === state.myMember.id ? "you" : ""}>
              <b>{index + 1}</b>
              <UserAvatar name={member.teamName} color={member.color} avatarUrl={member.avatarUrl} />
              <span><strong>{member.teamName}</strong><small>{member.displayName}</small></span>
              <em>{Math.round(member.totalPoints)}<small> pts</small></em>
            </div>
          ))}
        </div>
        {chaser && <div className="next-rival"><span>Próximo perseguidor</span><strong>{chaser.teamName} · a {Math.round((myMember?.totalPoints ?? 0) - chaser.totalPoints)} pts</strong></div>}
      </section>

      <section className="panel market-mini">
        <div className="panel-head"><div><span className="kicker">OPORTUNIDADES</span><h2>Mercado destacado</h2></div><button className="text-button" onClick={() => onNavigate("mercado")}>Ir al mercado</button></div>
        <div className="mini-market-list">
          {state.market.slice(0, 3).map((listing) => (
            <div key={listing.id}>
              <PlayerAvatar player={listing.player} small />
              <span><strong><TeamBadge player={listing.player} />{listing.player.name}</strong><small>{listing.player.team}</small></span>
              <div><b>{money(listing.askingPrice)}</b><Trend player={listing.player} /></div>
            </div>
          ))}
          {state.market.length === 0 && <div className="empty-mini">El mercado se repone automáticamente cada día.</div>}
        </div>
      </section>

      <section className="panel activity-panel">
        <div className="panel-head"><div><span className="kicker">EN DIRECTO</span><h2>Actividad de la liga</h2></div><Activity /></div>
        <div className="activity-list">
          {state.activity.slice(0, 6).map((item) => (
            <div key={item.id}>
              <i className={item.action.startsWith("transfer") || item.action.startsWith("listing") ? "market" : item.action === "matchday_simulated" ? "points" : "admin"}>
                {item.action.startsWith("transfer") || item.action.startsWith("listing") ? <Gavel /> : item.action === "matchday_simulated" ? <Trophy /> : <Shield />}
              </i>
              <span><strong>{item.detail}</strong><small>{item.actorName ?? "Sistema"}</small></span>
              <time>{timeAgo(item.createdAt)}</time>
            </div>
          ))}
          {state.activity.length === 0 && <div className="empty-mini"><Users size={14} /> Aquí aparecerán fichajes, pujas y cambios de reglas.</div>}
        </div>
      </section>
    </div>
  );
}
