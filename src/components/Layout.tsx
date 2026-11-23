import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import Avatar from "./Avatar";
import BuscadorGlobal from "./BuscadorGlobal";

const clase = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm ${
    isActive ? "bg-indigo-500/20 text-indigo-300" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
  }`;

export default function Layout({ children }: { children: ReactNode }) {
  const { perfil, signOut } = useAuth();
  const { pathname } = useLocation();
  const [abierto, setAbierto] = useState(false);
  const [tema, setTema] = useState<"oscuro" | "claro">(() => {
    try {
      return localStorage.getItem("tema") === "claro" ? "claro" : "oscuro";
    } catch {
      return "oscuro";
    }
  });
  const cambiarTema = () => {
    const nuevo = tema === "claro" ? "oscuro" : "claro";
    setTema(nuevo);
    try {
      localStorage.setItem("tema", nuevo);
    } catch {
      /* sin almacenamiento: el tema vale solo para esta sesión */
    }
  };
  const nombre = [perfil?.nombre, perfil?.apellido].filter(Boolean).join(" ") || "Usuario";
  const esAdmin = perfil?.rol === "admin";

  // En móvil y tableta el menú es un panel que se cierra al navegar
  useEffect(() => setAbierto(false), [pathname]);

  return (
    <div className={`min-h-screen lg:flex ${tema === "claro" ? "claro" : ""}`}>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-3 print:hidden lg:hidden">
        <button
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-lg leading-none"
        >
          ☰
        </button>
        <p className="font-semibold">{nombre}</p>
        <NavLink to="/cotizaciones/nueva" className="rounded-lg bg-indigo-500/20 px-3 py-1.5 text-sm text-indigo-200">
          + Cotizar
        </NavLink>
      </header>

      {abierto && (
        <div
          className="fixed inset-0 z-40 bg-black/60 print:hidden lg:hidden"
          onClick={() => setAbierto(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto border-r border-zinc-800 bg-zinc-900 p-4 transition-transform print:hidden lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:translate-x-0 ${
          abierto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar url={perfil?.avatar_url ?? null} nombre={nombre} tam="h-12 w-12 text-base" />
            <div>
              <p className="text-xs text-zinc-500">Hola de nuevo,</p>
              <p className="text-lg font-semibold leading-tight">{perfil?.nombre || nombre}</p>
              <p className="text-xs text-zinc-500">{esAdmin ? "Administrador" : "Asesor"}</p>
            </div>
          </div>
          <button
            onClick={() => setAbierto(false)}
            aria-label="Cerrar menú"
            className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-zinc-800 lg:hidden"
          >
            ✕
          </button>
        </div>

        <nav className="space-y-1">
          <NavLink
            to="/cotizaciones/nueva"
            className="block rounded-lg bg-indigo-500/20 px-3 py-2 text-sm text-indigo-200 hover:bg-indigo-500/30"
          >
            + Nueva cotización
          </NavLink>
          <NavLink to="/" end className={clase}>
            Dashboard
          </NavLink>
          <NavLink to="/cotizaciones" end className={clase}>
            Cotizaciones
          </NavLink>
          <NavLink to="/clientes" className={clase}>
            Clientes
          </NavLink>
          <NavLink to="/aseguradoras" className={clase}>
            Aseguradoras
          </NavLink>
          <NavLink to="/perfil" className={clase}>
            Mi perfil
          </NavLink>
          {esAdmin && (
            <>
              <NavLink to="/tarifario" className={clase}>
                Tarifario
              </NavLink>
              <NavLink to="/usuarios" className={clase}>
                Usuarios
              </NavLink>
              <NavLink to="/configuracion" className={clase}>
                Configuración
              </NavLink>
            </>
          )}
        </nav>

        <button
          onClick={signOut}
          className="mt-auto flex items-center gap-2.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-left text-sm font-semibold text-red-300 hover:bg-red-500/20"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          Cerrar sesión
        </button>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 print:p-0">
        <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
          <BuscadorGlobal />
          <button
            onClick={cambiarTema}
            aria-label={tema === "claro" ? "Cambiar a tema oscuro" : "Cambiar a tema claro"}
            title={tema === "claro" ? "Tema oscuro" : "Tema claro"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            {tema === "claro" ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            )}
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
