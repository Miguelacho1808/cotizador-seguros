import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  TIPOS_BLOQUE,
  VARIABLES,
  aplicarVariables,
  bloqueNuevo,
  bloquesAHtml,
  tablaPlanesHtml,
  variablesCorreo,
  type Bloque,
  type Plantilla,
} from "../lib/plantillasCorreo";
import { Aviso, Boton, inputCls, type Mensaje } from "./ui";

const ANCHOS = { escritorio: "100%", tablet: "768px", movil: "375px" } as const;

export default function PlantillaEditor({ plantilla, onVolver }: { plantilla: Plantilla; onVolver: () => void }) {
  const { perfil } = useAuth();
  const [nombre, setNombre] = useState(plantilla.nombre);
  const asunto = plantilla.asunto;
  const cuerpo = plantilla.cuerpo;
  const [bloques, setBloques] = useState<Bloque[]>(plantilla.bloques ?? []);
  const [codigo, setCodigo] = useState<string | null>(plantilla.bloques ? null : plantilla.html);
  const [disp, setDisp] = useState<keyof typeof ANCHOS>("escritorio");
  const [msg, setMsg] = useState<Mensaje | null>(null);
  const [org, setOrg] = useState<{ nombre: string; logo_url: string | null } | null>(null);
  const [wa, setWa] = useState("");

  useEffect(() => {
    supabase.from("organizacion").select("nombre,logo_url").limit(1).maybeSingle().then(({ data }) => setOrg(data as typeof org));
    if (perfil)
      supabase
        .from("perfiles")
        .select("whatsapp,telefono")
        .eq("id", perfil.id)
        .maybeSingle()
        .then(({ data }) => {
          const d = data as { whatsapp: string | null; telefono: string | null } | null;
          setWa(d?.whatsapp ?? d?.telefono ?? "");
        });
  }, [perfil]);

  const html = codigo ?? bloquesAHtml(bloques);
  const vista = useMemo(() => {
    const vars = variablesCorreo({
      orgNombre: org?.nombre ?? "Tu empresa",
      orgLogo: org?.logo_url ?? null,
      cliente: "María Pérez",
      numero: 123,
      enlace: "#",
      asesor: [perfil?.nombre, perfil?.apellido].filter(Boolean).join(" ") || "Tu nombre",
      whatsapp: wa || "+58 424 000 0000",
      planesTabla: tablaPlanesHtml(
        [
          { aseguradora: "Aseguradora A", logo: null, plan: "Salud", tipo: "hcm", cobertura: 100000, coberturas: ["Hospitalización y Cirugía", "Viajes", "Funerario"], mensual: 73, trimestral: 219, anual: 873 },
          { aseguradora: "Aseguradora B", logo: null, plan: "Salud Plus", tipo: "hcm", cobertura: 100000, coberturas: ["Hospitalización y Cirugía", "Funerario"], mensual: null, trimestral: 183, anual: 729 },
        ],
        ["Hospitalización y Cirugía", "Sin Deducible", "Entrega de Medicamentos", "Cartas Avales y Reembolsos", "Cobertura Nacional", "Servicio de APS", "Emergencias 24/7", "Servicio de Ambulancia"],
        2,
      ),
      aseguradoras: "Aseguradora A, Aseguradora B",
      desde: "US$ 675",
    });
    return `<!doctype html><meta charset="utf-8"><body style="margin:0">${aplicarVariables(html, vars)}</body>`;
  }, [html, org, perfil, wa]);

  const cambiar = (id: string, parcial: Record<string, unknown>) =>
    setBloques(bloques.map((b) => (b.id === id ? ({ ...b, ...parcial } as Bloque) : b)));
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= bloques.length) return;
    const n = [...bloques];
    [n[i], n[j]] = [n[j], n[i]];
    setBloques(n);
  };

  const guardar = async () => {
    if (!nombre.trim() || !asunto.trim()) return setMsg({ tipo: "error", texto: "Nombre y asunto son obligatorios." });
    const r = await supabase
      .from("plantillas_correo")
      .update({
        nombre: nombre.trim(),
        asunto,
        cuerpo,
        bloques: codigo === null ? bloques : null,
        html: codigo === null ? null : html,
        updated_at: new Date().toISOString(),
      })
      .eq("id", plantilla.id);
    setMsg(r.error ? { tipo: "error", texto: r.error.message } : { tipo: "ok", texto: "Plantilla guardada." });
  };

  const alternarCodigo = () => {
    if (codigo === null) return setCodigo(bloquesAHtml(bloques));
    if (!plantilla.bloques && bloques.length === 0) return setMsg({ tipo: "error", texto: "Esta plantilla solo existe como código." });
    if (window.confirm("Volver a bloques descarta los cambios hechos en el código. ¿Continuar?")) setCodigo(null);
  };

  const campo = (b: Bloque, k: string, etiqueta: string, largo = false) => {
    const valor = (b as unknown as Record<string, string>)[k] ?? "";
    return (
      <label key={k} className="block text-xs text-zinc-400">
        {etiqueta}
        {largo ? (
          <textarea rows={3} value={valor} onChange={(e) => cambiar(b.id, { [k]: e.target.value })} className={`${inputCls} mt-1`} />
        ) : (
          <input value={valor} onChange={(e) => cambiar(b.id, { [k]: e.target.value })} className={`${inputCls} mt-1`} />
        )}
      </label>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
        <button onClick={onVolver} className="text-sm text-zinc-400 hover:text-zinc-100">
          ← Plantillas
        </button>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={`${inputCls} max-w-xs font-semibold`} />
        <div className="ml-auto flex items-center gap-2">
          {(Object.keys(ANCHOS) as (keyof typeof ANCHOS)[]).map((k) => (
            <button
              key={k}
              onClick={() => setDisp(k)}
              className={`rounded-md border px-2 py-1 text-xs ${disp === k ? "border-indigo-400 bg-indigo-500/20" : "border-zinc-700 hover:bg-zinc-800"}`}
            >
              {k === "escritorio" ? "🖥 Escritorio" : k === "tablet" ? "▭ Tablet" : "📱 Móvil"}
            </button>
          ))}
          <Boton variante="secundario" onClick={alternarCodigo}>
            {codigo === null ? "Editar código" : "Volver a bloques"}
          </Boton>
          <Boton onClick={guardar}>Guardar</Boton>
        </div>
      </div>
      <Aviso mensaje={msg} />

      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <div className="overflow-auto rounded-xl border border-zinc-800 bg-slate-200 p-3">
          <iframe
            title="Vista previa"
            srcDoc={vista}
            sandbox=""
            style={{ width: ANCHOS[disp], maxWidth: "100%", height: 640, background: "#eef2f7" }}
            className="mx-auto block rounded-lg border-0"
          />
        </div>

        <div className="space-y-3">
          {codigo !== null ? (
            <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-xs text-zinc-400">HTML del correo (estilos en línea):</p>
              <textarea rows={16} value={codigo} onChange={(e) => setCodigo(e.target.value)} className={`${inputCls} font-mono text-xs`} />
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Agregar bloque</p>
                <div className="flex flex-wrap gap-1.5">
                  {TIPOS_BLOQUE.map((t) => (
                    <button
                      key={t.tipo}
                      onClick={() => setBloques([...bloques, bloqueNuevo(t.tipo)])}
                      className="rounded-md border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800"
                    >
                      + {t.nombre}
                    </button>
                  ))}
                </div>
              </div>
              {bloques.map((b, i) => (
                <div key={b.id} className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                      {TIPOS_BLOQUE.find((t) => t.tipo === b.tipo)?.nombre}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => mover(i, -1)} className="rounded border border-zinc-700 px-1.5 text-xs hover:bg-zinc-800">↑</button>
                      <button onClick={() => mover(i, 1)} className="rounded border border-zinc-700 px-1.5 text-xs hover:bg-zinc-800">↓</button>
                      <button
                        onClick={() => setBloques(bloques.filter((x) => x.id !== b.id))}
                        className="rounded border border-red-500/40 px-1.5 text-xs text-red-400 hover:bg-red-500/10"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {b.tipo === "header" && (
                    <>
                      {campo(b, "titulo", "Título")}
                      {campo(b, "subtitulo", "Subtítulo")}
                      <label className="flex items-center gap-2 text-xs text-zinc-400">
                        <input type="checkbox" checked={b.logo} onChange={(e) => cambiar(b.id, { logo: e.target.checked })} />
                        Mostrar logo
                      </label>
                    </>
                  )}
                  {b.tipo === "saludo" && (
                    <>
                      {campo(b, "titulo", "Saludo")}
                      {campo(b, "texto", "Mensaje", true)}
                    </>
                  )}
                  {b.tipo === "tabla" && campo(b, "titulo", "Título de la tabla (opcional)")}
                  {b.tipo === "boton" && (
                    <>
                      {campo(b, "texto", "Texto del botón")}
                      {campo(b, "enlace", "Enlace")}
                    </>
                  )}
                  {b.tipo === "texto" && campo(b, "texto", "Texto", true)}
                  {b.tipo === "footer" && campo(b, "texto", "Texto del pie")}
                </div>
              ))}
            </>
          )}
          <p className="text-xs text-zinc-500">
            Variables: {VARIABLES.map(([v, d]) => `${v} (${d})`).join(" · ")}
          </p>
        </div>
      </div>
    </div>
  );
}
