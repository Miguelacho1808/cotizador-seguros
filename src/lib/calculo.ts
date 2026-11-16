// Cálculo de primas del cotizador (versión Salud). Funciones puras, sin acceso a la base de datos.
//
// Reglas (confirmadas con la app original y con el usuario):
//  - Plan por persona: cada asegurado paga la prima base del tramo de edad que le corresponde.
//  - Plan por grupo: se cobra la prima del grupo según el número de personas (tamano_grupo).
//  - Add-ons: se cobran POR PERSONA, solo a quien esté dentro del rango de edad del add-on en el plan.
//    Valor "gratis" = incluido sin costo; número = costo anual; vacío = no disponible.
//  - Fraccionamiento: semestral, trimestral y mensual = anual / 2, 4 y 12, redondeado hacia arriba.
//  - Renovación: recargo % sobre el total anual, solo en aseguradoras con renovación habilitada.

export type Asegurado = { nombre: string; edad: number; sexo: "M" | "F" };

export type AddonTarifa = { addon_id: string; valor_original: string; incluido: boolean; costo: number | null };

export type TarifaCalc = {
  id: string;
  plan_id: string;
  cobertura_monto: number;
  edad_min: number;
  edad_max: number;
  prima_base: number;
  deducible: number;
  tamano_grupo: number;
  tarifa_addons: AddonTarifa[];
};

export type PlanCalc = {
  id: string;
  nombre: string;
  tipo: string;
  modalidad: "por_persona" | "por_grupo";
  grupo_min: number | null;
  grupo_max: number | null;
  activo: boolean;
  recomendado: boolean;
  mas_vendido: boolean;
  aseguradora: {
    id: string;
    nombre: string;
    activa: boolean;
    renovacion_habilitada: boolean;
    recargo_renovacion_pct: number;
    logo_url?: string | null;
  };
  plan_addons: { addon_id: string; edad_min: number | null; edad_max: number | null }[];
  cuotas?: string[] | null;
};

export type AddonCat = { id: string; nombre: string; solo_sexo?: "M" | "F" | null };

export type LineaAddon = { addon_id: string; nombre: string; total: number; incluido: boolean; personas: number };

export type Opcion = {
  clave: string;
  plan_id: string;
  plan: string;
  tipo: string;
  aseguradora_id: string;
  aseguradora: string;
  recomendado: boolean;
  mas_vendido: boolean;
  cobertura: number;
  deducible: number;
  deducibles: number[];
  base: number;
  addons: LineaAddon[];
  recargo: number;
  anual: number;
  semestral: number;
  trimestral: number;
  mensual: number;
  porPersona: { nombre: string; edad: number; base: number | null; addons: number }[];
  cuotas: string[];
};

/** Formas de pago que puede ofrecer un plan (clave guardada en planes.cuotas). */
export const CUOTAS: { clave: string; nombre: string; periodo: string }[] = [
  { clave: "anual", nombre: "Anual", periodo: "/año" },
  { clave: "semestral", nombre: "Semestral", periodo: "/semestre" },
  { clave: "cuatrimestral", nombre: "Cuatrimestral", periodo: "/cuatrimestre" },
  { clave: "trimestral", nombre: "Trimestral", periodo: "/trimestre" },
  { clave: "mensual", nombre: "Mensual", periodo: "/mes" },
  { clave: "10_cuotas", nombre: "10 cuotas", periodo: "/cuota" },
  { clave: "8_cuotas", nombre: "8 cuotas", periodo: "/cuota" },
  { clave: "5_cuotas", nombre: "5 cuotas", periodo: "/cuota" },
  { clave: "inicial_40_4", nombre: "Inicial 40% + 4 cuotas", periodo: "/cuota" },
];
export const CUOTAS_BASE = ["anual", "semestral", "trimestral", "mensual"];

export type LineaCuota = { clave: string; nombre: string; periodo: string; valor: number; inicial?: number };

/** Valor de cada forma de pago a partir de la prima anual. Cuatrimestral = anual/3; N cuotas = anual/N (redondeo arriba).
 *  "Inicial 40% + 4 cuotas": inicial = 40% del anual y 4 cuotas iguales con el 60% restante (regla supuesta, sin verificar). */
