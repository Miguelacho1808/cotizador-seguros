export type ClienteExport = {
  nombre: string;
  apellido: string | null;
  cedula: string | null;
  telefono: string | null;
  email: string | null;
  created_at: string;
  perfiles: { nombre: string | null; apellido: string | null } | null;
  cotizaciones: { count: number }[];
};

const COLUMNAS = ["Nombre", "Apellido", "Cédula", "Teléfono", "Email", "Asesor", "Cotizaciones", "Registrado"];

const filas = (datos: ClienteExport[]): (string | number)[][] =>
  datos.map((c) => [
    c.nombre ?? "",
    c.apellido ?? "",
    c.cedula ?? "",
    c.telefono ?? "",
    c.email ?? "",
    [c.perfiles?.nombre, c.perfiles?.apellido].filter(Boolean).join(" "),
    c.cotizaciones?.[0]?.count ?? 0,
    new Date(c.created_at).toLocaleDateString("es-VE"),
  ]);

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ---------- Excel (.xlsx real, sin librerías) ---------- */
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (b: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = TABLA_CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** ZIP sin compresión (método 0): suficiente para un .xlsx. */
function zip(archivos: { nombre: string; datos: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let pos = 0;
  const u16 = (v: DataView, o: number, n: number) => v.setUint16(o, n, true);
  const u32 = (v: DataView, o: number, n: number) => v.setUint32(o, n, true);
  for (const a of archivos) {
    const nom = enc.encode(a.nombre);
    const crc = crc32(a.datos);
    const lh = new Uint8Array(30 + nom.length);
    const v = new DataView(lh.buffer);
    u32(v, 0, 0x04034b50); u16(v, 4, 20); u16(v, 6, 0x0800); u16(v, 8, 0); u16(v, 10, 0); u16(v, 12, 0x21);
    u32(v, 14, crc); u32(v, 18, a.datos.length); u32(v, 22, a.datos.length); u16(v, 26, nom.length); u16(v, 28, 0);
    lh.set(nom, 30);
    partes.push(lh, a.datos);
    const ch = new Uint8Array(46 + nom.length);
    const w = new DataView(ch.buffer);
    u32(w, 0, 0x02014b50); u16(w, 4, 20); u16(w, 6, 20); u16(w, 8, 0x0800); u16(w, 10, 0); u16(w, 12, 0); u16(w, 14, 0x21);
    u32(w, 16, crc); u32(w, 20, a.datos.length); u32(w, 24, a.datos.length); u16(w, 28, nom.length);
    u32(w, 42, pos);
    ch.set(nom, 46);
    central.push(ch);
    pos += lh.length + a.datos.length;
  }
  const tamCentral = central.reduce((s, c) => s + c.length, 0);
  const fin = new Uint8Array(22);
  const f = new DataView(fin.buffer);
  u32(f, 0, 0x06054b50); u16(f, 8, archivos.length); u16(f, 10, archivos.length); u32(f, 12, tamCentral); u32(f, 16, pos);
  const todo = [...partes, ...central, fin];
  const salida = new Uint8Array(todo.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of todo) {
    salida.set(p, o);
    o += p.length;
  }
  return salida;
}

const letra = (i: number) => String.fromCharCode(65 + i);

function crearXlsx(datos: ClienteExport[]): Blob {
  const enc = new TextEncoder();
  const celda = (v: string | number, r: number, c: number, estilo: number) =>
    typeof v === "number"
      ? `<c r="${letra(c)}${r}" s="${estilo}"><v>${v}</v></c>`
      : `<c r="${letra(c)}${r}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  const todas: (string | number)[][] = [COLUMNAS, ...filas(datos)];
  const filasXml = todas
    .map((f, i) => `<row r="${i + 1}">${f.map((v, c) => celda(v, i + 1, c, i === 0 ? 1 : 0)).join("")}</row>`)
    .join("");
  const anchos = [18, 18, 14, 18, 30, 24, 14, 14];
  const cols = anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  const x = (s: string) => enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${s}`);
  const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  return new Blob(
    [
      zip([
        {
          nombre: "[Content_Types].xml",
          datos: x(
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
          ),
        },
        {
          nombre: "_rels/.rels",
          datos: x(
            `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
          ),
        },
        {
          nombre: "xl/workbook.xml",
          datos: x(`<workbook ${ns} xmlns:r="${rel}"><sheets><sheet name="Clientes" sheetId="1" r:id="rId1"/></sheets></workbook>`),
        },
        {
          nombre: "xl/_rels/workbook.xml.rels",
          datos: x(
            `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${rel}/styles" Target="styles.xml"/></Relationships>`,
          ),
        },
        {
          nombre: "xl/styles.xml",
          datos: x(
            `<styleSheet ${ns}><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF3730A3"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
          ),
        },
        {
          nombre: "xl/worksheets/sheet1.xml",
          datos: x(
            `<worksheet ${ns}><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${filasXml}</sheetData></worksheet>`,
          ),
        },
      ]),
    ],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  );
}

const fechaArchivo = () => new Date().toISOString().slice(0, 10);

export function descargarExcel(datos: ClienteExport[]) {
  const url = URL.createObjectURL(crearXlsx(datos));
  const a = document.createElement("a");
  a.href = url;
  a.download = `clientes-${fechaArchivo()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Abre una hoja imprimible; en el diálogo se elige "Guardar como PDF". `ventana` se abre en el clic para evitar el bloqueo de ventanas. */
export function descargarPdf(datos: ClienteExport[], ventana: Window) {
  const cuerpo = filas(datos)
    .map((f) => `<tr>${f.map((v, i) => `<td${i === 6 ? ' class="n"' : ""}>${esc(String(v))}</td>`).join("")}</tr>`)
    .join("");
  ventana.document.open();
  ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Clientes ${fechaArchivo()}</title>
<style>
@page{size:A4 landscape;margin:12mm}
body{font-family:Arial,Helvetica,sans-serif;color:#18181b;margin:0}
h1{font-size:18px;margin:0 0 2px}p{margin:0 0 10px;font-size:11px;color:#52525b}
table{width:100%;border-collapse:collapse;font-size:10px}
th{background:#3730a3;color:#fff;text-align:left;padding:5px 6px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
td{padding:4px 6px;border-bottom:1px solid #e4e4e7}td.n{text-align:right}
tr{break-inside:avoid}thead{display:table-header-group}
</style></head><body>
<h1>Clientes</h1><p>${datos.length} registros · ${new Date().toLocaleDateString("es-VE")}</p>
<table><thead><tr>${COLUMNAS.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${cuerpo}</tbody></table>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
</body></html>`);
  ventana.document.close();
}
