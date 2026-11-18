import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { bloquesPorDefecto, type Plantilla } from "../lib/plantillasCorreo";
import { Aviso, Boton, type Mensaje } from "./ui";
import PlantillaEditor from "./PlantillaEditor";

const COLS = "id,nombre,asunto,cuerpo,predeterminada,html,bloques,updated_at";

export default function PlantillasCorreo() {
  const [lista, setLista] = useState<Plantilla[]>([]);
  const [editando, setEditando] = useState<Plantilla | null>(null);
  const [msg, setMsg] = useState<Mensaje | null>(null);

  const cargar = useCallback(async () => {
    const r = await supabase.from("plantillas_correo").select(COLS).order("created_at");
    if (r.error) setMsg({ tipo: "error", texto: r.error.message });
    else setLista((r.data as unknown as Plantilla[]) ?? []);
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const crear = async (base?: Plantilla) => {
    const r = await supabase
      .from("plantillas_correo")
      .insert({
        nombre: base ? `${base.nombre} (copia)` : "Nueva plantilla",
        asunto: base?.asunto ?? "Tu cotización #{numero}",
        cuerpo: base?.cuerpo ?? "Hola {cliente},\n\nTe comparto tu cotización #{numero}: {enlace}\n\nSaludos,\n{asesor}",
        bloques: base ? base.bloques : bloquesPorDefecto(),
        html: base ? base.html : null,
      })
      .select(COLS)
      .single();
    if (r.error) return setMsg({ tipo: "error", texto: r.error.message });
    await cargar();
    setEditando(r.data as unknown as Plantilla);
  };
  const predeterminar = async (p: Plantilla) => {
    await supabase.from("plantillas_correo").update({ predeterminada: false }).neq("id", p.id);
    const r = await supabase.from("plantillas_correo").update({ predeterminada: true }).eq("id", p.id);
    if (r.error) setMsg({ tipo: "error", texto: r.error.message });
    else {
      setMsg({ tipo: "ok", texto: `"${p.nombre}" es ahora la predeterminada.` });
      await cargar();
    }
  };
  const eliminar = async (p: Plantilla) => {
    if (!window.confirm(`¿Eliminar la plantilla "${p.nombre}"?`)) return;
    const r = await supabase.from("plantillas_correo").delete().eq("id", p.id);
    if (r.error) setMsg({ tipo: "error", texto: r.error.message });
    else await cargar();
  };

  if (editando)
    return (
      <PlantillaEditor
        plantilla={editando}
        onVolver={() => {
          setEditando(null);
          void cargar();
        }}
      />
    );

  const btn = "rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm hover:bg-zinc-800";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-extrabold">Plantillas de Email</h2>
          <p className="text-sm text-zinc-400">Crea y personaliza las plantillas que se usan al enviar cotizaciones por email.</p>
        </div>
        <Boton onClick={() => crear()}>+ Nueva plantilla</Boton>
      </div>
      <Aviso mensaje={msg} />
      <div className="space-y-3">
        {lista.map((p) => (
          <div
            key={p.id}
            className={`flex items-center gap-4 rounded-2xl border p-4 ${p.predeterminada ? "border-indigo-400/60 bg-zinc-800" : "border-zinc-800 bg-zinc-900"}`}
          >
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg ${p.predeterminada ? "bg-indigo-300 text-indigo-900" : "bg-zinc-700"}`}>▤</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">
                {p.nombre}
                {p.predeterminada && <span className="ml-2 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-indigo-300">DEFAULT</span>}
              </p>
              <p className="text-xs text-zinc-400">Actualizada {new Date(p.updated_at).toLocaleDateString("es-VE")}</p>
            </div>
            <div className="flex gap-1.5">
              {!p.predeterminada && (
                <button className={btn} title="Hacer predeterminada" onClick={() => predeterminar(p)}>
                  ☆
                </button>
              )}
              <button className={btn} title="Editar" onClick={() => setEditando(p)}>
                ✎
              </button>
              <button className={btn} title="Duplicar" onClick={() => crear(p)}>
                ⧉
              </button>
              {!p.predeterminada && (
                <button className={`${btn} border-red-500/40 text-red-400`} title="Eliminar" onClick={() => eliminar(p)}>
                  🗑
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
