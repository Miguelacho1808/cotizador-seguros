import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { importarTarifario, type ResultadoImport } from "../lib/importTarifario";

type FilaTarifa = {
  id: string;
  cobertura_monto: number;
  edad_min: number;
  edad_max: number;
  prima_base: number;
  deducible: number;
  planes: { nombre: string; tipo: string; aseguradoras: { nombre: string } | null } | null;
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

  const cargar = useCallback(async () => {
    const res = await supabase
      .from("tarifas")
      .select(
        "id,cobertura_monto,edad_min,edad_max,prima_base,deducible,planes(nombre,tipo,aseguradoras(nombre))",
        { count: "exact" },
      )
      .order("cobertura_monto")
      .limit(50);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setFilas((res.data as unknown as FilaTarifa[]) ?? []);
    setTotal(res.count ?? 0);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (perfil?.rol !== "admin") {
    return <p className="text-zinc-400">Solo los administradores pueden gestionar el tarifario.</p>;
  }

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
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEstado(null);
    } finally {
      setImportando(false);
    }
  };

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
                {resultado.duplicadas} filas duplicadas dentro del archivo (se usó la última de cada grupo).
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
                  </td>
                  <td className="px-3 py-2">{dinero(f.prima_base)}</td>
                  <td className="px-3 py-2">{dinero(f.deducible)}</td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                    Sin tarifas todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {total !== null && total > filas.length && (
          <p className="text-xs text-zinc-500">Mostrando las primeras {filas.length}.</p>
        )}
      </section>
    </div>
  );
}
