import type { ButtonHTMLAttributes, ReactNode } from "react";

export type Mensaje = { tipo: "ok" | "error"; texto: string };

export const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none focus:border-indigo-400";

export const inputChico =
  "w-20 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm outline-none focus:border-indigo-400";

export function Seccion({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div>
        <h2 className="font-semibold">{titulo}</h2>
        {ayuda && <p className="text-sm text-zinc-400">{ayuda}</p>}
      </div>
      {children}
    </section>
  );
}

export function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-zinc-400">{etiqueta}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function Boton({
  variante = "primario",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "primario" | "secundario" | "peligro" }) {
  const base = "rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50";
  const estilo =
    variante === "primario"
      ? "bg-zinc-100 text-zinc-900 hover:bg-white"
      : variante === "peligro"
        ? "border border-red-500/40 text-red-300 hover:bg-red-500/10"
        : "border border-zinc-700 hover:bg-zinc-800";
  return <button {...props} className={`${base} ${estilo} ${className}`} />;
}

export function Aviso({ mensaje }: { mensaje: Mensaje | null }) {
  if (!mensaje) return null;
  return (
    <p className={`text-sm ${mensaje.tipo === "ok" ? "text-emerald-400" : "text-red-400"}`}>{mensaje.texto}</p>
  );
}

export function Casilla({
  checked,
  onChange,
  etiqueta,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  etiqueta: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{etiqueta}</span>
    </label>
  );
}

export const numero = (s: string): number | null => {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};
