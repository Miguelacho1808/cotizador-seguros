export type Plantilla = { id: string; nombre: string; asunto: string; cuerpo: string; predeterminada: boolean };

export const VARIABLES: [string, string][] = [
  ["{cliente}", "Nombre del cliente"],
  ["{numero}", "N.º de cotización"],
  ["{enlace}", "Enlace público"],
  ["{aseguradoras}", "Aseguradoras cotizadas"],
  ["{desde}", "Prima anual más baja"],
  ["{asesor}", "Tu nombre"],
  ["{empresa}", "Nombre de la empresa"],
];

export const aplicarVariables = (texto: string, v: Record<string, string>) =>
  texto.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? v[k] : m));
