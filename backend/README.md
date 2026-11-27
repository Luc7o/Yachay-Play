# Backend YachayPlay

Express + Socket.IO + PostgreSQL (Neon o Supabase).

1. Crea la base vacía en Neon/Supabase.
2. Copia `.env.example` a `.env` y rellena `DATABASE_URL`, `AUTH_SECRET`, `GEMINI_API_KEY`.
3. `npm install`, luego `npm run migrate` (crea las tablas) y `npm start` (puerto 4000). Necesita un servidor siempre encendido (Render/Railway/Fly), no Vercel.

## Migraciones de base de datos

El esquema se versiona con archivos en `migrations/` y un registro en la tabla `schema_migrations`
(versión, nombre, checksum, fecha y duración). `schema.sql` queda solo como referencia del estado inicial.

| Comando                                    | Qué hace                                                             |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `npm run migrate:new -- agregar_columna_x` | Crea `migrations/NNNN_agregar_columna_x.sql` con el siguiente número |
| `npm run migrate`                          | Aplica las pendientes, en orden, cada una en su transacción          |
| `npm run migrate:status`                   | Lista cada migración como aplicada, pendiente o MODIFICADA           |

Reglas:

- **Nunca edites una migración ya aplicada**: el checksum cambia y `migrate` se detiene. Crea una nueva.
- Si una migración falla, se hace rollback y no se registra. Para sentencias que no admiten transacción
  (`CREATE INDEX CONCURRENTLY`), pon `-- no-transaction` en la primera línea del archivo.
- Una base que ya tenía las tablas puede correr `npm run migrate` sin problema: `0001_baseline.sql` es
  idempotente y solo queda registrada.
- Corre `npm run migrate` en cada despliegue antes de `npm start`.

## Seguridad de cuentas

| Tema                   | Cómo está resuelto                                                                                                                                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contraseñas            | Hash **scrypt** (N=32768, r=8, p=3) con sal aleatoria por usuario, calculado de forma asíncrona. Los parámetros viajan dentro del hash; los hashes de la versión anterior se actualizan solos al iniciar sesión. Mínimo 8 caracteres con letra y número; se rechazan las contraseñas más comunes. |
| Recuperar contraseña   | Enlace de un solo uso (30 min) enviado por correo; solo se guarda el hash del token. Cierra todas las sesiones abiertas y avisa por correo.                                                                                                                                                       |
| 2FA                    | Códigos TOTP (Google Authenticator, Authy…). El secreto se guarda cifrado (AES-256-GCM) y un código no se puede reutilizar. 8 códigos de recuperación de un solo uso (solo su hash).                                                                                                              |
| Google                 | El `credential` se valida en el servidor (firma, `aud`, `iss`, correo verificado). Si el correo ya tenía una cuenta **sin verificar**, Google la toma: se borran contraseña, 2FA y sesiones anteriores (evita que alguien registre un correo ajeno y se quede con la cuenta).                     |
| Verificación de correo | Enlace de 24 h al registrarse (`#/verificar/<token>`). Las cuentas anteriores a la migración 0003 se dan por verificadas.                                                                                                                                                                         |
| Fuerza bruta           | Límites por IP+correo, por correo y por usuario en los pasos 2FA; respuestas de login iguales exista o no el correo.                                                                                                                                                                              |
| Sesiones               | Token firmado de 30 días con versión: cambiar/restablecer la contraseña o «Cerrar las demás sesiones» invalida todos los anteriores.                                                                                                                                                              |

Variables obligatorias en producción: `AUTH_SECRET`, `CORS_ORIGIN`, `GOOGLE_CLIENT_ID`, `RESEND_API_KEY`, `MAIL_FROM`, `FRONTEND_URL`
(el servidor avisa en el log al arrancar si falta alguna).
