import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth";

const clase = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm ${
    isActive ? "bg-indigo-500/20 text-indigo-300" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
  }`;

export default function Layout({ children }: { children: ReactNode }) {
  const { perfil, signOut } = useAuth();
  const nombre = [perfil?.nombre, perfil?.apellido].filter(Boolean).join(" ") || "Usuario";
  const esAdmin = perfil?.rol === "admin";

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 print:hiddenshrink-0 flex-col border-r border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Bienvenido</p>
          <p className="text-lg font-semibold">{nombre}</p>
          <p className="text-xs text-zinc-500">{esAdmin ? "Administrador" : "Asesor"}</p>
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

      <main className="min-w-0 flex-1 p-8">{children}</main>
    </div>
  );
}
