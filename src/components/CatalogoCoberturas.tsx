import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Aviso, Boton, inputCls, type Mensaje } from "./ui";

type Fila = { monto: number; activo: boolean; planes: number };

/** Sumas aseguradas. Salen de las tarifas de cada plan; aquí se activan/desactivan para el cotizador. */
export default function CatalogoCoberturas() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [msg, setMsg] = useState<Mensaje | null>(null);
  const [nuevo, setNuevo] = useState("");

  const cargar = async () => {
    const [t, c] = await Promise.all([
      supabase.from("tarifas").select("plan_id,cobertura_monto").eq("activa", true).limit(5000),
      supabase.from("coberturas_catalogo").select("monto,activo"),
    ]);
    if (t.error || c.error) return setMsg({ tipo: "error", texto: (t.error ?? c.error)!.message });
    const estado = new Map((c.data as { monto: number; activo: boolean }[]).map((x) => [Number(x.monto), x.activo]));
    const planesPor = new Map<number, Set<string>>();
    for (const x of t.data as { plan_id: string; cobertura_monto: number }[]) {
      const m = Number(x.cobertura_monto);
      planesPor.set(m, (planesPor.get(m) ?? new Set()).add(x.plan_id));
    }
    const todos = [...new Set([...planesPor.keys(), ...estado.keys()])].sort((a, b) => a - b);
    setFilas(todos.map((m) => ({ monto: m, activo: estado.get(m) ?? true, planes: planesPor.get(m)?.size ?? 0 })));
  };
  useEffect(() => {
    void cargar();
  }, []);

  const alternar = async (f: Fila) => {
    const r = await supabase.from("coberturas_catalogo").upsert({ monto: f.monto, activo: !f.activo });
    if (r.error) return setMsg({ tipo: "error", texto: r.error.message });
    setMsg(null);
    setFilas(filas.map((x) => (x.monto === f.monto ? { ...x, activo: !f.activo } : x)));
  };

  const agregar = async () => {
    const monto = Number(nuevo.replace(/[^\d]/g, ""));
    if (!monto) return setMsg({ tipo: "error", texto: "Escribe un monto válido (solo números)." });
    if (filas.some((f) => f.monto === monto)) return setMsg({ tipo: "error", texto: `$${monto.toLocaleString("en-US")} ya existe.` });
    const r = await supabase.from("coberturas_catalogo").insert({ monto });
    if (r.error) return setMsg({ tipo: "error", texto: r.error.message });
    setNuevo("");
    setMsg({
      tipo: "ok",
      texto: `$${monto.toLocaleString("en-US")} agregada. Aparecerá al cotizar cuando algún plan tenga tarifas con ese monto (Tarifario → importar o agregar).`,
    });
    await cargar();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Coberturas</h2>
          <p className="text-sm text-zinc-400">
            {filas.filter((f) => f.activo).length} activas · sumas aseguradas disponibles. Cada una existe porque algún plan tiene tarifas con ese
            monto; las inactivas no aparecen al cotizar.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && agregar()}
            placeholder="Ej. 350000"
            inputMode="numeric"
            className={`${inputCls} w-40`}
          />
          <Boton onClick={agregar}>+ Nueva cobertura</Boton>
        </div>
      </div>
      <Aviso mensaje={msg} />
      <div className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        {filas.map((f) => (
          <div key={f.monto} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${f.activo ? "" : "opacity-50"}`}>
            <span className="text-sm font-bold">${f.monto.toLocaleString("en-US")}</span>
            <span className="ml-auto text-xs text-zinc-500">
              {f.planes > 0 ? `${f.planes} plan${f.planes === 1 ? "" : "es"} con tarifa` : "Sin tarifas todavía"}
            </span>
            <button
              onClick={() => alternar(f)}
              className={`rounded-full px-2.5 py-0.5 text-xs ${f.activo ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-700 text-zinc-300"}`}
            >
              {f.activo ? "✓ Activa" : "Inactiva"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
