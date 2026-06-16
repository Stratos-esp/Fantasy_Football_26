"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell, CalendarDays, ChevronDown, Copy, Gavel, Home, LayoutGrid, LogOut,
  MessageCircle, Search, Settings, Shield, Shirt, Trophy, X,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { apiGet, apiPost, money, timeAgo } from "@/lib/client";
import type { LeagueState, Membership } from "@/lib/types";
import { HomeView } from "@/components/views-home";
import { SquadView } from "@/components/views-squad";
import { MarketView } from "@/components/views-market";
import { CommunityView, MatchdayView, StandingsView } from "@/components/views-league";
import { AdminView, SettingsView } from "@/components/views-admin";

export type Section = "inicio" | "plantilla" | "mercado" | "clasificacion" | "jornada" | "comunidad" | "administracion" | "ajustes";
type Theme = "stratos" | "classic" | "midnight" | "sand";

type MeResponse = { user: { id: string; username: string; displayName: string }; memberships: Membership[] };

const nav = [
  { id: "inicio" as const, label: "Inicio", icon: Home },
  { id: "plantilla" as const, label: "Mi plantilla", icon: Shirt },
  { id: "mercado" as const, label: "Mercado", icon: Gavel },
  { id: "clasificacion" as const, label: "Clasificación", icon: Trophy },
  { id: "jornada" as const, label: "Jornada", icon: CalendarDays },
  { id: "comunidad" as const, label: "Comunidad", icon: MessageCircle },
];

export type Notify = (text: string, kind?: "ok" | "error") => void;

