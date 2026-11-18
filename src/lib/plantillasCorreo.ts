export type Bloque =
  | { id: string; tipo: "header"; titulo: string; subtitulo: string; logo: boolean }
  | { id: string; tipo: "saludo"; titulo: string; texto: string }
  | { id: string; tipo: "tabla"; titulo: string }
  | { id: string; tipo: "boton"; texto: string; enlace: string }
  | { id: string; tipo: "texto"; texto: string }
  | { id: string; tipo: "separador" }
  | { id: string; tipo: "footer"; texto: string };

export type Plantilla = {
  id: string;
  nombre: string;
  asunto: string;
  cuerpo: string;
  predeterminada: boolean;
  html: string | null;
  bloques: Bloque[] | null;
  updated_at: string;
};

export const TIPOS_BLOQUE: { tipo: Bloque["tipo"]; nombre: string }[] = [
  { tipo: "header", nombre: "Header Org" },
  { tipo: "saludo", nombre: "Saludo" },
  { tipo: "tabla", nombre: "Tabla de Planes" },
  { tipo: "boton", nombre: "Botón PDF" },
  { tipo: "footer", nombre: "Footer Org" },
  { tipo: "texto", nombre: "Texto" },
  { tipo: "separador", nombre: "Separador" },
];

const uid = () => Math.random().toString(36).slice(2, 9);

export function bloqueNuevo(tipo: Bloque["tipo"]): Bloque {
  const id = uid();
  switch (tipo) {
    case "header":
      return { id, tipo, titulo: "{{org_nombre}}", subtitulo: "SEGUROS DE PERSONAS", logo: true };
    case "saludo":
      return {
        id,
        tipo,
        titulo: "Hola, {{cliente_nombre}}",
        texto: "Te compartimos tu cotización #{{cotizacion_numero}} de seguros de personas.\nPuedes ver el detalle completo de los planes comparados en el enlace.",
      };
    case "tabla":
      return { id, tipo, titulo: "Planes cotizados" };
    case "boton":
      return { id, tipo, texto: "Ver cotización", enlace: "{{enlace}}" };
    case "texto":
      return { id, tipo, texto: "Escribe aquí tu mensaje." };
    case "separador":
      return { id, tipo };
    case "footer":
      return { id, tipo, texto: "Habla con: {{asesor_nombre}} · WhatsApp: {{asesor_whatsapp}}" };
  }
}

export const bloquesPorDefecto = (): Bloque[] => [
  bloqueNuevo("header"),
  bloqueNuevo("saludo"),
  bloqueNuevo("tabla"),
  bloqueNuevo("boton"),
  bloqueNuevo("footer"),
];

const AZUL = "#1e3a5f";
const TEAL = "#3aa6a6";
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const nl2br = (s: string) => s.replace(/\n/g, "<br>");

/** HTML de correo (tablas con estilos en línea, 600 px) a partir de los bloques. */
export function bloquesAHtml(bloques: Bloque[]): string {
  const filas = bloques
    .map((b) => {
      switch (b.tipo) {
        case "header":
          return `<tr><td style="background:#f8fafc;padding:28px 32px;border-bottom:3px solid ${TEAL}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${b.logo ? `<td width="1" style="padding-right:16px;vertical-align:middle">{{org_logo_img}}</td>` : ""}
<td style="vertical-align:middle"><div style="font-size:22px;font-weight:700;color:${AZUL};font-family:Georgia,serif">${b.titulo}</div>
<div style="font-size:11px;letter-spacing:2px;color:${TEAL};margin-top:4px">${b.subtitulo}</div></td></tr></table></td></tr>`;
        case "saludo":
          return `<tr><td style="padding:28px 32px 8px;font-family:Georgia,serif;color:#1f2937">
<div style="font-size:18px;font-weight:700;color:${AZUL};margin-bottom:10px">${b.titulo}</div>
<div style="font-size:14px;line-height:1.6">${nl2br(b.texto)}</div></td></tr>`;
        case "tabla":
          return `<tr><td style="padding:12px 32px;font-family:Arial,sans-serif">
${b.titulo ? `<div style="font-size:13px;font-weight:700;color:${AZUL};margin-bottom:8px">${b.titulo}</div>` : ""}{{planes_tabla}}</td></tr>`;
        case "boton":
          return `<tr><td align="center" style="padding:18px 32px"><a href="${b.enlace}" style="display:inline-block;background:${TEAL};color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px">${b.texto}</a></td></tr>`;
        case "texto":
          return `<tr><td style="padding:12px 32px;font-family:Georgia,serif;font-size:14px;line-height:1.6;color:#1f2937">${nl2br(b.texto)}</td></tr>`;
        case "separador":
          return `<tr><td style="padding:8px 32px"><div style="border-top:1px solid #e5e7eb"></div></td></tr>`;
        case "footer":
          return `<tr><td align="center" style="background:${AZUL};color:#ffffff;padding:18px 32px;font-family:Georgia,serif;font-size:12px">${b.texto}</td></tr>`;
      }
    })
    .join("\n");
  return `<div style="background:#eef2f7;padding:24px 12px"><table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
${filas}
</table></div>`;
}

