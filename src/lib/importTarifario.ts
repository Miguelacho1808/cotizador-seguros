import Papa from "papaparse";
import { supabase } from "./supabase";

type Fila = Record<string, string>;

export type ResultadoImport = {
  filas: number;
  aseguradoras: number;
  planes: number;
  tarifas: number;
  addons: number;
  duplicadas: number;
  omitidas: string[];
};

type Valida = {
  aseg: string;
  plan: string;
  tipo: string;
  monto: number;
  emin: number;
  emax: number;
  prima: number;
  ded: number;
  tam: number;
  addons: Record<string, string>;
};

const TIPOS = new Set(["hcm", "emca", "amy"]);

function num(v: string | undefined): number | null {
  if (v === undefined || v.trim() === "") return null;
  const n = Number(v.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function trozos<T>(lista: T[], tamano: number): T[][] {
  const salida: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) salida.push(lista.slice(i, i + tamano));
  return salida;
}

function falla(contexto: string, error: { message: string } | null) {
  if (error) throw new Error(`${contexto}: ${error.message}`);
}

/**
 * Importa el tarifario exportado (CSV) a Supabase. Es repetible: usa upsert, por lo que
 * volver a importar actualiza las filas existentes en vez de duplicarlas.
 * Convención de add-ons: número = costo anual, "gratis" = incluido, vacío = no disponible.
 */
export async function importarTarifario(
  texto: string,
  progreso: (mensaje: string) => void,
): Promise<ResultadoImport> {
  const parsed = Papa.parse<Fila>(texto, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().replace(/^﻿/, ""),
  });
  if (parsed.data.length === 0) throw new Error("El archivo no tiene filas.");

  const omitidas: string[] = [];
  const validas: Valida[] = [];

  parsed.data.forEach((f, i) => {
    const linea = i + 2;
    const aseg = (f.aseguradora_nombre ?? "").trim();
    const plan = (f.plan_nombre ?? "").trim();
    const tipo = (f.tipo_plan ?? "").trim().toLowerCase();
    const monto = num(f.cobertura_monto);
    const emin = num(f.edad_min);
    const emax = num(f.edad_max);
    const prima = num(f.prima_base);
    const ded = num(f.deducible) ?? 0;
    // Opcional: número de personas del grupo (planes con tarifa por grupo). 0 = tarifa por persona.
    const tam = num(f.tamano_grupo) ?? 0;

    if (
      !aseg ||
      !plan ||
      !TIPOS.has(tipo) ||
      monto === null ||
      monto <= 0 ||
      emin === null ||
      emax === null ||
      emin > emax ||
      prima === null ||
      prima < 0 ||
      !Number.isInteger(tam) ||
      tam < 0
    ) {
      omitidas.push(`Línea ${linea}: datos inválidos o incompletos`);
      return;
    }

    const addons: Record<string, string> = {};
    for (const [columna, valor] of Object.entries(f)) {
      if (columna.startsWith("addon_") && valor && valor.trim() !== "") {
        addons[columna.slice("addon_".length).trim()] = valor.trim();
      }
    }
    validas.push({ aseg, plan, tipo, monto, emin, emax, prima, ded, tam, addons });
  });

  // Claves repetidas: si las filas son idénticas se colapsan en una. Si traen precios o add-ons
  // distintos no se adivina cuál es el correcto: se omite el grupo y se informa, para no pisar datos buenos.
  const grupos = new Map<string, Valida[]>();
  for (const v of validas) {
    const clave = `${v.aseg}|${v.plan}|${v.monto}|${v.emin}|${v.emax}|${v.ded}|${v.tam}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), v]);
  }
  const firma = (v: Valida) => JSON.stringify([v.prima, Object.entries(v.addons).sort()]);
  const unicas: Valida[] = [];
  let duplicadas = 0;
  const conflictosPorPlan = new Map<string, number>();
  for (const filasGrupo of grupos.values()) {
    if (new Set(filasGrupo.map(firma)).size === 1) {
      unicas.push(filasGrupo[0]);
      duplicadas += filasGrupo.length - 1;
    } else {
      const k = `${filasGrupo[0].aseg} / ${filasGrupo[0].plan}`;
      conflictosPorPlan.set(k, (conflictosPorPlan.get(k) ?? 0) + 1);
    }
  }
  for (const [plan, n] of conflictosPorPlan) {
    omitidas.push(
      `${plan}: ${n} combinaciones repetidas con precios distintos; se omitieron y no se modificó nada. Agrega una columna tamano_grupo al CSV para distinguirlas.`,
    );
  }

  // 1. Aseguradoras
  progreso("Guardando aseguradoras…");
  const nombresAseg = [...new Set(unicas.map((v) => v.aseg))];
  const resAseg = await supabase
    .from("aseguradoras")
    .upsert(
      nombresAseg.map((nombre) => ({ nombre })),
      { onConflict: "nombre" },
    )
    .select("id,nombre");
  falla("Aseguradoras", resAseg.error);
  const idAseg = new Map((resAseg.data ?? []).map((a) => [a.nombre as string, a.id as string]));

  // 2. Planes
  progreso("Guardando planes…");
  const planesUnicos = new Map<string, { aseguradora_id: string; nombre: string; tipo: string }>();
  for (const v of unicas) {
    const aseguradoraId = idAseg.get(v.aseg);
    if (!aseguradoraId) continue;
    planesUnicos.set(`${v.aseg}|${v.plan}`, { aseguradora_id: aseguradoraId, nombre: v.plan, tipo: v.tipo });
  }
  const resPlanes = await supabase
    .from("planes")
    .upsert([...planesUnicos.values()], { onConflict: "aseguradora_id,nombre" })
    .select("id,aseguradora_id,nombre");
  falla("Planes", resPlanes.error);
  const idPlan = new Map((resPlanes.data ?? []).map((p) => [`${p.aseguradora_id}|${p.nombre}`, p.id as string]));

  // 3. Tarifas
  const filasTarifa = unicas.flatMap((v) => {
    const planId = idPlan.get(`${idAseg.get(v.aseg)}|${v.plan}`);
    if (!planId) return [];
    return [
      {
        origen: v,
        fila: {
          plan_id: planId,
          cobertura_monto: v.monto,
          edad_min: v.emin,
          edad_max: v.emax,
          prima_base: v.prima,
          deducible: v.ded,
          tamano_grupo: v.tam,
        },
      },
    ];
  });

  const idTarifa = new Map<string, string>();
  const lotesTarifa = trozos(filasTarifa, 200);
  for (let i = 0; i < lotesTarifa.length; i++) {
    progreso(`Guardando tarifas (${i + 1}/${lotesTarifa.length})…`);
    const res = await supabase
      .from("tarifas")
      .upsert(
        lotesTarifa[i].map((x) => x.fila),
        { onConflict: "plan_id,cobertura_monto,edad_min,edad_max,deducible,tamano_grupo" },
      )
      .select("id,plan_id,cobertura_monto,edad_min,edad_max,deducible,tamano_grupo");
    falla("Tarifas", res.error);
    for (const t of res.data ?? []) {
      idTarifa.set(
        `${t.plan_id}|${Number(t.cobertura_monto)}|${t.edad_min}|${t.edad_max}|${Number(t.deducible)}|${t.tamano_grupo}`,
        t.id as string,
      );
    }
  }

  // 4. Add-ons por tarifa
  progreso("Guardando add-ons…");
  const resCatalogo = await supabase.from("addons").select("id,nombre");
  falla("Catálogo de add-ons", resCatalogo.error);
  const idAddon = new Map((resCatalogo.data ?? []).map((a) => [(a.nombre as string).trim(), a.id as string]));

  const filasAddon: {
    tarifa_id: string;
    addon_id: string;
    valor_original: string;
    incluido: boolean;
    costo: number | null;
  }[] = [];
  const desconocidos = new Set<string>();

  for (const { origen, fila } of filasTarifa) {
    const tarifaId = idTarifa.get(
      `${fila.plan_id}|${fila.cobertura_monto}|${fila.edad_min}|${fila.edad_max}|${fila.deducible}|${fila.tamano_grupo}`,
    );
    if (!tarifaId) continue;
    for (const [nombre, valor] of Object.entries(origen.addons)) {
      const addonId = idAddon.get(nombre);
      if (!addonId) {
        desconocidos.add(nombre);
        continue;
      }
      const incluido = valor.toLowerCase() === "gratis";
      filasAddon.push({
        tarifa_id: tarifaId,
        addon_id: addonId,
        valor_original: valor,
        incluido,
        costo: incluido ? null : num(valor),
      });
    }
  }
  if (desconocidos.size > 0) {
    omitidas.push(`Add-ons que no existen en el catálogo y se omitieron: ${[...desconocidos].join(", ")}`);
  }

  const lotesAddon = trozos(filasAddon, 500);
  for (let i = 0; i < lotesAddon.length; i++) {
    progreso(`Guardando add-ons (${i + 1}/${lotesAddon.length})…`);
    const res = await supabase.from("tarifa_addons").upsert(lotesAddon[i], { onConflict: "tarifa_id,addon_id" });
    falla("Add-ons", res.error);
  }

  return {
    filas: parsed.data.length,
    aseguradoras: nombresAseg.length,
    planes: planesUnicos.size,
    tarifas: idTarifa.size,
    addons: filasAddon.length,
    duplicadas,
    omitidas,
  };
}
