import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Aviso, Boton, type Mensaje } from "../components/ui";

type Fila = {
  id: string;
  email: string | null;
  nombre: string;
  apellido: string;
  username: string | null;
  rol: "admin" | "asesor";
  activo: boolean;
};

export default function Usuarios() {
  const { perfil } = useAuth();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [msg, setMsg] = useState<Mensaje | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const r = await supabase
      .from("perfiles")
      .select("id,email,nombre,apellido,username,rol,activo")
      .order("created_at");
    if (r.error) setMsg({ tipo: "error", texto: r.error.message });
    else setFilas((r.data as unknown as Fila[]) ?? []);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (perfil?.rol !== "admin") {
    return <p className="text-zinc-400">Solo los administradores pueden gestionar usuarios.</p>;
  }

  const cambiar = (id: string, parcial: Partial<Fila>) =>
    setFilas(filas.map((f) => (f.id === id ? { ...f, ...parcial } : f)));

  const guardar = async (f: Fila) => {
    setMsg(null);
    setGuardando(f.id);
    const r = await supabase.rpc("admin_actualizar_usuario", { p_id: f.id, p_rol: f.rol, p_activo: f.activo });
    setGuardando(null);
    setMsg(
      r.error
        ? { tipo: "error", texto: r.error.message }
        : { tipo: "ok", texto: `Guardado: ${f.email ?? f.nombre}.` },
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Usuarios</h1>
      <p className="text-sm text-zinc-400">
        Las cuentas nuevas se crean en Supabase (Authentication → Users) y aparecen aquí inactivas hasta que las
        actives. Tu propia cuenta no se puede desactivar ni degradar desde aquí, para que no te quedes sin acceso.
      </p>
      <Aviso mensaje={msg} />
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2">Correo</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Activo</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const soyYo = f.id === perfil?.id;
              return (
                <tr key={f.id} className="border-t border-zinc-800">
                  <td className="px-3 py-2">{f.email ?? "—"}</td>
                  <td className="px-3 py-2">{[f.nombre, f.apellido].filter(Boolean).join(" ") || "—"}</td>
                  <td className="px-3 py-2">
                    <select
                      value={f.rol}
                      disabled={soyYo}
                      onChange={(e) => cambiar(f.id, { rol: e.target.value as Fila["rol"] })}
                      className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 disabled:opacity-50"
                    >
                      <option value="asesor">Asesor</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={f.activo}
                      disabled={soyYo}
                      onChange={(e) => cambiar(f.id, { activo: e.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Boton onClick={() => guardar(f)} disabled={soyYo || guardando === f.id}>
                      {guardando === f.id ? "Guardando…" : "Guardar"}
                    </Boton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
