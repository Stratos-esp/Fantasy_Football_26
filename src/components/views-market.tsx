"use client";

import { useMemo, useState } from "react";
import { Activity, Check, CircleDollarSign, Gavel, Landmark, ListFilter, LockKeyhole, Search, Tag, X } from "lucide-react";
import { Crown, Shirt } from "lucide-react";
import { countdown, money, moneyInput, nameAndSurname, pitchCoordinates } from "@/lib/client";
import type { LeagueState, MarketListing, RivalSquadEntry, SquadEntry } from "@/lib/types";
import type { Notify } from "@/components/fantasy-app";
import { PlayerAvatar, PositionTag, TeamBadge, Trend } from "@/components/ui";
import { PlayerModal } from "@/components/player-modal";

const tabHelp: Record<string, string> = {
  subastas: "Subastas diarias de la liga. Tu puja es secreta: gana la más alta al cierre.",
  ventas: "Vende tus jugadores al mercado al instante o ponlos a precio fijo para tus rivales.",
  rivales: "Mira las plantillas rivales. Paga su cláusula o envía una oferta directa.",
  operaciones: "Tus pujas, ofertas enviadas y ofertas recibidas pendientes de respuesta.",
};

type Act = (url: string, body?: unknown, method?: "POST" | "PUT") => Promise<boolean>;
type Tab = "subastas" | "ventas" | "rivales" | "operaciones";

