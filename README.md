# Ludo Educativo Interactivo — Full Stack (backend + frontend + base de datos)

Versión completa del prototipo, evolucionando el frontend v0.4 (que usaba
solo estado local) hacia una app real con **backend Express + Socket.IO** y
**base de datos SQLite**, para que la pantalla del docente (proyector) y los
celulares de los estudiantes compartan la misma partida en tiempo real.

## Estructura

```text
ludo-app/
├── backend/     Express + Socket.IO + SQLite (API, tiempo real, persistencia)
└── frontend/    React + Vite (pantalla del docente y del estudiante)
```

## Cómo ejecutarlo

> **Windows/PowerShell:** ejecuta cada comando en su propia línea (`&&` no
> encadena comandos en PowerShell como en bash).

### 1. Backend

```powershell
cd backend
npm install
npm start
```

Queda escuchando en `http://localhost:4000` y crea automáticamente `ludo.db`
(SQLite, usando el módulo `node:sqlite` incluido en Node.js — no requiere
compiladores ni Visual Studio Build Tools) con las 20 preguntas ya sembradas.
Requiere Node.js 22.5 o superior (`node -v` para comprobarlo).

### 2. Frontend

En otra terminal:

```powershell
cd frontend
npm install
copy .env.example .env   # en bash/mac/Linux: cp .env.example .env
npm run dev
```

Se abre en `http://localhost:5173`.

### 3. Probarlo con varios dispositivos (aula real)

1. En la computadora del docente, averigua tu IP local (ej. `192.168.1.10`).
2. En `frontend/.env` pon `VITE_API_URL=http://192.168.1.10:4000`.
3. Arranca el backend y el frontend (`npm run dev` ya expone `--host` gracias
   a `vite.config.js`).
4. En la computadora, abre `http://192.168.1.10:5173`, elige **"Soy el
   docente"**, crea la partida y proyecta el código.
5. En los celulares de los estudiantes (misma red Wi-Fi), abre
   `http://192.168.1.10:5173`, elige **"Soy estudiante"**, ingresa el código,
   su nombre y su equipo.
6. El docente pulsa **"Iniciar partida"** y luego **"Lanzar dado"** en cada
   turno; el equipo correspondiente responde desde su celular en tiempo real.

## Qué cambió respecto al prototipo v0.4

| Antes (v0.4) | Ahora |
|---|---|
| Todo el estado vivía en un solo `useState` del navegador | El estado de la partida vive en el servidor y se sincroniza por Socket.IO |
| Un solo dispositivo simulaba docente + alumno con un botón "Ver celular" | Docente y estudiantes son dispositivos distintos, conectados por código de partida |
| Preguntas y puntajes hardcodeados en el componente | Preguntas en SQLite (`/api/questions`), historial y puntajes persistidos en `turn_history` y `teams` |
| Sin backend ni base de datos | Express + Socket.IO + SQLite (`backend/`) |

## Cómo saber si estás corriendo la última versión

En la primerísima pantalla (elegir "Soy el docente" / "Soy estudiante"), abajo
del todo, hay un texto pequeño y gris: **Build 2026-09-16-3**.

Si no lo ves, tu navegador o tu carpeta tienen una versión vieja. Antes de
reportar un error nuevo:

1. Cierra las dos terminales (backend y frontend) con Ctrl+C.
2. Borra la carpeta ludo-app vieja por completo y descomprime el zip nuevo en
   un lugar limpio (no lo pegues encima de la carpeta anterior).
3. Corre npm install de nuevo en backend/ y en frontend/.
4. Refresco forzado en el navegador: Ctrl+Shift+R (Windows/Linux) o
   Cmd+Shift+R (Mac), para que no use una copia vieja guardada en caché.
5. Confirma que abajo dice Build 2026-09-16-3.

## Corrección de esta versión: "pantalla en blanco"

Investigué el reporte reproduciendo la configuración exacta (1 alumno por
color, 5 min, 15s para responder, 5s para el dado) con un docente y un alumno
reales. El flujo en sí no se rompía, pero encontré y arreglé tres problemas
de fondo que pueden causar justo ese síntoma:

