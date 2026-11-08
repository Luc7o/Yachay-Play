-- Esquema de YachayPlay (PostgreSQL: Neon o Supabase). Ejecutar una sola vez.
CREATE TABLE IF NOT EXISTS users (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL CHECK (role IN ('docente','estudiante')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id           serial PRIMARY KEY,
  topic        text NOT NULL,
  level        text NOT NULL,
  question     text NOT NULL,
  options      text NOT NULL,              -- JSON en texto: ["a","b",...]
  answer_index integer NOT NULL,
  owner_id     text REFERENCES users(id) ON DELETE CASCADE,  -- NULL = oficial
  active       boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS questions_owner_idx ON questions(owner_id);

CREATE TABLE IF NOT EXISTS games (
  id             text PRIMARY KEY,
  code           text NOT NULL,
  name           text NOT NULL,
  minutes        integer NOT NULL,
  answer_seconds integer NOT NULL,
  roll_seconds   integer NOT NULL,
  active_teams   text NOT NULL,
  owner_id       text REFERENCES users(id) ON DELETE SET NULL,
  phase          text NOT NULL DEFAULT 'lobby',
  winner_team    text,
  end_reason     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz
);
-- El código solo debe ser único entre partidas vivas (el servidor reintenta si choca: error 23505)
CREATE UNIQUE INDEX IF NOT EXISTS games_code_live_idx ON games(code) WHERE phase <> 'finished';
CREATE INDEX IF NOT EXISTS games_owner_idx ON games(owner_id);

CREATE TABLE IF NOT EXISTS teams (
  id        text PRIMARY KEY,
  game_id   text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  color     text NOT NULL,
  slots     integer NOT NULL DEFAULT 0,
  score     integer NOT NULL DEFAULT 0,
  correct   integer NOT NULL DEFAULT 0,
  incorrect integer NOT NULL DEFAULT 0,
  UNIQUE (game_id, color)
);

CREATE TABLE IF NOT EXISTS players (
  id         text PRIMARY KEY,
  game_id    text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  team       text NOT NULL,
  name       text NOT NULL,
  user_id    text REFERENCES users(id) ON DELETE SET NULL,
  joined_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS players_game_idx ON players(game_id);
CREATE INDEX IF NOT EXISTS players_user_idx ON players(user_id);

CREATE TABLE IF NOT EXISTS turn_history (
  id          serial PRIMARY KEY,
  game_id     text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  turn        integer NOT NULL,
  team        text NOT NULL,
  dice        integer,
  question_id integer REFERENCES questions(id) ON DELETE SET NULL,
  correct     integer NOT NULL DEFAULT 0,   -- 1/0 (el código hace SUM(correct))
  points      integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS turn_history_game_idx ON turn_history(game_id);

CREATE TABLE IF NOT EXISTS crossword_games (
  id               text PRIMARY KEY,
  code             text NOT NULL,
  name             text NOT NULL,
  minutes          integer NOT NULL,
  owner_id         text REFERENCES users(id) ON DELETE SET NULL,
  grid             jsonb NOT NULL,
  status           text NOT NULL DEFAULT 'lobby',
  end_reason       text,
  winner_player_id text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  ended_at         timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS crossword_code_live_idx ON crossword_games(code) WHERE status <> 'ended';
CREATE INDEX IF NOT EXISTS crossword_owner_idx ON crossword_games(owner_id);

CREATE TABLE IF NOT EXISTS crossword_players (
  game_id      text NOT NULL REFERENCES crossword_games(id) ON DELETE CASCADE,
  id           text NOT NULL,
  user_id      text REFERENCES users(id) ON DELETE SET NULL,
  name         text NOT NULL,
  score        integer NOT NULL DEFAULT 0,
  solved_count integer NOT NULL DEFAULT 0,
  finish_rank  integer,
  finished_at  timestamptz,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, id)
);
CREATE INDEX IF NOT EXISTS crossword_players_user_idx ON crossword_players(user_id);
