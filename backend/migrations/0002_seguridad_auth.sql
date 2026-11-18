-- 0002: seguridad de cuentas (2FA, recuperar contraseña, aceptación de términos, sesiones revocables).
-- Es idempotente: se puede correr más de una vez sin romper nada.

ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret      text;                      -- secreto 2FA CIFRADO (nunca en texto plano)
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled     boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_step   bigint;                    -- evita reutilizar el mismo código 2FA
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version    integer NOT NULL DEFAULT 0; -- subirlo cierra todas las sesiones abiertas
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;              -- cuándo aceptó Términos y Privacidad

-- Códigos de recuperación 2FA (por si pierde el celular). Se guarda solo el hash.
CREATE TABLE IF NOT EXISTS recovery_codes (
  id         serial PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  text NOT NULL,
  used_at    timestamptz
);
CREATE INDEX IF NOT EXISTS recovery_codes_user_idx ON recovery_codes(user_id);

-- Enlaces para restablecer contraseña (un solo uso, caducan en 30 min). Se guarda solo el hash.
CREATE TABLE IF NOT EXISTS password_resets (
  id         serial PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets(user_id);
