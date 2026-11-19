-- 0004: CLASES.
-- Una clase (curso + sección) es de un docente y agrupa a sus estudiantes; las partidas
-- que el docente lanza desde la clase quedan asociadas a ella (historial por clase).
-- Los estudiantes se inscriben con el CÓDIGO DE LA CLASE (distinto del código de 6
-- dígitos de cada partida).
-- Es idempotente: se puede correr más de una vez sin romper nada.

CREATE TABLE IF NOT EXISTS classes (
  id          text PRIMARY KEY,
  owner_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  section     text NOT NULL DEFAULT '',
  join_code   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
CREATE INDEX IF NOT EXISTS classes_owner_idx ON classes(owner_id);
-- El código de inscripción es único entre las clases que no están archivadas.
CREATE UNIQUE INDEX IF NOT EXISTS classes_join_code_live_idx ON classes(join_code) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS class_members (
  class_id  text NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id   text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, user_id)
);
CREATE INDEX IF NOT EXISTS class_members_user_idx ON class_members(user_id);

-- Partidas asociadas a una clase (si se borra la clase, la partida queda sin clase).
ALTER TABLE games ADD COLUMN IF NOT EXISTS class_id text REFERENCES classes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS games_class_idx ON games(class_id) WHERE class_id IS NOT NULL;
ALTER TABLE crossword_games ADD COLUMN IF NOT EXISTS class_id text REFERENCES classes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS crossword_games_class_idx ON crossword_games(class_id) WHERE class_id IS NOT NULL;
