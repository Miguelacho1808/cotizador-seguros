import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import PlantillasCorreo from "../components/PlantillasCorreo";
import CatalogoSimple from "../components/CatalogoSimple";
import CatalogoCoberturas from "../components/CatalogoCoberturas";
import Usuarios from "./Usuarios";
import SubirLogo from "../components/SubirLogo";
import { Aviso, Boton, Campo, Seccion, inputCls, type Mensaje } from "../components/ui";

const CAMPOS: [string, string][] = [
  ["nombre", "Nombre de la empresa"],
  ["rif", "RIF"],
  ["licencia", "Licencia de corretaje"],
  ["telefono", "Teléfono"],
  ["direccion", "Dirección"],
];

function Organizacion() {
  const [f, setF] = useState<Record<string, string> | null>(null);
  const [msg, setMsg] = useState<Mensaje | null>(null);
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("organizacion")
      .select("nombre,rif,licencia,telefono,direccion,logo_url")
      .limit(1)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setMsg({ tipo: "error", texto: error.message });
          return;
        }
        const r = data as Record<string, string | null>;
        setLogo(r.logo_url ?? null);
        setF(Object.fromEntries(CAMPOS.map(([k]) => [k, r[k] ?? ""])));
      });
  }, []);

  if (!f) return <div>{msg ? <Aviso mensaje={msg} /> : <p className="text-zinc-400">Cargando…</p>}</div>;

  const guardar = async () => {
    setMsg(null);
    if (!f.nombre.trim()) {
      setMsg({ tipo: "error", texto: "El nombre de la empresa es obligatorio." });
      return;
    }
    const payload = Object.fromEntries(
      CAMPOS.map(([k]) => [k, f[k].trim() === "" ? null : f[k].trim()]),
    );
    payload.nombre = f.nombre.trim();
    const r = await supabase.from("organizacion").update(payload).eq("id", true);
    setMsg(r.error ? { tipo: "error", texto: r.error.message } : { tipo: "ok", texto: "Guardado." });
  };

  return (
    <div className="space-y-6">
      <Seccion
        titulo="Datos de la empresa"
        ayuda="Aparecen en las cotizaciones compartidas y en los PDF."
      >
        <div className="grid gap-3 md:grid-cols-2">
          {CAMPOS.map(([k, etiqueta]) => (
            <Campo key={k} etiqueta={etiqueta}>
              <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={inputCls} />
            </Campo>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Boton onClick={guardar}>Guardar</Boton>
          <Aviso mensaje={msg} />
        </div>
      </Seccion>

      <Seccion titulo="Logo de la empresa" ayuda="Aparece en el encabezado del PDF. Se guarda al subirlo.">
        <SubirLogo
          url={logo}
          carpeta="organizacion"
          onCambio={async (url) => {
            const r = await supabase.from("organizacion").update({ logo_url: url }).eq("id", true);
            if (!r.error) setLogo(url);
            return r.error ? r.error.message : null;
          }}
        />
      </Seccion>

    </div>
  );
}

const SECCIONES: { grupo: string; items: [string, string][] }[] = [
  { grupo: "Organización", items: [["organizacion", "Organización"], ["usuarios", "Usuarios y Roles"], ["plantillas", "Plantillas Email"]] },
  {
    grupo: "Catálogos",
    items: [["coberturas", "Coberturas"], ["canales", "Canales"], ["addons", "Adicionales (Add-ons)"], ["beneficios", "Beneficios"]],
  },
];

export default function Configuracion() {
  const { perfil } = useAuth();
  const [sec, setSec] = useState(() => new URLSearchParams(window.location.search).get("s") ?? "organizacion");
  if (perfil?.rol !== "admin") {
    return <p className="text-zinc-400">Solo los administradores pueden cambiar la configuración.</p>;
  }
  const ir = (k: string) => {
    setSec(k);
    window.history.replaceState(null, "", `?s=${k}`);
  };
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Cuenta</p>
        <h1 className="text-4xl font-extrabold">Configuraciones</h1>
        <p className="text-sm text-zinc-400">Configura tu organización, equipo y catálogos.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <nav className="space-y-4">
          {SECCIONES.map((g) => (
            <div key={g.grupo}>
              <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{g.grupo}</p>
              {g.items.map(([k, n]) => (
                <button
                  key={k}
                  onClick={() => ir(k)}
                  className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm ${
                    sec === k ? "bg-zinc-700 font-semibold" : "text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="min-w-0">
          {sec === "organizacion" && <Organizacion />}
          {sec === "usuarios" && <Usuarios />}
          {sec === "plantillas" && <PlantillasCorreo />}
          {sec === "coberturas" && <CatalogoCoberturas />}
          {sec === "canales" && (
            <CatalogoSimple tabla="canales" titulo="Canales" singular="Canal" conActivo ayuda="Origen de las cotizaciones. Los inactivos no aparecen al cotizar." avisoEliminar="Las cotizaciones ya guardadas conservan su canal." />
          )}
          {sec === "addons" && (
            <CatalogoSimple tabla="addons" titulo="Adicionales (Add-ons)" singular="Adicional" conActivo ayuda="Coberturas opcionales. Se vinculan a planes y tarifas desde Aseguradoras." avisoEliminar="Se borran también sus precios en las tarifas; es mejor desactivarlo." />
          )}
          {sec === "beneficios" && (
            <CatalogoSimple tabla="beneficios" titulo="Catálogo de Beneficios" singular="Beneficio" conActivo={false} ayuda="Beneficios disponibles. Cada plan elige cuáles muestra (en el editor del plan)." avisoEliminar="Se quita de TODOS los planes y no se puede deshacer." />
          )}
        </div>
      </div>
    </div>
  );
}
