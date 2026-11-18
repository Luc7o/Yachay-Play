-- 0003: verificación de correo.
-- Sirve para impedir que alguien registre el correo de otra persona con una contraseña propia
-- y luego se quede con la cuenta cuando la víctima entre con Google.
-- Es idempotente: se puede correr más de una vez sin romper nada.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

-- Las cuentas que YA existían antes de esta migración se dan por verificadas
-- (si no, a todos los usuarios actuales les perdería la contraseña al entrar con Google).
-- Solo corre la primera vez: las cuentas nuevas quedan sin verificar hasta que abran su enlace.
UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;

-- Enlaces de verificación (un solo uso, caducan en 24 h). Se guarda solo el hash del token.
CREATE TABLE IF NOT EXISTS email_verifications (
  id         serial PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_verifications_user_idx ON email_verifications(user_id);
