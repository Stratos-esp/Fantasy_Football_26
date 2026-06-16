"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, FastForward, LockKeyhole, Minus, Play, Plus, RotateCcw, Shield, Users } from "lucide-react";
import { timeAgo } from "@/lib/client";
import type { LeagueSettings, LeagueState } from "@/lib/types";
import type { Notify } from "@/components/fantasy-app";
import { SettingRow, Toggle } from "@/components/ui";

type Act = (url: string, body?: unknown, method?: "POST" | "PUT") => Promise<boolean>;

export function AdminView({ state, act, notify }: { state: LeagueState; act: Act; notify: Notify }) {
  const [busy, setBusy] = useState(false);
  const [simCount, setSimCount] = useState(3);

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
  const [settings, setSettings] = useState<LeagueSettings>(state.league.settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resetText, setResetText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [teamName, setTeamName] = useState(state.myMember.teamName);
  const [savingTeam, setSavingTeam] = useState(false);
  const isAdmin = state.league.isAdmin;

  function update<K extends keyof LeagueSettings>(key: K, value: LeagueSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }
  function updateMarket(key: keyof LeagueSettings["market"]) {
    setSettings((current) => ({ ...current, market: { ...current.market, [key]: !current.market[key] } }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    const ok = await act(`/api/league/${state.league.id}/settings`, { settings }, "PUT");
    setSaving(false);
    if (ok) { setSaved(true); notify("Reglas de la liga guardadas."); }
  }

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
  const marketRows: [keyof LeagueSettings["market"], string, string][] = [
    ["bids", "Pujas", "Subastas diarias con ofertas ocultas"],
    ["fixedPrice", "Precio fijo", "Compra inmediata por el precio marcado"],
    ["clauses", "Cláusulas", "Roba jugadores pagando su cláusula"],
    ["directTransfers", "Traspasos", "Ofertas directas entre miembros"],
  ];

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
          <span className="kicker">ALINEACIÓN</span>
          <h2>Once y banquillo {!isAdmin && <small className="settings-readonly">(solo lectura)</small>}</h2>
          <SettingRow title="Capitán" text="Un jugador con bonificación de puntos">
            <Toggle checked={settings.captain} disabled={!isAdmin} onChange={() => update("captain", !settings.captain)} label="Activar capitán" />
          </SettingRow>
          {settings.captain && (
            <SettingRow title="Multiplicador del capitán" text="Se aplica sobre sus puntos de la jornada">
              <select value={settings.captainMultiplier} disabled={!isAdmin} onChange={(event) => update("captainMultiplier", Number(event.target.value))}>
                <option value="1.25">x1,25</option><option value="1.5">x1,5</option><option value="2">x2</option>
              </select>
            </SettingRow>
          )}
          <SettingRow title="Banquillo" text="Suplentes con sustituciones automáticas">
            <Toggle checked={settings.bench} disabled={!isAdmin} onChange={() => update("bench", !settings.bench)} label="Activar banquillo" />
          </SettingRow>
          {settings.bench && (
            <SettingRow title="Plazas de banquillo" text="Número máximo de suplentes">
              <div className="stepper">
                <button disabled={!isAdmin} onClick={() => update("benchSlots", Math.max(1, settings.benchSlots - 1))}><Minus /></button>
                <strong>{settings.benchSlots}</strong>
                <button disabled={!isAdmin} onClick={() => update("benchSlots", Math.min(7, settings.benchSlots + 1))}><Plus /></button>
              </div>
            </SettingRow>
          )}
        </div>

        <div className="settings-section">
          <span className="kicker">MERCADO</span>
          <h2>Sistemas permitidos</h2>
          {marketRows.map(([key, title, text]) => (
            <SettingRow key={key} title={title} text={text}>
              <Toggle checked={settings.market[key]} disabled={!isAdmin} onChange={() => updateMarket(key)} label={`Activar ${title}`} />
            </SettingRow>
          ))}
          {settings.market.bids && (
            <SettingRow title="Pujas visibles" text="Muestra cuántas pujas ha recibido cada jugador del mercado">
              <Toggle checked={settings.market.visibleBids} disabled={!isAdmin} onChange={() => updateMarket("visibleBids")} label="Pujas visibles" />
            </SettingRow>
          )}
          <SettingRow title="Tamaño del mercado" text="Jugadores en subasta simultánea">
            <div className="stepper">
              <button disabled={!isAdmin} onClick={() => update("marketSize", Math.max(4, settings.marketSize - 1))}><Minus /></button>
              <strong>{settings.marketSize}</strong>
              <button disabled={!isAdmin} onClick={() => update("marketSize", Math.min(16, settings.marketSize + 1))}><Plus /></button>
            </div>
          </SettingRow>
        </div>

        {isAdmin && (
          <div className="settings-save">
            <span>Los cambios de reglas quedan registrados en el historial.</span>
            <button className="button" disabled={saving} onClick={save}>{saved ? <><Check /> Guardado</> : saving ? "Guardando..." : "Guardar cambios"}</button>
          </div>
        )}

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
