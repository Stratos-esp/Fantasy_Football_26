"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, FastForward, Gavel, LockKeyhole, Minus, Play, Plus, RotateCcw, Shield, ThumbsDown, ThumbsUp, Users, X } from "lucide-react";
import { timeAgo } from "@/lib/client";
import type { LeagueRules, LeagueSettings, LeagueState, MarketSettings } from "@/lib/types";
import type { Notify } from "@/components/fantasy-app";
import { SettingRow, Toggle } from "@/components/ui";

type Act = (url: string, body?: unknown, method?: "POST" | "PUT") => Promise<boolean>;

// ISO -> valor para <input type="datetime-local"> en hora local.
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function AdminView({ state, act, notify }: { state: LeagueState; act: Act; notify: Notify }) {
  const [busy, setBusy] = useState(false);
  const [simCount, setSimCount] = useState(3);
  const [lockInput, setLockInput] = useState(isoToLocalInput(state.league.lineupLocksAt));

  async function saveLock(value: string) {
    setBusy(true);
    const ok = await act(`/api/league/${state.league.id}/matchday`, { locksAt: value || null }, "PUT");
    setBusy(false);
    if (ok) notify(value ? "Cierre de jornada guardado." : "Cierre de jornada quitado.");
  }

  function copyInvite() {
    void navigator.clipboard?.writeText(state.league.inviteCode);
    notify(`Código copiado: ${state.league.inviteCode}. Compártelo para invitar.`);
  }

  async function simulate() {
    if (!window.confirm(`¿Disputar la jornada ${state.league.currentMatchday}?`)) return;
    setBusy(true);
    const ok = await act(`/api/league/${state.league.id}/simulate`);
    setBusy(false);
    if (ok) notify("Jornada disputada.");
  }

  async function simulateMany() {
    if (!window.confirm(`¿Disputar ${simCount} jornada${simCount === 1 ? "" : "s"} seguidas con puntos reales?`)) return;
    setBusy(true);
    const ok = await act(`/api/league/${state.league.id}/simulate-many`, { count: simCount });
    setBusy(false);
    if (ok) notify(`Se disputaron hasta ${simCount} jornadas.`);
  }

  return (
    <div className="admin-grid">
      <section className="panel admin-summary">
        <div><Users /><span><strong>{state.members.length}</strong><small>miembros activos</small></span></div>
        <button className="invite-chip" onClick={copyInvite}><LockKeyhole /><span><strong>{state.league.inviteCode}</strong><small>código de invitación · copiar</small></span><Copy size={14} /></button>
        <div><Shield /><span><strong>J{state.league.currentMatchday}</strong><small>jornada actual</small></span></div>
      </section>

      {state.league.isAdmin && (
        <section className="panel sim-panel">
          <div className="panel-head"><div><span className="kicker">PRUEBAS · DEMO</span><h2>Simular jornadas</h2></div></div>
          <div className="sim-body">
            <p>Disputa la jornada actual o varias seguidas con los <strong>puntos reales</strong> de LaLiga, para avanzar la liga y hacer pruebas.</p>
            <div className="sim-controls">
              <button className="button button-small" disabled={busy} onClick={simulate}><Play size={14} /> Jornada {state.league.currentMatchday}</button>
              <div className="sim-many">
                <div className="stepper">
                  <button disabled={busy} onClick={() => setSimCount(Math.max(1, simCount - 1))}><Minus /></button>
                  <strong>{simCount}</strong>
                  <button disabled={busy} onClick={() => setSimCount(Math.min(38, simCount + 1))}><Plus /></button>
                </div>
                <button className="button button-small" disabled={busy} onClick={simulateMany}><FastForward size={14} /> Simular {simCount} jornadas</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {state.league.isAdmin && (
        <section className="panel">
          <div className="panel-head"><div><span className="kicker">JORNADA</span><h2>Cierre de alineaciones</h2></div></div>
          <div className="sim-body">
            <p>Fija la fecha y hora límite para cambiar alineaciones (y pagar cláusulas) en la jornada {state.league.currentMatchday}. Déjalo vacío para no poner cierre.</p>
            <div className="lock-form">
              <input type="datetime-local" value={lockInput} onChange={(event) => setLockInput(event.target.value)} />
              <button className="button button-small" disabled={busy} onClick={() => saveLock(lockInput)}>Guardar cierre</button>
              {state.league.lineupLocksAt && <button className="ghost-button" disabled={busy} onClick={() => { setLockInput(""); saveLock(""); }}>Quitar cierre</button>}
            </div>
            {state.league.lineupLocksAt && <small className="settings-help">Cierre actual: {new Date(state.league.lineupLocksAt).toLocaleString("es-ES")}</small>}
          </div>
        </section>
      )}

      <section className="panel members-panel">
        <div className="panel-head">
          <div><span className="kicker">GESTIÓN</span><h2>Miembros de la liga</h2></div>
          <button className="button button-small" onClick={copyInvite}><Plus /> Invitar</button>
        </div>
        {state.members.map((member) => (
          <div className="member-row" key={member.id}>
            <i style={{ background: member.color }}>{member.displayName.slice(0, 2).toUpperCase()}</i>
            <span><strong>{member.displayName}</strong><small>{member.teamName} · {Math.round(member.totalPoints)} pts</small></span>
            <em>{member.role === "owner" ? "Propietario" : member.role === "admin" ? "Administrador" : "Miembro"}</em>
          </div>
        ))}
      </section>

      <section className="panel audit-panel">
        <div className="panel-head">
          <div><span className="kicker">AUDITORÍA</span><h2>Historial de acciones</h2></div>
          {state.league.isAdmin && <button className="ghost-button" disabled={busy} onClick={simulate}><Play size={13} /> Disputar jornada</button>}
        </div>
        {state.activity.map((item, index) => (
          <div key={item.id}>
            <i>{index + 1}</i>
            <span><strong>{item.detail}</strong><small>{item.actorName ?? "Sistema"} · {timeAgo(item.createdAt)}</small></span>
          </div>
        ))}
        {state.activity.length === 0 && <div className="empty-mini">Las acciones de la liga quedarán registradas aquí.</div>}
      </section>
    </div>
  );
}

export function SettingsView({ state, act, notify, theme, setTheme }: { state: LeagueState; act: Act; notify: Notify; theme: string; setTheme: (theme: string) => void }) {
  const [resetText, setResetText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [teamName, setTeamName] = useState(state.myMember.teamName);
  const [savingTeam, setSavingTeam] = useState(false);
  const isAdmin = state.league.isAdmin;

  async function reset() {
    if (resetText.trim().toUpperCase() !== "REINICIAR") {
      notify("Escribe REINICIAR para confirmar.", "error");
      return;
    }
    if (!window.confirm("Última confirmación: se borrarán plantillas, puntos, mercado y chat de TODOS los miembros, y se generarán plantillas aleatorias nuevas. ¿Reiniciar la liga?")) return;
    setResetting(true);
    const ok = await act(`/api/league/${state.league.id}/reset`);
    setResetting(false);
    setResetText("");
    if (ok) notify("Liga reiniciada: nuevas plantillas aleatorias para todos.");
  }

  async function saveTeamName() {
    const next = teamName.trim().replace(/\s+/g, " ");
    if (next.length < 3 || next.length > 32) {
      notify("El nombre del equipo debe tener entre 3 y 32 caracteres.", "error");
      return;
    }
    setSavingTeam(true);
    const ok = await act(`/api/league/${state.league.id}/member`, { teamName: next }, "PUT");
    setSavingTeam(false);
    if (ok) notify("Nombre de equipo actualizado.");
  }

  const themes: [string, string][] = [["stratos", "Verde"], ["classic", "Claro suave"], ["midnight", "Noche azul"], ["sand", "Grafito cálido"]];

  return (
    <div className="settings-layout">
      <section className="panel settings-panel">
        <div className="settings-section">
          <span className="kicker">APARIENCIA</span>
          <h2>Elige tu terreno de juego</h2>
          <div className="theme-grid">
            {themes.map(([id, label]) => (
              <button key={id} className={`${id}-theme ${theme === id ? "selected" : ""}`} onClick={() => setTheme(id)}>
                <i><span /><span /></i><strong>{label}</strong>{theme === id && <Check />}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <span className="kicker">MI EQUIPO</span>
          <h2>Nombre del equipo</h2>
          <div className="team-name-form">
            <input value={teamName} onChange={(event) => setTeamName(event.target.value)} maxLength={32} placeholder="Nombre de tu equipo" />
            <button className="button button-small" disabled={savingTeam || teamName.trim() === state.myMember.teamName} onClick={saveTeamName}>
              {savingTeam ? "Guardando..." : "Guardar nombre"}
            </button>
          </div>
          <small className="settings-help">Cada miembro puede cambiar su propio nombre de equipo. Debe ser único dentro de la liga.</small>
        </div>

        <div className="settings-section">
          <span className="kicker">REGLAS DE LA LIGA</span>
          <h2>Se deciden por votación</h2>
          <small className="settings-help">Las reglas de alineación, mercado, puntuación y economía se proponen y se votan en la pestaña <strong>Normas</strong>. Cualquier miembro puede proponer un cambio y se aplica con la mayoría de la liga.</small>
        </div>

        {isAdmin && (
          <div className="settings-section danger-zone">
            <span className="kicker danger"><AlertTriangle size={12} /> ZONA PELIGROSA</span>
            <h2>Reiniciar liga</h2>
            <p>Borra plantillas, alineaciones, puntos, mercado, traspasos y chat de todos los miembros. Después se generan <strong>plantillas aleatorias nuevas</strong>, el presupuesto vuelve a {Math.round(state.league.startingBudget / 1e6)} M€ y la temporada empieza en la jornada 1. Los miembros y el código de invitación se conservan.</p>
            <div className="danger-actions">
              <input value={resetText} onChange={(event) => setResetText(event.target.value)} placeholder='Escribe "REINICIAR" para confirmar' />
              <button className="button danger" disabled={resetting || resetText.trim().toUpperCase() !== "REINICIAR"} onClick={reset}>
                <RotateCcw size={15} /> {resetting ? "Reiniciando..." : "Reiniciar liga"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

const RULE_LABELS: Record<keyof LeagueRules, string> = {
  unalignedPenalty: "Penalización por hueco",
  negativeBalancePenalty: "Penalización por saldo negativo",
  moneyPerPoint: "Dinero por punto",
  clauseLimitPerDay: "Límite de clausulazos/24h",
  clauseMinHoursBeforeLock: "Horas mín. antes del cierre",
};
const MARKET_LABELS: Record<keyof MarketSettings, string> = {
  bids: "Pujas",
  fixedPrice: "Precio fijo",
  clauses: "Cláusulas",
  directTransfers: "Traspasos",
  visibleBids: "Pujas visibles",
};
const MARKET_TEXTS: Record<keyof MarketSettings, string> = {
  bids: "Subastas diarias con ofertas ocultas",
  fixedPrice: "Compra inmediata por el precio marcado",
  clauses: "Roba jugadores pagando su cláusula",
  directTransfers: "Ofertas directas entre miembros",
  visibleBids: "Muestra cuántas pujas tiene cada jugador",
};
const onoff = (value: boolean) => (value ? "sí" : "no");

function describeSettingsChanges(a: LeagueSettings, b: LeagueSettings): string {
  const parts: string[] = [];
  (Object.keys(RULE_LABELS) as (keyof LeagueRules)[]).forEach((key) => {
    if (a.rules[key] !== b.rules[key]) parts.push(`${RULE_LABELS[key]}: ${a.rules[key]} → ${b.rules[key]}`);
  });
  if (a.captain !== b.captain) parts.push(`Capitán: ${onoff(a.captain)} → ${onoff(b.captain)}`);
  if (a.captainMultiplier !== b.captainMultiplier) parts.push(`Multiplicador capitán: x${a.captainMultiplier} → x${b.captainMultiplier}`);
  if (a.bench !== b.bench) parts.push(`Banquillo: ${onoff(a.bench)} → ${onoff(b.bench)}`);
  if (a.benchSlots !== b.benchSlots) parts.push(`Plazas de banquillo: ${a.benchSlots} → ${b.benchSlots}`);
  if (a.marketSize !== b.marketSize) parts.push(`Tamaño de mercado: ${a.marketSize} → ${b.marketSize}`);
  (Object.keys(MARKET_LABELS) as (keyof MarketSettings)[]).forEach((key) => {
    if (a.market[key] !== b.market[key]) parts.push(`${MARKET_LABELS[key]}: ${onoff(a.market[key])} → ${onoff(b.market[key])}`);
  });
  return parts.join("; ");
}

export function NormasView({ state, act, notify }: { state: LeagueState; act: Act; notify: Notify }) {
  const isAdmin = state.league.isAdmin;
  const proposalsUrl = `/api/league/${state.league.id}/proposals`;
  const [settings, setSettings] = useState<LeagueSettings>(state.league.settings);
  const rules = settings.rules;
  const [busy, setBusy] = useState(false);

  function update<K extends keyof LeagueRules>(key: K, value: LeagueRules[K]) {
    setSettings((current) => ({ ...current, rules: { ...current.rules, [key]: value } }));
  }
  function updateSetting<K extends keyof LeagueSettings>(key: K, value: LeagueSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }
  function updateMarket(key: keyof MarketSettings) {
    setSettings((current) => ({ ...current, market: { ...current.market, [key]: !current.market[key] } }));
  }

  const changes = describeSettingsChanges(state.league.settings, settings);

  async function propose() {
    if (!changes) { notify("No has cambiado ningún ajuste.", "error"); return; }
    setBusy(true);
    const ok = await act(proposalsUrl, { action: "create", summary: changes, settings });
    setBusy(false);
    if (ok) notify("Propuesta enviada a votación.");
  }

  async function vote(proposalId: string, approve: boolean) {
    setBusy(true);
    const ok = await act(proposalsUrl, { action: "vote", proposalId, approve });
    setBusy(false);
    if (ok) notify(approve ? "Has votado a favor." : "Has votado en contra.");
  }

  async function resolve(proposalId: string, action: "close" | "cancel") {
    setBusy(true);
    const ok = await act(proposalsUrl, { action, proposalId });
    setBusy(false);
    if (ok) notify(action === "close" ? "Votación cerrada." : "Propuesta retirada.");
  }

  return (
    <div className="settings-layout">
      <section className="panel settings-panel">
        <div className="settings-section">
          <span className="kicker">VOTACIÓN</span>
          <h2>Propuestas abiertas</h2>
          {state.proposals.length === 0 && <small className="settings-help">No hay propuestas en votación. Cambia una norma abajo y propón el cambio: se aprueba con la mayoría de la liga ({Math.floor(state.members.length / 2) + 1} de {state.members.length}).</small>}
          {state.proposals.map((proposal) => (
            <div className="proposal" key={proposal.id}>
              <div className="proposal-head">
                <strong>{proposal.summary}</strong>
                <small>Propuesta de {proposal.proposedByName} · {proposal.yes} a favor / {proposal.no} en contra · {proposal.total} en la liga</small>
              </div>
              <div className="proposal-actions">
                <button className={`vote-btn ${proposal.myVote === true ? "yes-on" : ""}`} disabled={busy} onClick={() => vote(proposal.id, true)}><ThumbsUp size={14} /> A favor</button>
                <button className={`vote-btn ${proposal.myVote === false ? "no-on" : ""}`} disabled={busy} onClick={() => vote(proposal.id, false)}><ThumbsDown size={14} /> En contra</button>
                {(proposal.mine || isAdmin) && <button className="ghost-button" disabled={busy} onClick={() => resolve(proposal.id, "cancel")}><X size={13} /> Retirar</button>}
                {isAdmin && <button className="ghost-button" disabled={busy} onClick={() => resolve(proposal.id, "close")}><Gavel size={13} /> Cerrar votación</button>}
              </div>
            </div>
          ))}
          {state.proposalHistory.length > 0 && (
            <div className="proposal-history">
              <span className="kicker">HISTORIAL RECIENTE</span>
              {state.proposalHistory.map((item) => (
                <div className={`proposal-hist ${item.status}`} key={item.id}>
                  <span>{item.summary}</span>
                  <em>{item.status === "approved" ? "Aprobada" : item.status === "rejected" ? "Rechazada" : "Retirada"}</em>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="settings-section">
          <span className="kicker">ALINEACIÓN</span>
          <h2>Once y banquillo</h2>
          <SettingRow title="Capitán" text="Un jugador con bonificación de puntos">
            <Toggle checked={settings.captain} onChange={() => updateSetting("captain", !settings.captain)} label="Activar capitán" />
          </SettingRow>
          {settings.captain && (
            <SettingRow title="Multiplicador del capitán" text="Se aplica sobre sus puntos de la jornada">
              <select value={settings.captainMultiplier} onChange={(event) => updateSetting("captainMultiplier", Number(event.target.value))}>
                <option value="1.25">x1,25</option><option value="1.5">x1,5</option><option value="2">x2</option>
              </select>
            </SettingRow>
          )}
          <SettingRow title="Banquillo" text="Suplentes con sustituciones automáticas">
            <Toggle checked={settings.bench} onChange={() => updateSetting("bench", !settings.bench)} label="Activar banquillo" />
          </SettingRow>
          {settings.bench && (
            <SettingRow title="Plazas de banquillo" text="Número máximo de suplentes">
              <div className="stepper">
                <button onClick={() => updateSetting("benchSlots", Math.max(1, settings.benchSlots - 1))}><Minus /></button>
                <strong>{settings.benchSlots}</strong>
                <button onClick={() => updateSetting("benchSlots", Math.min(7, settings.benchSlots + 1))}><Plus /></button>
              </div>
            </SettingRow>
          )}
        </div>

        <div className="settings-section">
          <span className="kicker">MERCADO</span>
          <h2>Sistemas permitidos</h2>
          {(["bids", "fixedPrice", "clauses", "directTransfers"] as (keyof MarketSettings)[]).map((key) => (
            <SettingRow key={key} title={MARKET_LABELS[key]} text={MARKET_TEXTS[key]}>
              <Toggle checked={settings.market[key]} onChange={() => updateMarket(key)} label={`Activar ${MARKET_LABELS[key]}`} />
            </SettingRow>
          ))}
          {settings.market.bids && (
            <SettingRow title="Pujas visibles" text={MARKET_TEXTS.visibleBids}>
              <Toggle checked={settings.market.visibleBids} onChange={() => updateMarket("visibleBids")} label="Pujas visibles" />
            </SettingRow>
          )}
          <SettingRow title="Tamaño del mercado" text="Jugadores en subasta simultánea">
            <div className="stepper">
              <button onClick={() => updateSetting("marketSize", Math.max(4, settings.marketSize - 1))}><Minus /></button>
              <strong>{settings.marketSize}</strong>
              <button onClick={() => updateSetting("marketSize", Math.min(16, settings.marketSize + 1))}><Plus /></button>
            </div>
          </SettingRow>
        </div>

        <div className="settings-section">
          <span className="kicker">PUNTUACIÓN</span>
          <h2>Penalizaciones</h2>
          <SettingRow title="Penalización por hueco sin alinear" text="Puntos que resta cada hueco de titular que dejes vacío en la jornada">
            <div className="stepper">
              <button onClick={() => update("unalignedPenalty", Math.max(-50, rules.unalignedPenalty - 1))}><Minus /></button>
              <strong>{rules.unalignedPenalty}</strong>
              <button onClick={() => update("unalignedPenalty", Math.min(0, rules.unalignedPenalty + 1))}><Plus /></button>
            </div>
          </SettingRow>
          <SettingRow title="Penalización por saldo negativo" text="Puntos que restas si terminas la jornada con el saldo en negativo">
            <div className="stepper">
              <button onClick={() => update("negativeBalancePenalty", Math.max(-100, rules.negativeBalancePenalty - 1))}><Minus /></button>
              <strong>{rules.negativeBalancePenalty}</strong>
              <button onClick={() => update("negativeBalancePenalty", Math.min(0, rules.negativeBalancePenalty + 1))}><Plus /></button>
            </div>
          </SettingRow>
        </div>

        <div className="settings-section">
          <span className="kicker">ECONOMÍA Y MERCADO</span>
          <h2>Reglas configurables</h2>
          <SettingRow title="Dinero por punto" text="Saldo que ganas por cada punto positivo que sume tu equipo en la jornada">
            <div className="rule-money">
              <input type="number" min={0} step={1000} value={rules.moneyPerPoint} onChange={(event) => update("moneyPerPoint", Math.max(0, Math.min(5_000_000, Math.round(Number(event.target.value) || 0))))} />
              <span>€</span>
            </div>
          </SettingRow>
          <SettingRow title="Límite de clausulazos por jugador" text="Máximo de cláusulas que se pueden pagar al mismo jugador cada 24h (0 = sin límite)">
            <div className="stepper">
              <button onClick={() => update("clauseLimitPerDay", Math.max(0, rules.clauseLimitPerDay - 1))}><Minus /></button>
              <strong>{rules.clauseLimitPerDay === 0 ? "∞" : rules.clauseLimitPerDay}</strong>
              <button onClick={() => update("clauseLimitPerDay", Math.min(50, rules.clauseLimitPerDay + 1))}><Plus /></button>
            </div>
          </SettingRow>
          <SettingRow title="Horas mínimas antes del cierre para clausulazos" text="No se pueden pagar cláusulas si faltan menos de estas horas para el cierre de la jornada (0 = sin límite)">
            <div className="stepper">
              <button onClick={() => update("clauseMinHoursBeforeLock", Math.max(0, rules.clauseMinHoursBeforeLock - 1))}><Minus /></button>
              <strong>{rules.clauseMinHoursBeforeLock === 0 ? "—" : `${rules.clauseMinHoursBeforeLock}h`}</strong>
              <button onClick={() => update("clauseMinHoursBeforeLock", Math.min(240, rules.clauseMinHoursBeforeLock + 1))}><Plus /></button>
            </div>
          </SettingRow>
          <small className="settings-help">Ejemplo: con 50.000 € por punto, una jornada de 40 puntos te da 2 M€. El cierre de la jornada lo fija el admin en Administración.</small>
        </div>

        <div className="settings-save">
          <span>{changes ? `Cambios: ${changes}` : "Cambia una norma para proponerla a votación."}</span>
          <button className="button" disabled={busy || !changes} onClick={propose}>{busy ? "Enviando..." : "Proponer a votación"}</button>
        </div>
      </section>
    </div>
  );
}
