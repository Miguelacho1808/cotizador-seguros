import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import Avatar from "./Avatar";

const clase = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm ${
    isActive ? "bg-indigo-500/20 text-indigo-300" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
  }`;

export default function Layout({ children }: { children: ReactNode }) {
  const { perfil, signOut } = useAuth();
  const { pathname } = useLocation();
  const [abierto, setAbierto] = useState(false);
  const nombre = [perfil?.nombre, perfil?.apellido].filter(Boolean).join(" ") || "Usuario";
  const esAdmin = perfil?.rol === "admin";

  // En móvil y tableta el menú es un panel que se cierra al navegar
  useEffect(() => setAbierto(false), [pathname]);

  return (
    <div className="min-h-screen lg:flex">
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
            Inicio
          </NavLink>
          <NavLink to="/cotizaciones" end className={clase}>
            Cotizaciones
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
          className="mt-auto rounded-lg px-3 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
        >
          Cerrar sesión
        </button>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 print:p-0">{children}</main>
    </div>
  );
}
