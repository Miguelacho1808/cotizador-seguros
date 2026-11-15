/** Foto de perfil o, si no hay, las iniciales del nombre. */
export default function Avatar({ url, nombre, tam }: { url: string | null; nombre: string; tam: string }) {
  const iniciales =
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join("") || "?";
  return url ? (
    <img src={url} alt={nombre} className={`${tam} shrink-0 rounded-full object-cover`} />
  ) : (
    <span
      className={`${tam} flex shrink-0 items-center justify-center rounded-full bg-zinc-100 font-bold text-zinc-800`}
    >
      {iniciales}
    </span>
  );
}
