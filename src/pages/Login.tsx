import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

const DISPLAY = { fontFamily: "'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif" };

/** Tarjetas de ejemplo (decorativas) que ilustran la comparación de planes. */
function Tarjeta({ nombre, plan, precio, estrella, className }: { nombre: string; plan: string; precio: string; estrella?: boolean; className: string }) {
  return (
    <div
      className={`login-flota absolute w-64 rounded-2xl border border-white/15 bg-white/[0.07] p-4 shadow-2xl backdrop-blur ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-teal-200/80">{nombre}</span>
        {estrella && <span className="text-sm text-amber-300">★</span>}
      </div>
      <p className="mt-1 text-sm text-white/70">{plan}</p>
      <p className="mt-3 text-3xl font-extrabold text-white" style={DISPLAY}>
        {precio}
        <span className="ml-1 text-sm font-medium text-white/50">/mes</span>
      </p>
      <div className="mt-3 flex gap-1.5">
        {["HCM", "VIA", "FUN"].map((c) => (
          <span key={c} className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/70">
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Login() {
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (session) return <Navigate to="/" replace />;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError("Correo o contraseña incorrectos.");
    setEnviando(false);
  };

  const campo =
    "mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-white placeholder-white/30 outline-none transition focus:border-teal-300 focus:bg-white/10 focus:ring-4 focus:ring-teal-300/10";

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 text-white sm:p-8"
      style={{ background: "radial-gradient(1200px 700px at 15% 10%, #0f4c5c 0%, transparent 60%), radial-gradient(900px 600px at 95% 90%, #1d3b8b 0%, transparent 55%), #071a24" }}
    >
      {/* cuadrícula sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }}
      />

      <div className="relative grid w-full max-w-[1040px] overflow-hidden rounded-3xl border border-white/10 bg-[#071a24]/60 shadow-2xl backdrop-blur-sm lg:min-h-[600px] lg:grid-cols-2">
      {/* Lado de marca */}
      <section className="relative hidden flex-col justify-between border-r border-white/5 bg-teal-300/[0.03] p-10 lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-300 text-lg font-black text-teal-950" style={DISPLAY}>
            C
          </span>
          <span className="text-sm font-semibold tracking-wide text-white/80">Cotizador de Seguros</span>
        </div>

        <div className="relative my-8 h-[340px]">
          <Tarjeta nombre="Opción A" plan="Salud Integral · $100.000" precio="$65" className="left-0 top-4 [--r:-4deg]" />
          <Tarjeta nombre="Opción B" plan="Salud Plus · $100.000" precio="$57" estrella className="left-44 top-24 [--r:2deg] [animation-delay:-2s]" />
          <Tarjeta nombre="Opción C" plan="Salud Global · $250.000" precio="$91" className="left-16 top-52 [--r:-1deg] [animation-delay:-4s]" />
        </div>

        <div>
          <h2 className="max-w-lg text-5xl font-extrabold leading-[1.05]" style={DISPLAY}>
            Compara planes.
            <br />
            <span className="text-teal-300">Cierra más rápido.</span>
          </h2>
          <p className="mt-4 max-w-md text-white/60">
            Todas tus aseguradoras, tarifas y cuotas en un solo lugar, listas para enviar al cliente en minutos.
          </p>
        </div>
      </section>

      {/* Formulario */}
      <main className="relative flex items-center justify-center p-6 lg:p-10">
        <form
          onSubmit={enviar}
          className="w-full max-w-sm space-y-5"
        >
          <div className="flex items-center gap-3 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-300 font-black text-teal-950" style={DISPLAY}>
              C
            </span>
            <span className="text-sm font-semibold text-white/80">Cotizador de Seguros</span>
          </div>

          <div>
            <h1 className="text-3xl font-extrabold" style={DISPLAY}>
              Bienvenido de nuevo
            </h1>
            <p className="mt-1 text-sm text-white/55">Ingresa con tu cuenta de asesor.</p>
          </div>

          <label className="block text-sm">
            <span className="text-white/70">Correo</span>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={campo}
            />
          </label>

          <label className="block text-sm">
            <span className="text-white/70">Contraseña</span>
            <div className="relative">
              <input
                type={ver ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${campo} pr-16`}
              />
              <button
                type="button"
                onClick={() => setVer(!ver)}
                className="absolute right-3 top-1/2 mt-[3px] -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-white/50 hover:text-white"
                aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {ver ? "Ocultar" : "Ver"}
              </button>
            </div>
          </label>

          {error && (
            <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-xl bg-teal-300 px-4 py-3 font-bold text-teal-950 transition hover:bg-teal-200 focus:outline-none focus:ring-4 focus:ring-teal-300/30 disabled:opacity-60"
          >
            {enviando ? "Ingresando…" : "Ingresar →"}
          </button>

          <p className="text-center text-xs text-white/40">¿Sin acceso? Pídele a tu administrador que active tu cuenta.</p>
        </form>
      </main>
      </div>
    </div>
  );
}
