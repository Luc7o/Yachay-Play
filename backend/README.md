# Backend YachayPlay
Express + Socket.IO + PostgreSQL (Neon o Supabase).

1. Crea la base vacía en Neon/Supabase.
2. Copia `.env.example` a `.env` y rellena `DATABASE_URL`, `AUTH_SECRET`, `GEMINI_API_KEY`.
3. `npm install`, luego `npm run migrate` (crea las tablas) y `npm start` (puerto 4000). Necesita un servidor siempre encendido (Render/Railway/Fly), no Vercel.

## Migraciones de base de datos

El esquema se versiona con archivos en `migrations/` y un registro en la tabla `schema_migrations`
(versión, nombre, checksum, fecha y duración). `schema.sql` queda solo como referencia del estado inicial.

| Comando | Qué hace |
|---|---|
| `npm run migrate:new -- agregar_columna_x` | Crea `migrations/NNNN_agregar_columna_x.sql` con el siguiente número |
| `npm run migrate` | Aplica las pendientes, en orden, cada una en su transacción |
| `npm run migrate:status` | Lista cada migración como aplicada, pendiente o MODIFICADA |

Reglas:
- **Nunca edites una migración ya aplicada**: el checksum cambia y `migrate` se detiene. Crea una nueva.
- Si una migración falla, se hace rollback y no se registra. Para sentencias que no admiten transacción
  (`CREATE INDEX CONCURRENTLY`), pon `-- no-transaction` en la primera línea del archivo.
- Una base que ya tenía las tablas puede correr `npm run migrate` sin problema: `0001_baseline.sql` es
  idempotente y solo queda registrada.
- Corre `npm run migrate` en cada despliegue antes de `npm start`.
