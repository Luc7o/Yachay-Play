import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "url";
import path from "path";

// Usamos el módulo SQLite incluido en Node.js (>=22.5) en vez de una librería
// nativa como better-sqlite3, para no depender de compiladores de C++
// (Visual Studio Build Tools en Windows, build-essential en Linux, etc.).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new DatabaseSync(path.join(__dirname, "ludo.db"));

db.exec("PRAGMA journal_mode = WAL;");

// Esquema de la base de datos.
// - games: una partida creada por el ingeniero/docente
// - teams: los 4 equipos de color de cada partida, con su cupo y puntaje
// - players: los estudiantes que se unieron desde su celular
// - questions: banco de preguntas (se siembra una sola vez)
// - turn_history: historial de turnos jugados, para el reporte de evaluación
db.exec(`
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'lobby',
  minutes INTEGER NOT NULL DEFAULT 30,
  answer_seconds INTEGER NOT NULL DEFAULT 20,
  roll_seconds INTEGER NOT NULL DEFAULT 15,
  active_teams TEXT NOT NULL DEFAULT 'rojo,verde,amarillo,azul',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  color TEXT NOT NULL,
  slots INTEGER NOT NULL DEFAULT 1,
  score REAL NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  incorrect INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  team TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL,
  level TEXT NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  answer_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS turn_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL REFERENCES games(id),
  turn INTEGER NOT NULL,
  team TEXT NOT NULL,
  dice INTEGER NOT NULL,
  question_id INTEGER,
  correct INTEGER NOT NULL,
  points REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// --- Migración suave para bases de datos creadas con versiones anteriores ---
// Si el archivo ludo.db ya existía sin estas columnas, se las agregamos.
const columnasGames = db.prepare("PRAGMA table_info(games)").all().map((c) => c.name);
const nuevas = [
  ["minutes", "INTEGER NOT NULL DEFAULT 30"],
  ["answer_seconds", "INTEGER NOT NULL DEFAULT 20"],
  ["roll_seconds", "INTEGER NOT NULL DEFAULT 15"],
  ["active_teams", "TEXT NOT NULL DEFAULT 'rojo,verde,amarillo,azul'"],
];
nuevas.forEach(([nombre, tipo]) => {
  if (!columnasGames.includes(nombre)) db.exec(`ALTER TABLE games ADD COLUMN ${nombre} ${tipo};`);
});

export default db;