export function cuotasDelPlan(anual: number, claves: string[] | null | undefined): LineaCuota[] {
  const activas = claves && claves.length > 0 ? claves : CUOTAS_BASE;
  const dividir: Record<string, number> = {
    anual: 1,
    semestral: 2,
    cuatrimestral: 3,
    trimestral: 4,
    mensual: 12,
    "10_cuotas": 10,
    "8_cuotas": 8,
    "5_cuotas": 5,
  };
  return CUOTAS.filter((c) => activas.includes(c.clave)).map((c) => {
    if (c.clave === "inicial_40_4")
      return { ...c, valor: redondeoArriba((anual * 0.6) / 4), inicial: redondeoArriba(anual * 0.4) };
    return { ...c, valor: redondeoArriba(anual / dividir[c.clave]) };
  });
}

/** Cuota "principal" para destacar: la más frecuente que ofrece el plan (mensual, trimestral, …, anual). */
export function cuotaPrincipal(anual: number, claves: string[] | null | undefined): LineaCuota {
  const lineas = cuotasDelPlan(anual, claves);
  for (const k of ["mensual", "trimestral", "cuatrimestral", "semestral", "anual"]) {
    const l = lineas.find((x) => x.clave === k);
    if (l) return l;
  }
  return lineas[0] ?? { clave: "anual", nombre: "Anual", periodo: "/año", valor: anual };
}

export const redondeoArriba = (n: number) => Math.ceil(n - 1e-9);

export const fraccionar = (anual: number) => ({
  semestral: redondeoArriba(anual / 2),
  trimestral: redondeoArriba(anual / 4),
  mensual: redondeoArriba(anual / 12),
});

const enRango = (edad: number, min: number | null, max: number | null) =>
  (min === null || edad >= min) && (max === null || edad <= max);

/** Entre varias tarifas candidatas para una edad, la de tramo más estrecho (más específica). */
function masEspecifica(candidatas: TarifaCalc[]): TarifaCalc | null {
  if (candidatas.length === 0) return null;
  return [...candidatas].sort((a, b) => a.edad_max - a.edad_min - (b.edad_max - b.edad_min))[0];
}

/** Costo del add-on para una tarifa y una persona: null si no está disponible. */
function costoAddon(
  tarifa: TarifaCalc,
  plan: PlanCalc,
  addonId: string,
  edad: number,
): { costo: number; incluido: boolean } | null {
  const valor = tarifa.tarifa_addons.find((x) => x.addon_id === addonId);
  if (!valor) return null;
  const regla = plan.plan_addons.find((x) => x.addon_id === addonId);
  if (regla && !enRango(edad, regla.edad_min, regla.edad_max)) return { costo: 0, incluido: false };
  if (valor.incluido) return { costo: 0, incluido: true };
  const costo = valor.costo ?? 0;
  return { costo, incluido: costo === 0 };
}

