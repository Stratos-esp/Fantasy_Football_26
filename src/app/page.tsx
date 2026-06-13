import Link from "next/link";
import { ArrowRight, BarChart3, Bell, Gavel, ShieldCheck, Smartphone, SlidersHorizontal, Users } from "lucide-react";
import { Brand } from "@/components/brand";

const features = [
  { icon: Gavel, title: "Mercado total", text: "Pujas, precio fijo, cláusulas y traspasos privados." },
  { icon: BarChart3, title: "Puntos automáticos", text: "Estadísticas reales de LaLiga con reglas configurables." },
  { icon: SlidersHorizontal, title: "Vuestra liga", text: "Presupuesto, plantillas, capitán, banquillo y temas a medida." },
  { icon: ShieldCheck, title: "Privada y segura", text: "Acceso por invitación, roles y un historial administrativo completo." },
];

export default function LandingPage() {
  return (
    <main className="landing">
      <nav className="landing-nav wrap">
        <Brand />
        <div className="landing-actions">
          <Link className="text-link" href="/login">Entrar</Link>
          <Link className="button button-small" href="/login">Jugar</Link>
        </div>
      </nav>

      <section className="hero wrap">
        <div className="hero-copy">
          <span className="eyebrow">LaLiga · Tu grupo · Tus reglas</span>
          <h1>El fantasy de siempre.<br /><em>A vuestra manera.</em></h1>
          <p>Crea una liga privada, ficha a los mejores y demuestra quién sabe realmente de fútbol. Sin ruido. Sin reglas impuestas.</p>
          <div className="hero-actions">
            <Link className="button" href="/login">Entrar en tu liga <ArrowRight size={18} /></Link>
            <span><Users size={17} /> Preparado para jugar con amigos</span>
          </div>
          <div className="hero-proof">
            <div><strong>4</strong><span>sistemas de mercado</span></div>
            <div><strong>100%</strong><span>configurable</span></div>
            <div><strong>38</strong><span>jornadas reales</span></div>
          </div>
        </div>

        <div className="hero-visual" aria-label="Vista previa de Fantasy">
          <div className="orb orb-one" /><div className="orb orb-two" />
          <div className="preview-card preview-main">
            <div className="preview-head"><Brand compact /><span>Jornada 32</span></div>
            <p className="micro">TU PUNTUACIÓN</p><strong className="big-score">74</strong><span className="positive">+12 sobre la media</span>
            <div className="mini-pitch">
              {["LY", "KM", "PE", "JB", "ÁB", "AB", "RL", "PC", "DC", "US"].map((p, i) => <i key={p} style={{ left: `${18 + (i % 4) * 22}%`, top: `${8 + Math.floor(i / 4) * 29}%` }}>{p}</i>)}
            </div>
          </div>
          <div className="preview-card preview-rank"><span>CLASIFICACIÓN</span><strong>1º</strong><small>Fantasy United</small></div>
          <div className="preview-card preview-bid"><Gavel size={18} /><span>Oferta ganada</span><strong>Nico Williams</strong><small>16,2 M€</small></div>
        </div>
      </section>

      <section className="features wrap">
        <div className="section-heading"><span className="eyebrow">Todo el vestuario</span><h2>Una liga seria. Aunque vosotros no lo seáis.</h2></div>
        <div className="feature-grid">{features.map(({ icon: Icon, title, text }) => <article key={title}><Icon /><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="mobile-band">
        <div className="wrap mobile-band-inner"><div><span className="eyebrow">Siempre en el bolsillo</span><h2>Diseñado primero para móvil.</h2><p>Revisa el mercado, cambia tu once y recibe avisos antes del cierre de jornada.</p><div className="band-pills"><span><Smartphone size={16} /> Instalable</span><span><Bell size={16} /> Notificaciones</span></div></div><Link className="button button-light" href="/login">Abrir Fantasy <ArrowRight size={18} /></Link></div>
      </section>
    </main>
  );
}
