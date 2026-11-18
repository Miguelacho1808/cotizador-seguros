import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { VARIABLES, type Plantilla } from "../lib/plantillasCorreo";
import { Aviso, Boton, Campo, Seccion, inputCls, type Mensaje } from "./ui";

export default function PlantillasCorreo() {
  const [lista, setLista] = useState<Plantilla[]>([]);
  const [sel, setSel] = useState<Plantilla | null>(null);
  const [msg, setMsg] = useState<Mensaje | null>(null);

  const cargar = async (elegir?: string) => {
    const r = await supabase.from("plantillas_correo").select("id,nombre,asunto,cuerpo,predeterminada").order("created_at");
    if (r.error) return setMsg({ tipo: "error", texto: r.error.message });
    const l = (r.data as Plantilla[]) ?? [];
    setLista(l);
    setSel((s) => l.find((x) => x.id === (elegir ?? s?.id)) ?? l[0] ?? null);
  };
  useEffect(() => {
    cargar();
  }, []);

  const guardar = async () => {
    if (!sel) return;
    if (!sel.nombre.trim() || !sel.asunto.trim() || !sel.cuerpo.trim())
      return setMsg({ tipo: "error", texto: "Nombre, asunto y mensaje son obligatorios." });
    if (sel.predeterminada) await supabase.from("plantillas_correo").update({ predeterminada: false }).neq("id", sel.id);
    const r = await supabase
      .from("plantillas_correo")
      .update({ nombre: sel.nombre.trim(), asunto: sel.asunto, cuerpo: sel.cuerpo, predeterminada: sel.predeterminada })
      .eq("id", sel.id);
    if (r.error) return setMsg({ tipo: "error", texto: r.error.message });
    setMsg({ tipo: "ok", texto: "Plantilla guardada." });
    cargar();
  };
  const nueva = async () => {
    const r = await supabase
      .from("plantillas_correo")
      .insert({ nombre: "Nueva plantilla", asunto: "Cotización #{numero}", cuerpo: "Hola {cliente},\n\n{enlace}\n\nSaludos,\n{asesor}" })
      .select("id")
      .single();
    if (r.error) return setMsg({ tipo: "error", texto: r.error.message });
    cargar((r.data as { id: string }).id);
  };
  const eliminar = async () => {
    if (!sel || !window.confirm(`¿Eliminar la plantilla "${sel.nombre}"?`)) return;
    const r = await supabase.from("plantillas_correo").delete().eq("id", sel.id);
    if (r.error) return setMsg({ tipo: "error", texto: r.error.message });
    setSel(null);
    cargar();
  };

  return (
    <Seccion titulo="Plantillas de correo" ayuda="Se usan al enviar una cotización por email. Escribe las variables tal cual; se reemplazan al enviar.">
      <div className="flex flex-wrap gap-2">
        {lista.map((p) => (
          <button
            key={p.id}
            onClick={() => setSel(p)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              sel?.id === p.id ? "border-indigo-400 bg-indigo-500/20" : "border-zinc-700 hover:bg-zinc-800"
            }`}
          >
            {p.nombre}
            {p.predeterminada && " ★"}
          </button>
        ))}
        <Boton variante="secundario" onClick={nueva}>
          + Nueva
        </Boton>
      </div>
      {sel && (
        <div className="space-y-3">
          <Campo etiqueta="Nombre de la plantilla">
            <input value={sel.nombre} onChange={(e) => setSel({ ...sel, nombre: e.target.value })} className={inputCls} />
          </Campo>
          <Campo etiqueta="Asunto">
            <input value={sel.asunto} onChange={(e) => setSel({ ...sel, asunto: e.target.value })} className={inputCls} />
          </Campo>
          <Campo etiqueta="Mensaje">
            <textarea
              rows={10}
              value={sel.cuerpo}
              onChange={(e) => setSel({ ...sel, cuerpo: e.target.value })}
              className={inputCls}
            />
          </Campo>
          <p className="text-xs text-zinc-500">
            Variables: {VARIABLES.map(([v, d]) => `${v} (${d})`).join(" · ")}
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sel.predeterminada}
              onChange={(e) => setSel({ ...sel, predeterminada: e.target.checked })}
            />
            Usar como predeterminada
          </label>
          <div className="flex items-center gap-3">
            <Boton onClick={guardar}>Guardar plantilla</Boton>
            <Boton variante="peligro" onClick={eliminar}>
              Eliminar
            </Boton>
            <Aviso mensaje={msg} />
          </div>
        </div>
      )}
    </Seccion>
  );
}
