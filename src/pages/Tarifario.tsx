import { useCallback, useEffect, useState } from "react";
import Papa from "papaparse";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { importarTarifario, type ResultadoImport } from "../lib/importTarifario";
import { Aviso, Boton, Campo, inputCls, type Mensaje } from "../components/ui";

type AddonFila = { incluido: boolean; costo: number | null; valor_original: string; addons: { nombre: string; orden: number } | null };
type FilaTarifa = {
  id: string;
  cobertura_monto: number;
  edad_min: number;
  edad_max: number;
  prima_base: number;
  deducible: number;
  tamano_grupo: number;
  activa: boolean;
  planes: { nombre: string; tipo: string; aseguradoras: { nombre: string } | null } | null;
  tarifa_addons: AddonFila[];
};
type PlanOpcion = { id: string; nombre: string; aseguradora_id: string; aseguradoras: { nombre: string } | null };
type Kpis = { registros: number; aseguradoras: number; coberturas: number[] };
type Filtros = { aseg: string; tipo: string; plan: string; cob: string; edad: string; ded: string };

const SELECT =
  "id,cobertura_monto,edad_min,edad_max,prima_base,deducible,tamano_grupo,activa,planes!inner(nombre,tipo,aseguradora_id,aseguradoras(nombre)),tarifa_addons(incluido,costo,valor_original,addons(nombre,orden))";
const TAMANOS = [10, 25, 50, 100];
const dinero = (n: number) => `$${Number(n).toLocaleString("es-VE")}`;
const vacio: Filtros = { aseg: "", tipo: "", plan: "", cob: "", edad: "", ded: "" };

const etiquetaAddon = (a: AddonFila) =>
  `${a.addons?.nombre ?? "?"}: ${a.incluido ? "Incl." : a.costo !== null && a.costo !== undefined ? dinero(a.costo) : a.valor_original}`;

