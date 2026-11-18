import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Aviso, type Mensaje } from "./ui";

/** Sumas aseguradas: las que tienen tarifas aparecen aquí y se pueden activar/desactivar en el cotizador. */
export default function CatalogoCoberturas() {
  const [montos, setMontos] = useState<{ monto: number; activo: boolean }[]>([]);
  const [msg, setMsg] = useState<Mensaje | null>(null);

  const cargar = async () => {
    const [t, c] = await Promise.all([
      supabase.from("tarifas").select("cobertura_monto").eq("activa", true).limit(5000),
      supabase.from("coberturas_catalogo").select("monto,activo"),
    ]);
    if (t.error || c.error) return setMsg({ tipo: "error", texto: (t.error ?? c.error)!.message });
    const estado = new Map((c.data as { monto: number; activo: boolean }[]).map((x) => [Number(x.monto), x.activo]));
    const todos = [...new Set((t.data as { cobertura_monto: number }[]).map((x) => Number(x.cobertura_monto)))].sort((a, b) => a - b);
    setMontos(todos.map((m) => ({ monto: m, activo: estado.get(m) ?? true })));
  };
  useEffect(() => {
    void cargar();
  }, []);

  const alternar = async (m: { monto: number; activo: boolean }) => {
    const r = await supabase.from("coberturas_catalogo").upsert({ monto: m.monto, activo: !m.activo });
    if (r.error) return setMsg({ tipo: "error", texto: r.error.message });
    setMsg(null);
    setMontos(montos.map((x) => (x.monto === m.monto ? { ...x, activo: !m.activo } : x)));
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Coberturas</h2>
        <p className="text-sm text-zinc-400">
          {montos.filter((m) => m.activo).length} activas · sumas aseguradas disponibles. Salen de las tarifas cargadas; las
          inactivas no aparecen al cotizar.
        </p>
      </div>
      <Aviso mensaje={msg} />
      <div className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        {montos.map((m) => (
          <div key={m.monto} className={`flex items-center justify-between px-4 py-2.5 ${m.activo ? "" : "opacity-50"}`}>
            <span className="text-sm font-bold">${m.monto.toLocaleString("en-US")}</span>
            <button
              onClick={() => alternar(m)}
              className={`rounded-full px-2.5 py-0.5 text-xs ${m.activo ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-700 text-zinc-300"}`}
            >
              {m.activo ? "✓ Activa" : "Inactiva"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