export const htmlDePlantilla = (p: Pick<Plantilla, "html" | "bloques">) =>
  p.html ?? bloquesAHtml(p.bloques ?? bloquesPorDefecto());

export const VARIABLES: [string, string][] = [
  ["{{org_nombre}}", "Nombre de la empresa"],
  ["{{org_logo_img}}", "Logo de la empresa"],
  ["{{cliente_nombre}}", "Nombre del cliente"],
  ["{{cotizacion_numero}}", "N.º de cotización"],
  ["{{planes_tabla}}", "Tabla de planes"],
  ["{{enlace}}", "Enlace público"],
  ["{{asesor_nombre}}", "Nombre del asesor"],
  ["{{asesor_whatsapp}}", "WhatsApp del asesor"],
  ["{{aseguradoras}}", "Aseguradoras cotizadas"],
  ["{{desde}}", "Prima anual más baja"],
];

/** Reemplaza {{variable}} y también {variable} (formato anterior). */
export const aplicarVariables = (texto: string, v: Record<string, string>) =>
  texto
    .replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in v ? v[k] : m))
    .replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? v[k] : m));

/** Variables comunes para la vista previa y el envío. */
export function variablesCorreo(d: {
  orgNombre: string;
  orgLogo: string | null;
  cliente: string;
  numero: number | string;
  enlace: string;
  asesor: string;
  whatsapp: string;
  planesTabla: string;
  aseguradoras: string;
  desde: string;
}): Record<string, string> {
  return {
    org_nombre: esc(d.orgNombre),
    org_logo_img: d.orgLogo
      ? `<img src="${esc(d.orgLogo)}" alt="${esc(d.orgNombre)}" height="64" style="display:block;max-height:64px;max-width:160px">`
      : "",
    cliente_nombre: esc(d.cliente),
    cotizacion_numero: String(d.numero),
    planes_tabla: d.planesTabla,
    enlace: esc(d.enlace),
    asesor_nombre: esc(d.asesor),
    asesor_whatsapp: esc(d.whatsapp),
    aseguradoras: esc(d.aseguradoras),
    desde: d.desde,
    // formato anterior {variable}
    cliente: d.cliente,
    numero: String(d.numero),
    asesor: d.asesor,
    empresa: d.orgNombre,
  };
}

export type PlanTabla = { aseguradora: string; plan: string; cobertura: number; deducible: number; mensual: number; anual: number };
const usd = (n: number) => `US$ ${Math.round(n).toLocaleString("es-ES", { maximumFractionDigits: 0 })}`;

export function tablaPlanesHtml(planes: PlanTabla[]): string {
  const th = "padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;border-bottom:1px solid #e5e7eb;background:#f8fafc";
  const td = "padding:9px 10px;font-size:13px;color:#1f2937;border-bottom:1px solid #eef2f7";
  const filas = planes
    .map(
      (p) =>
        `<tr><td style="${td}"><b>${esc(p.aseguradora)}</b><br><span style="color:#6b7280;font-size:12px">${esc(p.plan)}</span></td><td style="${td}">${usd(p.cobertura)}</td><td style="${td}">${p.deducible > 0 ? usd(p.deducible) : "—"}</td><td style="${td};text-align:right">${usd(p.mensual)}<br><span style="color:#6b7280;font-size:11px">${usd(p.anual)}/año</span></td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;border-collapse:separate"><tr><th style="${th}">Plan</th><th style="${th}">Cobertura</th><th style="${th}">Deducible</th><th style="${th};text-align:right">Prima</th></tr>${filas}</table>`;
}