export function FantasyApp() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [bootError, setBootError] = useState("");
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [state, setState] = useState<LeagueState | null>(null);
  const [section, setSection] = useState<Section>("inicio");
  const [mobileNav, setMobileNav] = useState(false);
  const [theme, setTheme] = useState<Theme>("stratos");
  const [toast, setToast] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  const [leagueMenu, setLeagueMenu] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const notify: Notify = useCallback((text, kind = "ok") => {
    setToast({ text, kind });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("stratos-theme") as Theme | null;
    if (stored) setTheme(stored);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("stratos-theme", theme);
  }, [theme]);

  const loadMe = useCallback(async () => {
    const result = await apiGet<MeResponse>("/api/me");
    if (!result.ok) {
      if (result.status === 401) { window.location.href = "/login"; return; }
      setBootError(result.error);
      return;
    }
    setMe(result.data);
    const stored = localStorage.getItem("stratos-league");
    const memberships = result.data.memberships;
    const chosen = memberships.find((m) => m.leagueId === stored) ?? memberships[0];
    if (chosen) setLeagueId(chosen.leagueId);
  }, []);

  useEffect(() => { void loadMe(); }, [loadMe]);

  const refresh = useCallback(async () => {
    if (!leagueId) return;
    const result = await apiGet<LeagueState>(`/api/league/${leagueId}/state`);
    if (result.ok) setState(result.data);
    else if (result.status === 401) window.location.href = "/login";
    else notify(result.error, "error");
  }, [leagueId, notify]);

  useEffect(() => {
    setState(null);
    if (leagueId) {
      localStorage.setItem("stratos-league", leagueId);
      void refresh();
    }
  }, [leagueId, refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => { void refresh(); }, 60000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const act = useCallback(async (url: string, body?: unknown, method: "POST" | "PUT" = "POST") => {
    const result = await apiPost<{ ok: boolean }>(url, body, method);
    if (!result.ok) { notify(result.error, "error"); return false; }
    await refresh();
    return true;
  }, [notify, refresh]);

  async function logout() {
    await apiPost("/api/auth/logout");
    window.location.href = "/login";
  }

  async function toggleNotifications() {
    const opening = !notifOpen;
    setNotifOpen(opening);
    if (opening && state && state.unreadCount > 0) {
      await apiPost(`/api/league/${state.league.id}/notifications`);
      await refresh();
    }
  }

  function goTo(next: Section) {
    setSection(next);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const titles = useMemo<Record<Section, [string, string]>>(() => {
    const name = state?.user.displayName?.split(" ")[0] ?? "mánager";
    const matchday = state ? `Jornada ${state.league.currentMatchday} de ${state.league.totalMatchdays}` : "";
    return {
      inicio: [`Hola, ${name}`, state ? `${state.league.name} · ${matchday}` : "Cargando tu liga..."],
      plantilla: ["Mi plantilla", state ? `${state.squad.length} jugadores · Valor ${money(state.squad.reduce((sum, p) => sum + p.value, 0))}` : ""],
      mercado: ["Mercado", state ? `${state.market.length} operaciones abiertas` : ""],
      clasificacion: ["Clasificación", state ? `${state.league.name} · Temporada ${state.league.season}/${(state.league.season + 1) % 100}` : ""],
      jornada: [matchday || "Jornada", state?.lastMatchday ? `Última disputada: jornada ${state.lastMatchday.number}` : "Aún no se ha disputado ninguna jornada"],
      comunidad: ["Comunidad", "Chat y movimientos de la liga"],
      administracion: ["Administración", "Miembros, invitaciones e historial"],
      ajustes: ["Ajustes", "Tu experiencia y las reglas de la liga"],
    };
  }, [state]);

  if (bootError) {
    return <main className="app-loading"><Brand /><p>{bootError}</p><button className="button" onClick={() => window.location.reload()}>Reintentar</button></main>;
  }
  if (!me) return <main className="app-loading"><Brand /><p>Cargando...</p></main>;
  if (me.memberships.length === 0) return <LeagueGate notify={notify} onDone={loadMe} />;
  if (!state) return <main className="app-loading"><Brand /><p>Cargando tu liga...</p></main>;

  const [title, subtitle] = titles[section];
  const isAdmin = state.league.isAdmin;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
        <div className="sidebar-top"><Brand /><button className="mobile-close" onClick={() => setMobileNav(false)}><X /></button></div>
        <div className="league-picker-wrap">
          <button className="league-picker" onClick={() => setLeagueMenu((open) => !open)}>
            <span className="league-avatar">{state.league.name.slice(0, 2).toUpperCase()}</span>
            <span><small>LIGA ACTUAL</small><strong>{state.league.name}</strong></span>
            <ChevronDown />
          </button>
          {leagueMenu && (
            <div className="league-menu">
              {me.memberships.map((membership) => (
                <button key={membership.leagueId} className={membership.leagueId === leagueId ? "active" : ""} onClick={() => { setLeagueMenu(false); setLeagueId(membership.leagueId); }}>
                  <strong>{membership.leagueName}</strong><small>{membership.teamName}</small>
                </button>
              ))}
              <button className="league-menu-new" onClick={() => { setLeagueMenu(false); void navigator.clipboard?.writeText(state.league.inviteCode); notify(`Código de invitación copiado: ${state.league.inviteCode}`); }}>
                <Copy /> Copiar código de invitación
              </button>
            </div>
          )}
        </div>
        <nav className="main-nav">
          <span className="nav-label">JUEGO</span>
          {nav.map(({ id, label, icon: Icon }) => {
            const badge = id === "mercado" ? state.market.length : id === "comunidad" ? state.offersIn.length : 0;
            return <button key={id} onClick={() => goTo(id)} className={section === id ? "active" : ""}><Icon /><span>{label}</span>{badge > 0 && <i>{badge}</i>}</button>;
          })}
          <span className="nav-label second">LIGA</span>
          <button onClick={() => goTo("administracion")} className={section === "administracion" ? "active" : ""}><Shield /><span>Administración</span></button>
          <button onClick={() => goTo("ajustes")} className={section === "ajustes" ? "active" : ""}><Settings /><span>Ajustes</span></button>
        </nav>
        <div className="sidebar-footer">
          <div className="user-avatar">{state.user.displayName.slice(0, 2).toUpperCase()}</div>
          <span><strong>{state.user.displayName}</strong><small>{isAdmin ? "Administrador" : "Mánager"}</small></span>
          <button className="icon-button" onClick={logout} title="Cerrar sesión"><LogOut /></button>
        </div>
      </aside>

      {mobileNav && <button className="nav-backdrop" onClick={() => setMobileNav(false)} aria-label="Cerrar menú" />}

      <div className="app-main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav(true)}><LayoutGrid /></button>
          <div><h1>{title}</h1><p>{subtitle}</p></div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={() => goTo("mercado")}><Search /></button>
            <div className="notif-wrap">
              <button className={`icon-button ${state.unreadCount > 0 ? "notification" : ""}`} onClick={toggleNotifications}><Bell />{state.unreadCount > 0 && <i />}</button>
              {notifOpen && (
                <>
                  <button className="notif-backdrop" aria-label="Cerrar" onClick={() => setNotifOpen(false)} />
                  <div className="notif-panel">
                    <header><strong>Notificaciones</strong>{state.notifications.length > 0 && <span>{state.notifications.length}</span>}</header>
                    <div className="notif-list">
                      {state.notifications.length === 0 && <div className="empty-mini">Sin notificaciones todavía.</div>}
                      {state.notifications.map((item) => (
                        <div key={item.id} className={item.read ? "" : "unread"}>
                          <strong>{item.title}</strong>
                          {item.body && <small>{item.body}</small>}
                          <time>{timeAgo(item.createdAt)}</time>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="balance"><small>SALDO</small><strong>{money(state.myMember.budget)}</strong></div>
          </div>
        </header>

        <main className="app-content">
          {section === "inicio" && <HomeView state={state} onNavigate={goTo} />}
          {section === "plantilla" && <SquadView state={state} act={act} notify={notify} />}
          {section === "mercado" && <MarketView state={state} act={act} notify={notify} />}
          {section === "clasificacion" && <StandingsView state={state} act={act} notify={notify} />}
          {section === "jornada" && <MatchdayView state={state} act={act} notify={notify} />}
          {section === "comunidad" && <CommunityView state={state} notify={notify} />}
          {section === "administracion" && <AdminView state={state} act={act} notify={notify} />}
          {section === "ajustes" && <SettingsView state={state} act={act} notify={notify} theme={theme} setTheme={(value) => setTheme(value as Theme)} />}
        </main>
      </div>

      <nav className="bottom-nav">
        {nav.slice(0, 5).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => goTo(id)} className={section === id ? "active" : ""}><Icon /><span>{label === "Clasificación" ? "Liga" : label === "Mi plantilla" ? "Plantilla" : label}</span></button>
        ))}
      </nav>

      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}

function LeagueGate({ notify, onDone }: { notify: Notify; onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [code, setCode] = useState("");

  async function submit() {
    setBusy(true);
    const result = mode === "create"
      ? await apiPost<{ leagueId: string }>("/api/leagues", { name, teamName })
      : await apiPost<{ leagueId: string }>("/api/leagues/join", { inviteCode: code, teamName });
    setBusy(false);
    if (!result.ok) { notify(result.error, "error"); return; }
    localStorage.setItem("stratos-league", result.data.leagueId);
    notify(mode === "create" ? "Liga creada. ¡A jugar!" : "Te has unido a la liga.");
    await onDone();
  }

  return (
    <main className="gate-page">
      <Brand />
      <section className="gate-card">
        <div className="gate-tabs">
          <button className={mode === "create" ? "active" : ""} onClick={() => setMode("create")}>Crear liga</button>
          <button className={mode === "join" ? "active" : ""} onClick={() => setMode("join")}>Unirme con código</button>
        </div>
        {mode === "create" ? (
          <>
            <h2>Crea vuestra liga privada</h2>
            <p>Recibirás una plantilla aleatoria de jugadores de LaLiga y un código para invitar a tus amigos.</p>
            <label>NOMBRE DE LA LIGA</label>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Stratos League" />
          </>
        ) : (
          <>
            <h2>Únete a una liga</h2>
            <p>Pide el código de invitación al administrador de la liga.</p>
            <label>CÓDIGO DE INVITACIÓN</label>
            <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ABCD2345" />
          </>
        )}
        <label>NOMBRE DE TU EQUIPO</label>
        <input value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Stratos FC" />
        <button className="button full" disabled={busy} onClick={submit}>{busy ? "Preparando tu plantilla..." : mode === "create" ? "Crear liga" : "Unirme"}</button>
      </section>
    </main>
  );
}
