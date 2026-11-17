import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Res = { clave: string; grupo: string; titulo: string; detalle: string; ruta: string };

export default function BuscadorGlobal() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Res[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  // Atajo "/" para enfocar el buscador
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const f = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", f);
    return () => document.removeEventListener("mousedown", f);
  }, []);

  useEffect(() => {
    const txt = q.trim().replace(/[%,()]/g, " ").trim();
    if (txt.length < 2) {
      setRes([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    let vigente = true;
    const t = setTimeout(async () => {
      const cl = await supabase
        .from("clientes")
        .select("id,nombre,apellido,cedula,telefono,email")
        .or(
          `nombre.ilike.%${txt}%,apellido.ilike.%${txt}%,cedula.ilike.%${txt}%,telefono.ilike.%${txt}%,email.ilike.%${txt}%`,
        )
        .limit(5);
      const clientes = (cl.data as { id: string; nombre: string; apellido: string | null; cedula: string | null; telefono: string | null; email: string | null }[]) ?? [];

      const filtros: string[] = [];
      if (clientes.length > 0) filtros.push(`cliente_id.in.(${clientes.map((c) => c.id).join(",")})`);
      if (/^\d+$/.test(txt)) filtros.push(`numero.eq.${txt}`);
      const [co, as] = await Promise.all([
        filtros.length
          ? supabase
              .from("cotizaciones")
              .select("id,numero,estado,clientes(nombre,apellido)")
              .or(filtros.join(","))
              .order("created_at", { ascending: false })
              .limit(5)
          : Promise.resolve({ data: [] as unknown[] }),
        supabase.from("aseguradoras").select("id,nombre").ilike("nombre", `%${txt}%`).limit(4),
      ]);
      if (!vigente) return;

      const salida: Res[] = [];
      for (const c of clientes)
        salida.push({
          clave: `c${c.id}`,
          grupo: "Clientes",
          titulo: [c.nombre, c.apellido].filter(Boolean).join(" "),
          detalle: [c.cedula, c.telefono, c.email].filter(Boolean).join(" · "),
          ruta: `/clientes/${c.id}`,
        });
      for (const x of ((co.data as unknown as { id: string; numero: number; estado: string; clientes: { nombre: string; apellido: string | null } | null }[]) ?? []))
        salida.push({
          clave: `q${x.id}`,
          grupo: "Cotizaciones",
          titulo: `#${x.numero} · ${[x.clientes?.nombre, x.clientes?.apellido].filter(Boolean).join(" ") || "Sin cliente"}`,
          detalle: x.estado,
          ruta: `/cotizaciones/${x.id}`,
        });
      for (const a of ((as.data as { id: string; nombre: string }[]) ?? []))
        salida.push({ clave: `a${a.id}`, grupo: "Aseguradoras", titulo: a.nombre, detalle: "", ruta: `/aseguradoras/${a.id}` });
      setRes(salida);
      setBuscando(false);
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [q]);

  const ir = (ruta: string) => {
    setAbierto(false);
    setQ("");
    navigate(ruta);
  };

  const grupos = [...new Set(res.map((r) => r.grupo))];
  const hayTexto = q.trim().length >= 2;

  return (
    <div ref={caja} className="relative w-full max-w-xl print:hidden">
      <input
        ref={input}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setAbierto(false);
          if (e.key === "Enter" && res[0]) ir(res[0].ruta);
        }}
        placeholder="Buscar clientes, cotizaciones, aseguradoras…  ( / )"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
      />
      {abierto && hayTexto && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-96 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
          {buscando && res.length === 0 && <p className="p-2 text-sm text-zinc-400">Buscando…</p>}
          {!buscando && res.length === 0 && <p className="p-2 text-sm text-zinc-400">Sin resultados.</p>}
          {grupos.map((g) => (
            <div key={g} className="mb-1">
              <p className="px-2 py-1 text-xs uppercase tracking-wide text-zinc-500">{g}</p>
              {res
                .filter((r) => r.grupo === g)
                .map((r) => (
                  <button
                    key={r.clave}
                    onClick={() => ir(r.ruta)}
                    className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-zinc-800"
                  >
                    <span className="block text-sm font-medium">{r.titulo}</span>
                    {r.detalle && <span className="block text-xs text-zinc-500">{r.detalle}</span>}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
