/**
 * Deja un teléfono listo para WhatsApp (solo dígitos, con código de país).
 * Supone Venezuela (58) cuando el número viene sin código:
 *   0424 931 9404 → 584249319404 · 424 931 9404 → 584249319404 · +58 0424… → 58424…
 */
export function telefonoWhatsApp(entrada: string | null | undefined): string {
  let d = (entrada ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("580")) d = `58${d.slice(3)}`;
  else if (d.startsWith("0")) d = `58${d.slice(1)}`;
  else if (d.length === 10) d = `58${d}`;
  return d;
}
