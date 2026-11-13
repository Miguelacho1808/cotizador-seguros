import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const configOk = Boolean(url && key);

// Valores de relleno para que la app muestre un aviso en vez de fallar si faltan las variables
export const supabase = createClient(url ?? "http://localhost", key ?? "missing");
