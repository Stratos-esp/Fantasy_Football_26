"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [register, setRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = register
      ? { username: form.get("identifier"), email: form.get("email"), password: form.get("password"), displayName: form.get("displayName") }
      : { identifier: form.get("identifier"), password: form.get("password") };
    const response = await fetch(`/api/auth/${register ? "register" : "login"}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json(); setLoading(false);
    if (!response.ok) return setError(data.error || "No se pudo completar el acceso.");
    router.push("/app"); router.refresh();
  }

  return <main className="auth-page"><section className="auth-side"><Image className="auth-logo" src="/stratos-league.png" alt="Stratos League" width={937} height={259} priority /><div className="auth-quote"><h1>Tu liga.<br /><span>Tus reglas.</span></h1><p>Un mercado que no duerme, puntos cada jornada y todas las cuentas pendientes de vuestro grupo en un solo sitio.</p></div><small>Fantasy · LaLiga 2025/26</small></section><section className="auth-form-wrap"><form className="auth-form" onSubmit={submit}><span className="eyebrow">ACCESO PRIVADO</span><h2>{register ? "Crea tu cuenta" : "Vuelve al vestuario"}</h2><p>{register ? "Elige tu identificador. No necesitas una cuenta externa." : "Entra con tu usuario o correo y tu contraseña."}</p><label htmlFor="identifier">{register ? "USUARIO" : "USUARIO O CORREO"}</label><input id="identifier" name="identifier" autoComplete="username" required placeholder={register ? "ramon" : "ramon o tu@correo.es"} />{register && <><label htmlFor="displayName">TU NOMBRE</label><input id="displayName" name="displayName" autoComplete="name" placeholder="Ramón" /><label htmlFor="email">CORREO (OPCIONAL)</label><input id="email" name="email" type="email" autoComplete="email" placeholder="tu@correo.es" /></>}<label htmlFor="password">CONTRASEÑA</label><input id="password" name="password" type="password" minLength={8} autoComplete={register ? "new-password" : "current-password"} required placeholder="Mínimo 8 caracteres" />{error && <p style={{ color: "var(--danger)", margin: "12px 0 0" }}>{error}</p>}<button className="button" disabled={loading}>{loading ? "Entrando..." : register ? "Crear cuenta" : <>Entrar <ArrowRight size={17} /></>}</button><div className="auth-demo"><button type="button" className="text-button" onClick={() => { setRegister(!register); setError(""); }}>{register ? "Ya tengo cuenta" : "Crear un usuario y contraseña"}</button></div></form></section></main>;
}