export function MarketView({ state, act, notify }: { state: LeagueState; act: Act; notify: Notify }) {
  const [tab, setTab] = useState<Tab>("subastas");
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("TODOS");
  const [bidTarget, setBidTarget] = useState<MarketListing | null>(null);
  const [offerTarget, setOfferTarget] = useState<RivalSquadEntry | null>(null);
  const [listTarget, setListTarget] = useState<SquadEntry | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [lineupRival, setLineupRival] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const marketUrl = `/api/league/${state.league.id}/market`;
  const myBids = state.market.filter((listing) => listing.myBid !== null);
  const nextClose = state.market.filter((l) => l.closesAt).map((l) => l.closesAt!).sort()[0] ?? null;

  const filteredMarket = useMemo(() => state.market.filter((listing) => {
    const matches = `${listing.player.name} ${listing.player.team}`.toLowerCase().includes(query.toLowerCase());
    return matches && (position === "TODOS" || listing.player.position === position);
  }), [state.market, query, position]);

  async function run(body: unknown, message?: string) {
    setBusy(true);
    const ok = await act(marketUrl, body);
    setBusy(false);
    if (ok && message) notify(message);
    return ok;
  }

  async function confirmBid() {
    if (!bidTarget) return;
    const value = moneyInput(amount);
    if (!value) { notify("Indica una cantidad válida en millones.", "error"); return; }
    if (await run({ action: "bid", listingId: bidTarget.id, amount: value }, "Puja registrada. Se resuelve al cierre.")) {
      setBidTarget(null); setAmount("");
    }
  }

  async function confirmOffer() {
    if (!offerTarget) return;
    const value = moneyInput(amount);
    if (!value) { notify("Indica una cantidad válida en millones.", "error"); return; }
    if (await run({ action: "makeOffer", playerId: offerTarget.id, amount: value }, "Oferta enviada al mánager.")) {
      setOfferTarget(null); setAmount("");
    }
  }

  async function confirmList() {
    if (!listTarget) return;
    const value = moneyInput(amount);
    if (!value) { notify("Indica un precio válido en millones.", "error"); return; }
    if (await run({ action: "listFixed", playerId: listTarget.id, amount: value }, "Jugador publicado en el mercado.")) {
      setListTarget(null); setAmount("");
    }
  }

  const memberName = (memberId: string) => state.members.find((m) => m.id === memberId)?.teamName ?? "—";

  return (
    <div>
      <div className="tabs">
        {([
          ["subastas", "Mercado", state.market.length],
          ["ventas", "Mis ventas", state.myListings.length],
          ["rivales", "Rivales", 0],
          ["operaciones", "Operaciones", myBids.length + state.offersIn.length + state.offersOut.length],
        ] as [Tab, string, number][]).map(([id, label, badge]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}{badge > 0 && <i>{badge}</i>}</button>
        ))}
      </div>

      <p className="tab-help">{tabHelp[tab]}</p>

      <div className="market-summary">
        <div><Gavel /><span><small>TUS PUJAS ACTIVAS</small><strong>{myBids.length}</strong></span></div>
        <div><Landmark /><span><small>SALDO DISPONIBLE</small><strong>{money(state.myMember.budget)}</strong></span></div>
        <div><Activity /><span><small>PRÓXIMO CIERRE</small><strong>{countdown(nextClose)}</strong></span></div>
      </div>

      {tab === "subastas" && (
        <>
          <div className="market-toolbar">
            <label className="search-box"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar jugador o equipo" /></label>
            <div className="filter-chips"><ListFilter />{["TODOS", "POR", "DEF", "MED", "DEL"].map((item) => <button key={item} onClick={() => setPosition(item)} className={position === item ? "active" : ""}>{item}</button>)}</div>
          </div>
          <section className="market-grid">
            {filteredMarket.map((listing) => (
              <article className={`market-card ${listing.myBid !== null ? "bidding" : ""}`} key={listing.id}>
                {listing.kind === "bid" && <span className="card-countdown" title="Cierre de la subasta">{countdown(listing.closesAt)}</span>}
                <button className="market-card-id" onClick={() => setDetailId(listing.player.id)}>
                  <div className="market-card-top"><PlayerAvatar player={listing.player} /><PositionTag position={listing.player.position} /><Trend player={listing.player} /></div>
                  <h3><TeamBadge player={listing.player} />{listing.player.name}</h3>
                  <p>{listing.player.team}</p>
                </button>
                <div className="player-stats">
                  <span><small>{listing.kind === "bid" ? "PUJA MÍN." : "PRECIO"}</small><strong>{money(listing.askingPrice)}</strong></span>
                  <span><small>PUNTOS</small><strong>{Math.round(listing.player.seasonPoints)}</strong></span>
                  <span><small>{listing.kind === "bid" ? "PUJAS" : "VENDE"}</small><strong>{listing.kind === "bid" ? listing.bidCount : (listing.sellerName ?? "Liga")}</strong></span>
                </div>
                {listing.kind === "bid" ? (
                  listing.myBid !== null
                    ? <button className="bid-done" onClick={() => { setBidTarget(listing); setAmount(String(listing.myBid! / 1e6)); }}><Check /> Tu puja: {money(listing.myBid)} · cambiar</button>
                    : <button className="button full" disabled={!state.league.settings.market.bids} onClick={() => { setBidTarget(listing); setAmount(""); }}>Pujar <Gavel size={16} /></button>
                ) : (
                  <button className="button full" disabled={busy || !state.league.settings.market.fixedPrice} onClick={async () => {
                    if (window.confirm(`¿Comprar a ${listing.player.name} por ${money(listing.askingPrice)}?`)) await run({ action: "buyFixed", listingId: listing.id }, "¡Fichaje completado!");
                  }}>Comprar ya <Tag size={15} /></button>
                )}
                <small className="market-owner">{listing.kind === "bid" ? "Puja secreta · gana la más alta al cierre" : `Venta directa de ${listing.sellerName ?? "la liga"}`}</small>
              </article>
            ))}
          </section>
          {filteredMarket.length === 0 && <div className="empty-state"><Search /><h3>No hay jugadores que coincidan</h3><p>El mercado se repone cada día con nuevas subastas.</p></div>}
        </>
      )}

      {tab === "ventas" && (
        <div className="market-columns">
          <section className="panel">
            <div className="panel-head"><div><span className="kicker">TU PLANTILLA</span><h2>Vender jugadores</h2></div></div>
            <div className="sell-list">
              {state.squad.map((player) => (
                <div className="sell-row" key={player.id}>
                  <PlayerAvatar player={player} small />
                  <span><strong><TeamBadge player={player} />{player.name}</strong><small>{player.position} · {player.team} · Cláusula {player.clauseValue ? money(player.clauseValue) : "—"}</small></span>
                  <em>{money(player.value)}</em>
                  <div className="row-actions">
                    <button className="ghost-button" disabled={busy} onClick={async () => {
                      if (window.confirm(`¿Vender a ${player.name} al mercado por ${money(player.value)}? La operación es inmediata.`)) await run({ action: "sellToMarket", playerId: player.id }, "Jugador vendido al mercado.");
                    }}>Vender ya</button>
                    <button className="ghost-button" disabled={!state.league.settings.market.fixedPrice} onClick={() => { setListTarget(player); setAmount(String(player.value / 1e6)); }}>Precio fijo</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><div><span className="kicker">EN VENTA</span><h2>Tus anuncios</h2></div></div>
            <div className="sell-list">
              {state.myListings.map((listing) => (
                <div className="sell-row" key={listing.id}>
                  <PlayerAvatar player={listing.player} small />
                  <span><strong><TeamBadge player={listing.player} />{listing.player.name}</strong><small>Precio fijo</small></span>
                  <em>{money(listing.askingPrice)}</em>
                  <div className="row-actions">
                    <button className="ghost-button" disabled={busy} onClick={() => run({ action: "unlist", listingId: listing.id }, "Anuncio retirado.")}>Retirar</button>
                  </div>
                </div>
              ))}
              {state.myListings.length === 0 && <div className="empty-mini">No tienes jugadores en venta. Publica uno a precio fijo y los demás podrán comprarlo al instante.</div>}
            </div>
          </section>
        </div>
      )}

      {tab === "rivales" && (
        <div className="rivals-grid">
          {state.members.filter((member) => member.id !== state.myMember.id).map((member) => {
            const squad = state.rivalSquads.filter((player) => player.memberId === member.id);
            return (
              <section className="panel" key={member.id}>
                <div className="panel-head">
                  <div><span className="kicker">{member.displayName.toUpperCase()}</span><h2>{member.teamName}</h2></div>
                  <button className="ghost-button" onClick={() => setLineupRival(member.id)}><Shirt size={13} /> Alineación</button>
                </div>
                <div className="sell-list">
                  {squad.map((player) => (
                    <div className="sell-row" key={player.id}>
                      <button className="sell-row-id" onClick={() => setDetailId(player.id)}>
                        <PlayerAvatar player={player} small />
                        <span><strong><TeamBadge player={player} />{player.name}</strong><small>{player.position} · {player.team}</small></span>
                      </button>
                      <em>{money(player.value)}</em>
                      <div className="row-actions">
                        {state.league.settings.market.clauses && player.clauseValue !== null && (
                          <button className="ghost-button danger" disabled={busy || player.clauseValue > state.myMember.budget} title={player.clauseValue > state.myMember.budget ? "Saldo insuficiente" : ""} onClick={async () => {
                            if (window.confirm(`¿Pagar la cláusula de ${player.name} (${money(player.clauseValue!)})? El traspaso es inmediato.`)) await run({ action: "payClause", playerId: player.id }, "¡Cláusula pagada! El jugador ya es tuyo.");
                          }}><LockKeyhole size={13} /> {money(player.clauseValue)}</button>
                        )}
                        {state.league.settings.market.directTransfers && (
                          <button className="ghost-button" onClick={() => { setOfferTarget(player); setAmount(String(player.value / 1e6)); }}>Ofertar</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {tab === "operaciones" && (
        <div className="market-columns">
          <section className="panel">
            <div className="panel-head"><div><span className="kicker">RECIBIDAS</span><h2>Ofertas por tus jugadores</h2></div></div>
            <div className="sell-list">
              {state.offersIn.map((offer) => (
                <div className="sell-row" key={offer.id}>
                  <PlayerAvatar player={offer.player} small />
                  <span><strong><TeamBadge player={offer.player} />{offer.player.name}</strong><small>{offer.fromName} ofrece <b>{money(offer.amount)}</b> (valor {money(offer.player.value)})</small></span>
                  <div className="row-actions">
                    <button className="button button-small" disabled={busy} onClick={() => run({ action: "respondOffer", offerId: offer.id, accept: true }, "Traspaso completado.")}>Aceptar</button>
                    <button className="ghost-button" disabled={busy} onClick={() => run({ action: "respondOffer", offerId: offer.id, accept: false }, "Oferta rechazada.")}>Rechazar</button>
                  </div>
                </div>
              ))}
              {state.offersIn.length === 0 && <div className="empty-mini">Nadie ha ofertado por tus jugadores todavía.</div>}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><div><span className="kicker">ENVIADAS</span><h2>Tus pujas y ofertas</h2></div></div>
            <div className="sell-list">
              {myBids.map((listing) => (
                <div className="sell-row" key={listing.id}>
                  <PlayerAvatar player={listing.player} small />
                  <span><strong><TeamBadge player={listing.player} />{listing.player.name}</strong><small>Puja: {money(listing.myBid!)} · cierra en {countdown(listing.closesAt)}</small></span>
                  <div className="row-actions">
                    <button className="ghost-button" onClick={() => { setBidTarget(listing); setAmount(String(listing.myBid! / 1e6)); }}>Cambiar</button>
                    <button className="ghost-button" disabled={busy} onClick={() => run({ action: "cancelBid", listingId: listing.id }, "Puja retirada.")}>Retirar</button>
                  </div>
                </div>
              ))}
              {state.offersOut.map((offer) => (
                <div className="sell-row" key={offer.id}>
                  <PlayerAvatar player={offer.player} small />
                  <span><strong><TeamBadge player={offer.player} />{offer.player.name}</strong><small>Oferta a {offer.toName}: {money(offer.amount)}</small></span>
                  <div className="row-actions">
                    <button className="ghost-button" disabled={busy} onClick={() => run({ action: "cancelOffer", offerId: offer.id }, "Oferta cancelada.")}>Cancelar</button>
                  </div>
                </div>
              ))}
              {myBids.length === 0 && state.offersOut.length === 0 && <div className="empty-mini">No tienes pujas ni ofertas activas.</div>}
            </div>
          </section>
        </div>
      )}

      {(bidTarget || offerTarget || listTarget) && (
        <div className="modal-backdrop" onMouseDown={() => { setBidTarget(null); setOfferTarget(null); setListTarget(null); }}>
          <div className="bid-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => { setBidTarget(null); setOfferTarget(null); setListTarget(null); }}><X /></button>
            {(() => {
              const player = bidTarget?.player ?? offerTarget ?? listTarget!;
              return <>
                <PlayerAvatar player={player} />
                <PositionTag position={player.position} />
                <h2><TeamBadge player={player} />{player.name}</h2>
                <p>{player.team} · Valor {money(player.value)}</p>
              </>;
            })()}
            <label>{bidTarget ? `TU PUJA (MÍNIMO ${(bidTarget.askingPrice / 1e6).toLocaleString("es-ES", { maximumFractionDigits: 1 })})` : offerTarget ? "TU OFERTA" : "PRECIO DE VENTA"}</label>
            <div className="money-input">
              <input autoFocus inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,0" />
              <span>M€</span>
            </div>
            <small>Saldo disponible: {money(state.myMember.budget)}</small>
            <button className="button full" disabled={busy} onClick={bidTarget ? confirmBid : offerTarget ? confirmOffer : confirmList}>
              {bidTarget ? <>Confirmar puja <Gavel size={17} /></> : offerTarget ? <>Enviar oferta <CircleDollarSign size={17} /></> : <>Publicar venta <Tag size={16} /></>}
            </button>
          </div>
        </div>
      )}

      {detailId && <PlayerModal leagueId={state.league.id} playerId={detailId} onClose={() => setDetailId(null)} />}

      {lineupRival && (() => {
        const member = state.members.find((m) => m.id === lineupRival);
        const rl = state.rivalLineups.find((l) => l.memberId === lineupRival);
        const squad = state.rivalSquads.filter((p) => p.memberId === lineupRival);
        const byId = new Map(squad.map((p) => [p.id, p]));
        const coords = rl ? pitchCoordinates(rl.formation) : [];
        return (
          <div className="modal-backdrop" onMouseDown={() => setLineupRival(null)}>
            <div className="lineup-modal" onMouseDown={(event) => event.stopPropagation()}>
              <button className="modal-close" onClick={() => setLineupRival(null)}><X /></button>
              <div className="lineup-modal-head"><span className="kicker">{member?.displayName.toUpperCase()}</span><h2>{member?.teamName}</h2><p>{rl ? `${rl.formation} · ${Math.round(member?.totalPoints ?? 0)} pts` : "Sin alineación esta jornada"}</p></div>
              {rl && rl.starters.length > 0 ? (
                <div className="pitch full-pitch rival-pitch">
                  {rl.starters.map((id, index) => {
                    const player = byId.get(id);
                    if (!player) return null;
                    return (
                      <div key={id} className="pitch-player" style={{ left: `${coords[index]?.left ?? 50}%`, top: `${coords[index]?.top ?? 50}%` }}>
                        <PlayerAvatar player={player} />
                        {state.league.settings.captain && id === rl.captainPlayerId && <Crown className="captain-crown" />}
                        <strong><TeamBadge player={player} />{nameAndSurname(player.name)}</strong>
                        <span>{money(player.value)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : <div className="empty-state"><Shirt /><h3>Sin alineación</h3><p>Este mánager aún no ha puesto su once para la jornada actual.</p></div>}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
