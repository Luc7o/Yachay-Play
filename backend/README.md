# Backend – Ludo Educativo

API REST + Socket.IO + base de datos SQLite para sincronizar la pantalla
del ingeniero (proyector) con los celulares de los estudiantes en tiempo real.

Usa el módulo `node:sqlite` incluido en Node.js (no una librería nativa como
`better-sqlite3`), así que **no necesitas instalar Visual Studio Build Tools
ni ningún compilador** para que funcione en Windows.

**Requisito: Node.js 22.5 o superior** (recomendado 22.5+; en Node 22.x verás
un aviso de "experimental feature", es normal y no afecta el funcionamiento).
Revisa tu versión con `node -v`.

## Instalar y ejecutar

En PowerShell (Windows), ejecuta cada comando en su propia línea o sepáralos
con `;` — `&&` no funciona como separador en PowerShell:

```powershell
cd backend
npm install
npm start
```

En bash/mac/Linux también puedes encadenarlos con `&&` si prefieres:

```bash
cd backend && npm install && npm start
```

El servidor queda escuchando en `http://localhost:4000` (puedes cambiar el
puerto con la variable de entorno `PORT`).

La primera vez que arranca, crea el archivo `ludo.db` (SQLite) en esta misma
carpeta y siembra automáticamente las 20 preguntas del banco.

## Endpoints REST

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/games` | Crea una partida. Body: `{ name, counts: {rojo,verde,amarillo,azul} }` → devuelve `{ code, gameId }` |
| GET | `/api/games/:code` | Devuelve el estado actual de la partida |
| POST | `/api/games/:code/join` | Un estudiante se une. Body: `{ name, team }` → devuelve `{ playerId }` |
| GET | `/api/questions` | Lista las 20 preguntas (sin revelar la respuesta correcta) |

## Eventos de Socket.IO

Cliente → servidor:
- `join-room` `{ code }`
- `engineer:start-game` `{ code }`
- `engineer:toggle-timer` `{ code }`
- `engineer:roll-dice` `{ code }`
- `team:answer` `{ code, playerId, optionIndex }`
- `engineer:next-turn` `{ code }`

Servidor → cliente:
- `state` (estado completo de la partida, se reenvía tras cada acción)
- `timer` (segundos restantes, cada segundo)
- `error-message`

## Base de datos (SQLite, archivo `ludo.db`)

- `games`: partidas creadas
- `teams`: los 4 equipos por partida (cupo, puntaje, correctas/incorrectas)
- `players`: estudiantes que se unieron
- `questions`: banco de 20 preguntas
- `turn_history`: historial de cada turno jugado (para el reporte de evaluación)

Para producción real conviene migrar a PostgreSQL/MySQL, pero SQLite es
suficiente para el prototipo y las demostraciones en aula.
