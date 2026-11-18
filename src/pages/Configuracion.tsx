import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import PlantillasCorreo from "../components/PlantillasCorreo";
import SubirLogo from "../components/SubirLogo";
import { Aviso, Boton, Campo, Seccion, inputCls, type Mensaje } from "../components/ui";

const CAMPOS: [string, string][] = [
  ["nombre", "Nombre de la empresa"],
  ["rif", "RIF"],
  ["licencia", "Licencia de corretaje"],
  ["telefono", "Teléfono"],
  ["direccion", "Dirección"],
];

export default function Configuracion() {
  const { perfil } = useAuth();
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

  if (perfil?.rol !== "admin") {
    return <p className="text-zinc-400">Solo los administradores pueden cambiar la configuración.</p>;
  }
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
      <h1 className="text-3xl font-bold">Configuración</h1>
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

      <PlantillasCorreo />
    </div>
  );
}