1. **`.env` traía una IP ajena grabada por error** (`10.128.74.149`, de otra
   red). Si nunca la cambiaste por la tuya, todas las peticiones al backend
   se quedan esperando en silencio — eso se ve exactamente como una pantalla
   que nunca carga. Ya quedó por defecto en `http://localhost:4000`, con
   instrucciones claras de cuándo y cómo cambiarla (ver el archivo `.env`).

2. **El reloj no se actualizaba con los botones del docente.** `+1m`, `−1m`,
   `+5m` y `↺` sí cambiaban el tiempo en el servidor, pero la pantalla del
   docente solo refrescaba el número la PRIMERA vez que recibía el estado;
   después se quedaba congelada hasta que el reloj general empezara a
   correr. Con la partida en pausa (que es como se prueba normalmente), los
   botones de tiempo parecían no hacer nada. Corregido: ahora el número en
   pantalla siempre refleja lo que diga el servidor.

3. **No había red de seguridad contra errores.** Agregué un `ErrorBoundary`
   (`src/ErrorBoundary.jsx`) que envuelve toda la aplicación. Si React
   encuentra CUALQUIER error mientras dibuja la pantalla, en vez de dejarla
   en blanco sin explicación, ahora se ve el mensaje de error exacto y un
   botón para reiniciar. Si esto vuelve a pasar, el mensaje en pantalla dirá
   qué fue.

## Novedades de esta versión (tablero real + botones de admin)

### 1. Tablero de Ludo de verdad (15 x 15 casillas)

El tablero anterior era una cuadrícula decorativa de 6x6. Ahora `board.js`
(existe igual en `backend/` y en `frontend/src/`) define el tablero clásico:

- **52 casillas** en el anillo exterior.
- **4 casillas de salida**, una por color, separadas 13 casillas entre sí.
- **4 rectas finales** de 5 casillas que llevan al centro.
- **Casillas seguras (★)** donde no te pueden comer.

Cada ficha recorre **57 pasos**: `-1` = en casa, `0..50` = anillo, `51..55` =
recta final, `56` = META.

### 2. Regla principal: acierta y avanza

| Situación | Qué pasa con la ficha |
|---|---|
| Responde correcto | Avanza **exactamente** el número del dado |
| Responde incorrecto | No se mueve |
| Se acaba el tiempo | No se mueve |
| Estaba en casa y acierta | Sale a su casilla de salida y cuenta desde ahí |
| El dado se pasa del paso 56 | No se mueve (hace falta el número exacto) |
| Cae sobre una ficha rival | Se la come y la manda a casa (salvo en casillas ★) |
| Llega al paso 56 | Su equipo **gana** y la partida termina |

### 3. Turno automático (el docente ya no toca nada)

El turno es ahora una **máquina de estados** que vive en el servidor
(`server.js`) y avanza sola con un reloj de un tick por segundo:

```text
  roll  ──(el alumno lanza, o 15s)──▶  rolling  ──(2s)──▶  question
    ▲                                                          │
    └──────────── result ◀──(responde, o 20s)──────────────────┘
                     (6s)
```

| Fase | Qué pasa | Quién la termina |
|---|---|---|
| `roll` | El equipo en turno debe lanzar el dado | El alumno, o el servidor a los 15s |
| `rolling` | El dado gira en pantalla | El reloj, a los 2s |
| `question` | Se muestra la pregunta | El alumno al responder, o el reloj a los 20s |
| `result` | Se ve qué pasó y cómo se movió la ficha | El reloj, a los 6s → siguiente turno |

Además, los turnos **saltan los equipos sin alumnos conectados**, así no se
pierden 40 segundos esperando a un color vacío.

El docente conserva un botón **⏭ Saltar turno** solo como válvula de escape.

### 4. El alumno lanza y ve el dado

