import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Aviso, Boton, inputCls, type Mensaje } from "./ui";

type Fila = { id: string; nombre: string; orden: number; activo?: boolean };

/** Catálogo editable (nombre, orden y, si aplica, activo): canales, adicionales y beneficios. */
export default function CatalogoSimple({
  tabla,
  titulo,
  ayuda,
  singular,
  conActivo,
  avisoEliminar,
}: {
  tabla: "canales" | "addons" | "beneficios";
  titulo: string;
  ayuda: string;
  singular: string;
  conActivo: boolean;
  avisoEliminar: string;
}) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [msg, setMsg] = useState<Mensaje | null>(null);
  const [nuevo, setNuevo] = useState("");
  const [edit, setEdit] = useState<{ id: string; nombre: string } | null>(null);

  const cols = conActivo ? "id,nombre,orden,activo" : "id,nombre,orden";
  const cargar = useCallback(async () => {
    const r = await supabase.from(tabla).select(cols).order("orden").order("nombre");
    if (r.error) setMsg({ tipo: "error", texto: r.error.message });
    else setFilas((r.data as unknown as Fila[]) ?? []);
  }, [tabla, cols]);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const ok = async (p: PromiseLike<{ error: { message: string } | null }>, texto: string) => {
    const r = await p;
    if (r.error) setMsg({ tipo: "error", texto: r.error.message });
    else {
      setMsg({ tipo: "ok", texto });
      await cargar();
    }
  };

  const agregar = async () => {
    const nombre = nuevo.trim();
    if (!nombre) return;
    if (filas.some((f) => f.nombre.toLowerCase() === nombre.toLowerCase()))
      return setMsg({ tipo: "error", texto: `"${nombre}" ya existe.` });
    const orden = Math.max(0, ...filas.map((f) => f.orden)) + 1;
    await ok(supabase.from(tabla).insert({ nombre, orden }), `${singular} agregado.`);
    setNuevo("");
  };
  const guardarNombre = async () => {
    if (!edit || !edit.nombre.trim()) return;
    await ok(supabase.from(tabla).update({ nombre: edit.nombre.trim() }).eq("id", edit.id), "Nombre actualizado.");
    setEdit(null);
  };
  const eliminar = async (f: Fila) => {
    if (!window.confirm(`¿Eliminar "${f.nombre}"? ${avisoEliminar}`)) return;
    await ok(supabase.from(tabla).delete().eq("id", f.id), `"${f.nombre}" eliminado.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{titulo}</h2>
          <p className="text-sm text-zinc-400">{ayuda}</p>
        </div>
        <div className="flex gap-2">
          <input
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && agregar()}
            placeholder={`Nuevo ${singular.toLowerCase()}…`}
            className={`${inputCls} w-56`}
          />
          <Boton onClick={agregar}>+ Agregar</Boton>
        </div>
      </div>
      <Aviso mensaje={msg} />
      <div className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        {filas.map((f) => (
          <div key={f.id} className={`flex items-center gap-3 px-4 py-2.5 ${f.activo === false ? "opacity-50" : ""}`}>
            <span className="w-8 text-xs text-zinc-500">#{f.orden}</span>
            {edit?.id === f.id ? (
              <input
                autoFocus
                value={edit.nombre}
                onChange={(e) => setEdit({ id: f.id, nombre: e.target.value })}
                onKeyDown={(e) => (e.key === "Enter" ? guardarNombre() : e.key === "Escape" && setEdit(null))}
                className={`${inputCls} flex-1`}
              />
            ) : (
              <span className="flex-1 text-sm font-medium">{f.nombre}</span>
            )}
            {conActivo && (
              <button
                onClick={() => ok(supabase.from(tabla).update({ activo: !f.activo }).eq("id", f.id), f.activo ? "Desactivado." : "Activado.")}
                className={`rounded-full px-2.5 py-0.5 text-xs ${f.activo ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-700 text-zinc-300"}`}
              >
                {f.activo ? "✓ Activo" : "Inactivo"}
              </button>
            )}
            {edit?.id === f.id ? (
              <Boton onClick={guardarNombre}>Guardar</Boton>
            ) : (
              <Boton variante="secundario" onClick={() => setEdit({ id: f.id, nombre: f.nombre })}>
                Editar
              </Boton>
            )}
            <Boton variante="peligro" onClick={() => eliminar(f)}>
              Eliminar
            </Boton>
          </div>
        ))}
        {filas.length === 0 && <p className="p-4 text-sm text-zinc-500">Sin registros.</p>}
      </div>
    </div>
  );
}
