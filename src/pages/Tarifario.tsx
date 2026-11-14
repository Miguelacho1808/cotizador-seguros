import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { importarTarifario, type ResultadoImport } from "../lib/importTarifario";

const POR_PAGINA = 50;

type FilaTarifa = {
  id: string;
  cobertura_monto: number;
  edad_min: number;
  edad_max: number;
  prima_base: number;
  deducible: number;
  tamano_grupo: number;
  planes: { nombre: string; tipo: string; aseguradoras: { nombre: string } | null } | null;
};

type PlanOpcion = {
  id: string;
  nombre: string;
  aseguradora_id: string;
  aseguradoras: { nombre: string } | null;
};

const dinero = (n: number) => `$${Number(n).toLocaleString("es-VE")}`;

export default function Tarifario() {
  const { perfil } = useAuth();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [filas, setFilas] = useState<FilaTarifa[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [planes, setPlanes] = useState<PlanOpcion[]>([]);
  const [filtroAseg, setFiltroAseg] = useState("");
  const [filtroPlan, setFiltroPlan] = useState("");
  const [pagina, setPagina] = useState(0);

  const cargarCatalogo = useCallback(async () => {
    const res = await supabase
      .from("planes")
      .select("id,nombre,aseguradora_id,aseguradoras(nombre)")
      .order("nombre");
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setPlanes((res.data as unknown as PlanOpcion[]) ?? []);
  }, []);

  const cargar = useCallback(async () => {
    let consulta = supabase
      .from("tarifas")
      .select(
        "id,cobertura_monto,edad_min,edad_max,prima_base,deducible,tamano_grupo,planes!inner(nombre,tipo,aseguradora_id,aseguradoras(nombre))",
        { count: "exact" },
      );
    if (filtroPlan) consulta = consulta.eq("plan_id", filtroPlan);
    else if (filtroAseg) consulta = consulta.eq("planes.aseguradora_id", filtroAseg);

    const desde = pagina * POR_PAGINA;
    const res = await consulta
      .order("cobertura_monto")
      .order("edad_min")
      .order("id")
      .range(desde, desde + POR_PAGINA - 1);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setFilas((res.data as unknown as FilaTarifa[]) ?? []);
    setTotal(res.count ?? 0);
  }, [filtroAseg, filtroPlan, pagina]);

  useEffect(() => {
    void cargarCatalogo();
  }, [cargarCatalogo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (perfil?.rol !== "admin") {
    return <p className="text-zinc-400">Solo los administradores pueden gestionar el tarifario.</p>;
  }

  const aseguradoras = [
    ...new Map(
      planes.map((p) => [p.aseguradora_id, p.aseguradoras?.nombre ?? p.aseguradora_id] as const),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const planesVisibles = planes.filter((p) => !filtroAseg || p.aseguradora_id === filtroAseg);

  const importar = async () => {
    if (!archivo) return;
    setImportando(true);
    setError(null);
    setResultado(null);
    try {
      const texto = await archivo.text();
      const r = await importarTarifario(texto, setEstado);
      setResultado(r);
      setEstado("Listo.");
      await cargarCatalogo();
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEstado(null);
    } finally {
      setImportando(false);
    }
  };

  const desde = total === 0 || total === null ? 0 : pagina * POR_PAGINA + 1;
  const hasta = Math.min((pagina + 1) * POR_PAGINA, total ?? 0);
  const hayMas = total !== null && hasta < total;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Tarifario</h1>

      <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="font-semibold">Importar CSV</h2>
        <p className="text-sm text-zinc-400">
          Sube el archivo exportado del tarifario. Puedes repetirlo: las filas existentes se actualizan, no se
          duplican.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <button
            onClick={importar}
            disabled={!archivo || importando}
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
          >
            {importando ? "Importando…" : "Importar"}
          </button>
        </div>
        {estado && <p className="text-sm text-zinc-300">{estado}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {resultado && (
          <div className="space-y-1 text-sm text-zinc-300">
            <p>
              {resultado.filas} filas leídas · {resultado.aseguradoras} aseguradoras · {resultado.planes} planes ·{" "}
              {resultado.tarifas} tarifas · {resultado.addons} add-ons
            </p>
            {resultado.duplicadas > 0 && (
              <p className="text-amber-300">
                {resultado.duplicadas} filas idénticas repetidas dentro del archivo (se guardó una sola).
              </p>
            )}
            {resultado.omitidas.map((m) => (
              <p key={m} className="text-amber-300">
                {m}
              </p>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Tarifas cargadas {total !== null && `(${total})`}</h2>

        <div className="flex flex-wrap gap-3">
          <select
            value={filtroAseg}
            onChange={(e) => {
              setFiltroAseg(e.target.value);
              setFiltroPlan("");
              setPagina(0);
            }}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
          >
            <option value="">Todas las aseguradoras ({aseguradoras.length})</option>
            {aseguradoras.map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>
          <select
            value={filtroPlan}
            onChange={(e) => {
              setFiltroPlan(e.target.value);
              setPagina(0);
            }}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
          >
            <option value="">Todos los planes ({planesVisibles.length})</option>
            {planesVisibles.map((p) => (
              <option key={p.id} value={p.id}>
                {filtroAseg ? p.nombre : `${p.aseguradoras?.nombre ?? ""} · ${p.nombre}`}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Aseguradora</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Cobertura</th>
                <th className="px-3 py-2">Edad</th>
                <th className="px-3 py-2">Prima base</th>
                <th className="px-3 py-2">Deducible</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className="border-t border-zinc-800">
                  <td className="px-3 py-2">{f.planes?.aseguradoras?.nombre}</td>
                  <td className="px-3 py-2">{f.planes?.nombre}</td>
                  <td className="px-3 py-2">{dinero(f.cobertura_monto)}</td>
                  <td className="px-3 py-2">
                    {f.edad_min}–{f.edad_max}
                    {f.tamano_grupo > 0 && ` · grupo de ${f.tamano_grupo}`}
                  </td>
                  <td className="px-3 py-2">{dinero(f.prima_base)}</td>
                  <td className="px-3 py-2">{dinero(f.deducible)}</td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                    Sin tarifas para este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm text-zinc-400">
          <span>
            {total === null ? "…" : `Mostrando ${desde}–${hasta} de ${total}`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPagina((p) => Math.max(0, p - 1))}
              disabled={pagina === 0}
              className="rounded-lg border border-zinc-700 px-3 py-1 hover:bg-zinc-800 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              onClick={() => setPagina((p) => p + 1)}
              disabled={!hayMas}
              className="rounded-lg border border-zinc-700 px-3 py-1 hover:bg-zinc-800 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
