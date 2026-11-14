# Cotizador de Seguros (versión Salud)

Aplicación web para asesores de seguros: catálogo de aseguradoras y planes, tarifario importable por CSV y, en las próximas entregas, asistente de cotización con enlace público y PDF.

Stack: React + TypeScript + Vite + Tailwind, con Supabase (Auth + Postgres) y despliegue en Vercel.

## Variables de entorno

Copia `.env.example` a `.env.local` y completa:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (clave pública; la seguridad la dan las políticas RLS, nunca uses aquí la clave `service_role`)

En Vercel se definen en Project Settings → Environment Variables.

## Base de datos

El esquema está en `supabase/migrations/`. Todas las tablas tienen RLS activa. Los usuarios nuevos quedan **inactivos** hasta que un administrador los active.

Para convertir al primer usuario en administrador, ejecuta en el editor SQL de Supabase:

```sql
update public.perfiles set rol = 'admin', activo = true
where id = (select id from auth.users where email = 'TU_CORREO');
```

## Importar el tarifario

Entra como administrador → Tarifario → sube el CSV. Convención de add-ons: número = costo anual, `gratis` = incluido, vacío = no disponible. La importación es repetible (actualiza, no duplica).

### Planes con tarifa por grupo

Algunos planes (p. ej. Hispana, Salud Familiar) cobran la **prima del grupo completo** según el número de personas (3 a 6). En el CSV se distinguen con una columna opcional `tamano_grupo`; si no existe, vale 0 (tarifa por persona). Si el CSV trae filas con la misma clave pero precios distintos y sin `tamano_grupo`, el importador **no adivina**: omite esas filas, lo informa y no toca lo que ya está guardado.

## Desarrollo local

```bash
npm install
npm run dev
```