export function calcularOpciones(params: {
  planes: PlanCalc[];
  tarifas: TarifaCalc[];
  addonsCatalogo: AddonCat[];
  asegurados: Asegurado[];
  coberturas: number[];
  addonsElegidos: string[];
  /** Add-ons elegidos por aseguradora (id de aseguradora → add-ons); sustituye a `addonsElegidos` para esa empresa. */
  addonsPorAseguradora?: Record<string, string[]>;
  renovacion: boolean;
  deducibleElegido?: Record<string, number>;
}): Opcion[] {
  const { planes, tarifas, addonsCatalogo, asegurados, coberturas, addonsElegidos, renovacion } = params;
  const salida: Opcion[] = [];
  const n = asegurados.length;
  if (n === 0) return salida;

  for (const plan of planes) {
    if (!plan.activo || !plan.aseguradora.activa) continue;
    if (renovacion && !plan.aseguradora.renovacion_habilitada) continue;

    for (const cobertura of coberturas) {
      const delPlan = tarifas.filter((t) => t.plan_id === plan.id && Number(t.cobertura_monto) === cobertura);
      if (delPlan.length === 0) continue;

      if (plan.modalidad === "por_grupo") {
        if (plan.grupo_min === null || plan.grupo_max === null || n < plan.grupo_min || n > plan.grupo_max) continue;
      }

      const deducibles = [...new Set(delPlan.map((t) => Number(t.deducible)))].sort((a, b) => a - b);
      const posibles: { ded: number; filas: (TarifaCalc | null)[] }[] = [];

      for (const ded of deducibles) {
        const delDed = delPlan.filter((t) => Number(t.deducible) === ded);
        if (plan.modalidad === "por_grupo") {
          const fila = delDed.find((t) => t.tamano_grupo === n);
          // Todos deben estar dentro del tramo de edad de la tarifa del grupo
          if (!fila || asegurados.some((a) => !enRango(a.edad, fila.edad_min, fila.edad_max))) continue;
          posibles.push({ ded, filas: [fila] });
        } else {
          const filas = asegurados.map((a) =>
            masEspecifica(delDed.filter((t) => t.tamano_grupo === 0 && enRango(a.edad, t.edad_min, t.edad_max))),
          );
          if (filas.some((f) => f === null)) continue;
          posibles.push({ ded, filas });
        }
      }
      if (posibles.length === 0) continue;

      const dedElegido = params.deducibleElegido?.[`${plan.id}|${cobertura}`];
      const elegido = posibles.find((p) => p.ded === dedElegido) ?? posibles[0];
      const dedsValidos = posibles.map((p) => p.ded);

      let base = 0;
      const porPersona = asegurados.map((a, i) => {
        const fila = plan.modalidad === "por_grupo" ? elegido.filas[0] : elegido.filas[i];
        const b = plan.modalidad === "por_grupo" ? null : Number(fila!.prima_base);
        if (b !== null) base += b;
        return { nombre: a.nombre, edad: a.edad, base: b, addons: 0 };
      });
      if (plan.modalidad === "por_grupo") base = Number(elegido.filas[0]!.prima_base);

      // Add-ons por persona
      const lineas: LineaAddon[] = [];
      const elegidosEmpresa = params.addonsPorAseguradora?.[plan.aseguradora.id] ?? addonsElegidos;
      for (const addonId of elegidosEmpresa) {
        let total = 0;
        let personas = 0;
        let disponible = false;
        let todoIncluido = true;
        const soloSexo = addonsCatalogo.find((x) => x.id === addonId)?.solo_sexo ?? null;
        asegurados.forEach((a, i) => {
          if (soloSexo && a.sexo !== soloSexo) return;
          const fila = plan.modalidad === "por_grupo" ? elegido.filas[0]! : elegido.filas[i]!;
          const c = costoAddon(fila, plan, addonId, a.edad);
          if (!c) return;
          disponible = true;
          const regla = plan.plan_addons.find((x) => x.addon_id === addonId);
          const aplica = !regla || enRango(a.edad, regla.edad_min, regla.edad_max);
          if (!aplica) return;
          personas += 1;
          total += c.costo;
          if (!c.incluido) todoIncluido = false;
          porPersona[i].addons += c.costo;
        });
        if (disponible && personas > 0) {
          lineas.push({
            addon_id: addonId,
            nombre: addonsCatalogo.find((x) => x.id === addonId)?.nombre ?? addonId,
            total,
            incluido: todoIncluido,
            personas,
          });
        }
      }

      const subtotal = base + lineas.reduce((s, l) => s + l.total, 0);
      const recargo = renovacion ? (subtotal * plan.aseguradora.recargo_renovacion_pct) / 100 : 0;
      const anual = redondeoArriba(subtotal + recargo);

      salida.push({
        clave: `${plan.id}|${cobertura}`,
        plan_id: plan.id,
        plan: plan.nombre,
        tipo: plan.tipo,
        aseguradora_id: plan.aseguradora.id,
        aseguradora: plan.aseguradora.nombre,
        recomendado: plan.recomendado,
        mas_vendido: plan.mas_vendido,
        cobertura,
        deducible: elegido.ded,
        deducibles: dedsValidos,
        base,
        addons: lineas,
        recargo,
        anual,
        ...fraccionar(anual),
        porPersona,
        cuotas: plan.cuotas && plan.cuotas.length > 0 ? plan.cuotas : CUOTAS_BASE,
      });
    }
  }

  return salida.sort(
    (a, b) => a.aseguradora.localeCompare(b.aseguradora) || a.cobertura - b.cobertura || a.anual - b.anual,
  );
}