export default function Tarifario() {
  const { perfil } = useAuth();
  const [filas, setFilas] = useState<FilaTarifa[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [planes, setPlanes] = useState<PlanOpcion[]>([]);
  const [borrador, setBorrador] = useState<Filtros>(vacio);
  const [f, setF] = useState<Filtros>(vacio);
  const [pagina, setPagina] = useState(0);
  const [porPagina, setPorPagina] = useState(10);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<Mensaje | null>(null);
  const [edit, setEdit] = useState<FilaTarifa | null>(null);
  const [importar, setImportar] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const [importando, setImportando] = useState(false);

  const cargarCatalogo = useCallback(async () => {
    const [p, k] = await Promise.all([
      supabase.from("planes").select("id,nombre,aseguradora_id,aseguradoras(nombre)").order("nombre"),
      supabase.rpc("kpis_tarifario"),
    ]);
    if (p.error) setMsg({ tipo: "error", texto: p.error.message });
    else setPlanes((p.data as unknown as PlanOpcion[]) ?? []);
    const r = (k.data as { registros: number; aseguradoras: number; coberturas: number[] }[] | null)?.[0];
    if (r) setKpis({ registros: Number(r.registros), aseguradoras: Number(r.aseguradoras), coberturas: r.coberturas.map(Number) });
  }, []);

  const consulta = useCallback(
    (cols: string, conteo: boolean) => {
      let q = supabase.from("tarifas").select(cols, conteo ? { count: "exact" } : undefined);
      if (f.plan) q = q.eq("plan_id", f.plan);
      else if (f.aseg) q = q.eq("planes.aseguradora_id", f.aseg);
      if (f.tipo) q = q.eq("planes.tipo", f.tipo);
      if (f.cob) q = q.eq("cobertura_monto", Number(f.cob));
      if (f.edad !== "" && !isNaN(Number(f.edad))) q = q.lte("edad_min", Number(f.edad)).gte("edad_max", Number(f.edad));
      if (f.ded !== "" && !isNaN(Number(f.ded))) q = q.eq("deducible", Number(f.ded));
      return q;
    },
    [f],
  );

  const cargar = useCallback(async () => {
    const desde = pagina * porPagina;
    const res = await consulta(SELECT, true)
      .order("cobertura_monto")
      .order("edad_min")
      .order("id")
      .range(desde, desde + porPagina - 1);
    if (res.error) {
      setMsg({ tipo: "error", texto: res.error.message });
      return;
    }
    setFilas((res.data as unknown as FilaTarifa[]) ?? []);
    setTotal(res.count ?? 0);
    setSel(new Set());
  }, [consulta, pagina, porPagina]);

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
    ...new Map(planes.map((p) => [p.aseguradora_id, p.aseguradoras?.nombre ?? p.aseguradora_id] as const)).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const planesVisibles = planes.filter((p) => !borrador.aseg || p.aseguradora_id === borrador.aseg);

  const aplicar = (n: Filtros) => {
    setBorrador(n);
    setF(n);
    setPagina(0);
  };
  const filtrar = () => {
    setF(borrador);
    setPagina(0);
  };

  const refrescar = async () => {
    await Promise.all([cargar(), cargarCatalogo()]);
  };

  const cambiarActiva = async (ids: string[], activa: boolean) => {
    const r = await supabase.from("tarifas").update({ activa }).in("id", ids);
    if (r.error) setMsg({ tipo: "error", texto: r.error.message });
    else {
      setMsg({ tipo: "ok", texto: `${ids.length} tarifa(s) ${activa ? "activada(s)" : "desactivada(s)"}.` });
      await refrescar();
    }
  };

  const eliminar = async (ids: string[]) => {
    if (!window.confirm(`¿Eliminar ${ids.length} tarifa(s)? No se puede deshacer.`)) return;
    const r = await supabase.from("tarifas").delete().in("id", ids);
    if (r.error) setMsg({ tipo: "error", texto: r.error.message });
    else {
      setMsg({ tipo: "ok", texto: `${ids.length} tarifa(s) eliminada(s).` });
      await refrescar();
    }
  };

  const guardarEdicion = async () => {
    if (!edit) return;
    const r = await supabase
      .from("tarifas")
      .update({
        cobertura_monto: edit.cobertura_monto,
        edad_min: edit.edad_min,
        edad_max: edit.edad_max,
        prima_base: edit.prima_base,
        deducible: edit.deducible,
      })
      .eq("id", edit.id);
    if (r.error) setMsg({ tipo: "error", texto: r.error.message });
    else {
      setEdit(null);
      setMsg({ tipo: "ok", texto: "Tarifa actualizada." });
      await refrescar();
    }
  };

  const exportar = async () => {
    setMsg({ tipo: "ok", texto: "Preparando el CSV…" });
    const todas: FilaTarifa[] = [];
    for (let i = 0; i < 40; i++) {
      const r = await consulta(SELECT, false)
        .order("cobertura_monto")
        .order("id")
        .range(i * 1000, i * 1000 + 999);
      if (r.error) {
        setMsg({ tipo: "error", texto: r.error.message });
        return;
      }
      const lote = (r.data as unknown as FilaTarifa[]) ?? [];
      todas.push(...lote);
      if (lote.length < 1000) break;
    }
    const nombresAddon = [...new Set(todas.flatMap((t) => t.tarifa_addons.map((a) => a.addons?.nombre).filter(Boolean) as string[]))];
    const datos = todas.map((t) => {
      const fila: Record<string, string | number> = {
        aseguradora_nombre: t.planes?.aseguradoras?.nombre ?? "",
        plan_nombre: t.planes?.nombre ?? "",
        tipo_plan: t.planes?.tipo ?? "",
        cobertura_monto: t.cobertura_monto,
        edad_min: t.edad_min,
        edad_max: t.edad_max,
        prima_base: t.prima_base,
        deducible: t.deducible,
        tamano_grupo: t.tamano_grupo,
        activa: t.activa ? "si" : "no",
      };
      for (const n of nombresAddon) fila[`addon_${n}`] = t.tarifa_addons.find((a) => a.addons?.nombre === n)?.valor_original ?? "";
      return fila;
    });
    const csv = Papa.unparse(datos);
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `tarifario-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg({ tipo: "ok", texto: `${datos.length} tarifas exportadas.` });
  };

  const hacerImport = async () => {
    if (!archivo) return;
    setImportando(true);
    setMsg(null);
    setResultado(null);
    try {
      const r = await importarTarifario(await archivo.text(), setEstado);
      setResultado(r);
      setEstado("Listo.");
      await refrescar();
    } catch (e) {
      setMsg({ tipo: "error", texto: e instanceof Error ? e.message : String(e) });
      setEstado(null);
    } finally {
      setImportando(false);
    }
  };

  const paginas = total ? Math.ceil(total / porPagina) : 1;
  const ini = Math.max(0, Math.min(pagina - 4, paginas - 10));
  const numeros = Array.from({ length: Math.min(10, paginas) }, (_, i) => ini + i);
  const todasSel = filas.length > 0 && filas.every((x) => sel.has(x.id));
  const tarjeta = "rounded-xl border border-zinc-800 bg-zinc-900 p-4";
  const rotulo = "text-[11px] font-semibold uppercase tracking-wider text-zinc-400";
  const th = "px-3 py-3 text-left text-xs font-semibold text-zinc-300";
  const selCls = "rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm";
  const num = "w-28 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none focus:border-indigo-400";
  const pg = "min-w-8 rounded-md border px-2 py-1 text-xs";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Admin</p>
          <h1 className="text-4xl font-extrabold">Tarifario</h1>
        </div>
        <div className="flex gap-2">
          <Boton variante="secundario" onClick={exportar}>
            Exportar CSV
          </Boton>
          <Boton onClick={() => setImportar((v) => !v)}>Importar CSV</Boton>
        </div>
      </div>

      {importar && (
        <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-400">
            Sube el CSV del tarifario. Puedes repetirlo: las filas existentes se actualizan, no se duplican.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input type="file" accept=".csv,text/csv" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} className="text-sm" />
            <Boton onClick={hacerImport} disabled={!archivo || importando}>
              {importando ? "Importando…" : "Importar"}
            </Boton>
          </div>
          {estado && <p className="text-sm text-zinc-300">{estado}</p>}
          {resultado && (
            <div className="space-y-1 text-sm text-zinc-300">
              <p>
                {resultado.filas} filas leídas · {resultado.aseguradoras} aseguradoras · {resultado.planes} planes ·{" "}
                {resultado.tarifas} tarifas · {resultado.addons} add-ons
              </p>
              {resultado.duplicadas > 0 && (
                <p className="text-amber-300">{resultado.duplicadas} filas idénticas repetidas (se guardó una sola).</p>
              )}
              {resultado.omitidas.map((m) => (
                <p key={m} className="text-amber-300">
                  {m}
                </p>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={tarjeta}>
          <p className={rotulo}>Registros</p>
          <p className="mt-1 text-4xl font-extrabold text-sky-200">{kpis ? kpis.registros.toLocaleString("es-VE") : "…"}</p>
        </div>
        <div className={tarjeta}>
          <p className={rotulo}>Aseguradoras</p>
          <p className="mt-1 text-4xl font-extrabold text-emerald-400">{kpis ? kpis.aseguradoras : "…"}</p>
        </div>
        <div className={tarjeta}>
          <p className={rotulo}>Coberturas</p>
          <p className="mt-1 text-4xl font-extrabold text-fuchsia-500">{kpis ? kpis.coberturas.length : "…"}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={borrador.aseg}
          onChange={(e) => aplicar({ ...borrador, aseg: e.target.value, plan: "" })}
          className={selCls}
        >
          <option value="">Todas las aseguradoras</option>
          {aseguradoras.map(([id, n]) => (
            <option key={id} value={id}>
              {n}
            </option>
          ))}
        </select>
        <select value={borrador.tipo} onChange={(e) => aplicar({ ...borrador, tipo: e.target.value })} className={selCls}>
          <option value="">Todos los tipos</option>
          <option value="hcm">HCM</option>
          <option value="emca">Emergencia</option>
          <option value="amy">Adulto mayor</option>
        </select>
        <select value={borrador.plan} onChange={(e) => aplicar({ ...borrador, plan: e.target.value })} className={selCls}>
          <option value="">Todos los planes</option>
          {planesVisibles.map((p) => (
            <option key={p.id} value={p.id}>
              {borrador.aseg ? p.nombre : `${p.aseguradoras?.nombre ?? ""} · ${p.nombre}`}
            </option>
          ))}
        </select>
        <select value={borrador.cob} onChange={(e) => aplicar({ ...borrador, cob: e.target.value })} className={selCls}>
          <option value="">Todas las coberturas</option>
          {(kpis?.coberturas ?? []).map((c) => (
            <option key={c} value={c}>
              {dinero(c)}
            </option>
          ))}
        </select>
        <input
          value={borrador.edad}
          onChange={(e) => setBorrador({ ...borrador, edad: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && filtrar()}
          placeholder="Edad"
          inputMode="numeric"
          className={num}
        />
        <input
          value={borrador.ded}
          onChange={(e) => setBorrador({ ...borrador, ded: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && filtrar()}
          placeholder="Deducible"
          inputMode="numeric"
          className={num}
        />
        <Boton onClick={filtrar}>Filtrar</Boton>
        {(f.aseg || f.tipo || f.plan || f.cob || f.edad || f.ded) && (
          <button onClick={() => aplicar(vacio)} className="text-sm text-zinc-400 hover:text-zinc-100">
            Limpiar
          </button>
        )}
        <span className="ml-auto text-xs text-zinc-400">
          {total !== null ? `${total.toLocaleString("es-VE")} registros` : ""}
        </span>
      </div>

      <Aviso mensaje={msg} />

      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-400/40 bg-indigo-500/10 p-3 text-sm">
          <span className="font-semibold">{sel.size} seleccionada(s)</span>
          <Boton variante="secundario" onClick={() => cambiarActiva([...sel], true)}>
            Activar
          </Boton>
          <Boton variante="secundario" onClick={() => cambiarActiva([...sel], false)}>
            Desactivar
          </Boton>
          <Boton variante="peligro" onClick={() => eliminar([...sel])}>
            Eliminar
          </Boton>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-zinc-800/60">
            <tr>
              <th className={th}>
                <input
                  type="checkbox"
                  checked={todasSel}
                  onChange={() => setSel(todasSel ? new Set() : new Set(filas.map((x) => x.id)))}
                  aria-label="Seleccionar todas"
                />
              </th>
              <th className={th}>Aseguradora</th>
              <th className={th}>Plan</th>
              <th className={th}>Cobertura</th>
              <th className={th}>Edad</th>
              <th className={th}>Prima base</th>
              <th className={th}>Deducible</th>
              <th className={th}>Add-ons</th>
              <th className={th}>Tipo</th>
              <th className={th}>Estado</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {filas.map((t) => (
              <tr key={t.id} className={`border-t border-zinc-800 ${t.activa ? "" : "opacity-60"}`}>
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={sel.has(t.id)}
                    onChange={() => {
                      const n = new Set(sel);
                      if (n.has(t.id)) n.delete(t.id);
                      else n.add(t.id);
                      setSel(n);
                    }}
                    aria-label="Seleccionar fila"
                  />
                </td>
                <td className="px-3 py-2.5 font-semibold">{t.planes?.aseguradoras?.nombre}</td>
                <td className="px-3 py-2.5 text-zinc-300">{t.planes?.nombre}</td>
                <td className="px-3 py-2.5">{dinero(t.cobertura_monto)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">
                  {t.edad_min}-{t.edad_max}
                  {t.tamano_grupo > 0 && ` · g${t.tamano_grupo}`}
                </td>
                <td className="px-3 py-2.5 font-bold text-indigo-300">{dinero(t.prima_base)}</td>
                <td className="px-3 py-2.5">{dinero(t.deducible)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex max-w-[260px] flex-wrap gap-1">
                    {[...t.tarifa_addons]
                      .sort((a, b) => (a.addons?.orden ?? 0) - (b.addons?.orden ?? 0))
                      .map((a, i) => (
                        <span key={i} className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">
                          {etiquetaAddon(a)}
                        </span>
                      ))}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs">{t.planes?.tipo}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      t.activa ? "bg-emerald-200 text-emerald-900" : "bg-zinc-300 text-zinc-700"
                    }`}
                  >
                    {t.activa ? "✓ Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  <button onClick={() => setEdit(t)} className="mr-1 rounded-md border border-zinc-700 px-2.5 py-1 text-xs hover:bg-zinc-800">
                    Editar
                  </button>
                  <button
                    onClick={() => cambiarActiva([t.id], !t.activa)}
                    className="mr-1 rounded-md border border-red-500/40 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10"
                  >
                    {t.activa ? "Desact." : "Activar"}
                  </button>
                  <button
                    onClick={() => eliminar([t.id])}
                    className="rounded-md border border-red-500/40 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-zinc-500">
                  Sin tarifas para este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
        <span>
          Página {pagina + 1} de {paginas} · {(total ?? 0).toLocaleString("es-VE")} registros
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={porPagina}
            onChange={(e) => {
              setPorPagina(Number(e.target.value));
              setPagina(0);
            }}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs"
          >
            {TAMANOS.map((n) => (
              <option key={n} value={n}>
                {n} / página
              </option>
            ))}
          </select>
          <button
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
            disabled={pagina === 0}
            className={`${pg} border-zinc-700 hover:bg-zinc-800 disabled:opacity-40`}
          >
            ← Anterior
          </button>
          {numeros.map((n) => (
            <button
              key={n}
              onClick={() => setPagina(n)}
              className={`${pg} ${n === pagina ? "border-zinc-100 bg-zinc-100 font-bold text-zinc-900" : "border-zinc-700 hover:bg-zinc-800"}`}
            >
              {n + 1}
            </button>
          ))}
          <button
            onClick={() => setPagina((p) => Math.min(paginas - 1, p + 1))}
            disabled={pagina >= paginas - 1}
            className={`${pg} border-zinc-700 hover:bg-zinc-800 disabled:opacity-40`}
          >
            Siguiente →
          </button>
        </div>
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEdit(null)}>
          <div
            className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="text-lg font-bold">Editar tarifa</h2>
              <p className="text-sm text-zinc-400">
                {edit.planes?.aseguradoras?.nombre} · {edit.planes?.nombre}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["Cobertura ($)", "cobertura_monto"],
                  ["Prima base ($)", "prima_base"],
                  ["Edad desde", "edad_min"],
                  ["Edad hasta", "edad_max"],
                  ["Deducible ($)", "deducible"],
                ] as [string, keyof FilaTarifa][]
              ).map(([et, k]) => (
                <Campo key={k} etiqueta={et}>
                  <input
                    type="number"
                    value={String(edit[k] ?? "")}
                    onChange={(e) => setEdit({ ...edit, [k]: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className={inputCls}
                  />
                </Campo>
              ))}
            </div>
            <p className="text-xs text-zinc-500">Los precios de los add-ons se modifican importando el CSV.</p>
            <div className="flex justify-end gap-2">
              <Boton variante="secundario" onClick={() => setEdit(null)}>
                Cancelar
              </Boton>
              <Boton onClick={guardarEdicion}>Guardar</Boton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