El botón **🎲 LANZAR DADO** aparece en el celular del equipo en turno. El dado
se dibuja con puntos reales en una cuadrícula de 3x3 (componente `Dice`) y se
anima cambiando de cara cada 90 ms mientras la fase es `rolling`. Todos los
dispositivos ven la misma animación y el mismo resultado, porque el número lo
decide el servidor y se reparte por Socket.IO.

Eventos nuevos de Socket.IO:

| Evento | Dirección | Para qué |
|---|---|---|
| `player:roll-dice` | alumno → servidor | Lanzar el dado en su turno |
| `phase-timer` | servidor → todos | Segundos que le quedan a la fase actual |
| `engineer:skip-turn` | docente → servidor | Adelantar un turno trabado |

### 5. Botones de administración

- **🔄 Reiniciar**: vuelve a crear la partida con el **mismo código**. Las
  fichas regresan a casa y los puntajes vuelven a cero, pero los alumnos
  **siguen conectados**. Ideal para jugar otra ronda con el mismo salón.
- **➕ Partida nueva**: cierra la partida actual y regresa a la pantalla de
  configuración para generar **otro código**.

Ambos están en la barra superior durante el juego y en la pantalla final.

### 6. El docente controla el tiempo

Al crear la partida elige tres tiempos, y todos quedan guardados en la base de
datos junto con la partida:

- **Duración de la partida** (5 a 90 min) → el reloj general.
- **Segundos para responder** cada pregunta.
- **Segundos para lanzar el dado** antes de que lo lance el sistema.

Durante el juego, la barra superior tiene `−1m`, `+1m`, `+5m`, `↺` (reiniciar el
reloj) y `⏸ / ▶`. Cuando queda menos de un minuto el reloj parpadea en rojo.
Al llegar a 0:00 la partida termina y gana el equipo con más puntos.

### 7. Elegir cuántos colores juegan

En la configuración, cada color puede quedar en **“— No juega —”**. Con eso:

- Ese color no aparece en la lista de equipos del alumno.
- El servidor rechaza a quien intente unirse a él.
- El turno nunca cae en ese color.
- Su casa se dibuja en gris en el tablero.
- No entra en el ranking final.

Se exigen **mínimo 2 colores**. Además, el alumno ahora escribe el código y la
app **busca la partida al instante**, mostrándole solo los equipos con cupo
libre (`2/3`, `Lleno`, etc.) en vez de una lista fija de cuatro.

### 8. Bug corregido: el alumno no veía el dado ni las preguntas

**Causa:** las partidas vivían solo en memoria (`const games = new Map()`). Si el
servidor se reiniciaba, la partida desaparecía, pero el celular del alumno seguía
guardando el código viejo en `localStorage`. El servidor respondía
`"Partida no encontrada"`… y **nadie escuchaba ese evento en el frontend**, así
que el alumno se quedaba colgado sin pregunta, sin dado y sin explicación.

**Solución, en dos partes:**

1. `restoreGamesFromDb()` — al arrancar, el servidor **reconstruye desde SQLite**
   todas las partidas no finalizadas, con sus alumnos, sus colores activos y sus
   tiempos. Un reinicio ya no mata la clase.
2. El frontend ahora escucha `error-message` y muestra una pantalla clara
   (“La partida ya no existe, pide el código nuevo”) con un botón para volver a
   ingresar, en lugar de un “Conectando…” eterno.

### 9. Otro bug corregido

En SQLite la columna se llama `answer_index`, pero el código comparaba contra
`answerIndex`. Como esa propiedad no existía, la comparación siempre daba
`false` y **ninguna respuesta se contaba como correcta**. Ahora `loadQuestions()`
traduce el nombre al cargar las preguntas.

## Próximos pasos sugeridos

- Mover de SQLite a PostgreSQL/MySQL si se despliega en un servidor compartido.
- Generar el código de partida como QR además de texto (librería `qrcode` en el frontend).
- Agregar autenticación simple del docente si se usará con varios profesores.
- Guardar/objetar reconexión de estudiantes ante corte de red (ya hay una base con `localStorage`, falta el evento de reconexión en el servidor).
