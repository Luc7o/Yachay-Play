# YachayPlay

Plataforma de juegos educativos para el aula. El docente crea una actividad, comparte un código y los estudiantes juegan desde el celular, sin instalar nada.

**Web en producción:** https://www.yachayplay.com

---

## Roles

La cuenta se crea con un rol que no cambia después (`docente` o `estudiante`).

| Rol | Qué puede hacer |
|---|---|
| **Docente** | Crear partidas, gestionar su banco de preguntas, usar las herramientas de aula, ver estadísticas de sus clases y usar el asistente con IA. |
| **Estudiante** | Unirse a partidas con un código, ver su historial, ranking y logros. |

---

## Qué incluye

### Juegos
| Juego | Descripción | Tiempo real (backend) |
|---|---|---|
| **Ludo Educativo** | Tablero por equipos: se responde una pregunta, se lanza el dado y gana quien llega primero a la meta. | Sí (Socket.IO) |
| **Crucigrama Relámpago** | Cada estudiante resuelve su crucigrama contra el reloj y puede sabotear a sus rivales. | Sí (Socket.IO) |
| **Palabra Relámpago** | Formar palabras con las letras indicadas antes de que acabe el tiempo, por equipos. | No (corre en el navegador) |

En el catálogo aparecen también como "próximamente": Quiz, Sí o No, Adivinanza, Relacionar grupos, Sopa de letras, Memoria y Ordenar frases.

### Herramientas del docente
- **Cronómetro de actividad** (con ventanita flotante).
- **Ruleta de sorteos** para elegir estudiantes o equipos.
- **Pizarra digital** con exportación.
- **Asistente con IA** (Google Gemini), solo para docentes.

### Cuenta y seguimiento
- **Estadísticas:** el docente ve el resumen de sus partidas, quién ganó y qué preguntas se fallan más. El estudiante ve su historial.
- **Banco de preguntas:** preguntas oficiales (solo lectura) más las propias de cada docente.
- **Perfil:** cambio de nombre y contraseña, ranking de estudiantes y logros.

---

## Tecnología

| Parte | Tecnología | Dónde se despliega |
|---|---|---|
| `frontend/` | React 18 + Vite + socket.io-client | Vercel |
| `backend/` | Node 20+, Express, Socket.IO | Servidor siempre encendido (Render, Railway o Fly.io). **No funciona en Vercel.** |
| Base de datos | PostgreSQL (Neon o Supabase; sirve cualquier PostgreSQL) | Neon / Supabase |

---

## Estructura del proyecto

```
Yachay-Play/
├── backend/
│   ├── server.js          Servidor, rutas de Ludo y sockets de la partida
│   ├── db.js              Conexión a PostgreSQL
│   ├── env.js             Carga el archivo .env
│   ├── schema.sql         Tablas de la base de datos (ejecutar una vez)
│   ├── auth.js            Rutas y middlewares de login/registro
│   ├── authCore.js        Usuarios, contraseñas y tokens
│   ├── seed.js            Cuentas demo para desarrollo
│   ├── questions.js       Preguntas oficiales de Ludo
│   ├── questionBank.js    Banco de preguntas (oficiales + propias)
│   ├── stats.js           Estadísticas del docente y del estudiante
│   ├── profile.js         Perfil, ranking y logros
│   ├── assistant.js       Asistente IA (Gemini)
│   ├── board.js           Mapa del tablero de Ludo (igual que el del frontend)
│   └── crossword/         Crucigrama Relámpago (motor, rutas, sockets, palabras)
└── frontend/
    └── src/
        ├── App.jsx            Estado general y navegación
        ├── AppShell.jsx       Estructura de la app (menú, cabecera)
        ├── AuthScreen.jsx     Login y registro
        ├── GameCatalog.jsx    Catálogo de juegos y herramientas
        ├── GameGate.jsx       Pantalla previa a cada juego
        ├── api.js / socket.js Comunicación con el backend
        ├── constants.js       Colores, turnos y versión de la build
        ├── screens/           Pantallas de selección, carga y fin de partida
        ├── ludo/              Ludo: configuración, sala, tablero, dado, vista del estudiante
        ├── cw/                Crucigrama: sala y vista del docente y del estudiante
        ├── pizarra/           Módulos de la pizarra digital
        ├── PalabraRelampago.jsx, Ruleta.jsx, Cronometro.jsx, Pizarra.jsx
        ├── Stats.jsx, QuestionBank.jsx, Profile.jsx, AssistantFab.jsx
        └── *.css              Estilos por sección
```

---

## Desarrollo local

Necesitas **Node 20 o superior** y una **base de datos de pruebas** en PostgreSQL.

> ⚠️ **Nunca uses la base de datos de producción para probar.** Crea un proyecto aparte en Neon o Supabase (por ejemplo `yachayplay-dev`).

### 1. Base de datos
Abre el editor SQL de tu base de pruebas y ejecuta todo el contenido de `backend/schema.sql`.

### 2. Backend
```bash
cd backend
cp .env.example .env     # en Windows PowerShell también funciona "cp"
npm install
npm start                # http://localhost:4000
```

Edita `backend/.env`:

```env
DATABASE_URL=postgresql://usuario:contraseña@host/neondb?sslmode=require
GEMINI_API_KEY=            # opcional: solo para el asistente IA
AUTH_SECRET=               # clave larga y aleatoria (ver abajo)
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
SEED_DEMO_USERS=true
```

Para generar `AUTH_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Al arrancar en desarrollo se crean estas cuentas de prueba:

| Rol | Correo | Contraseña |
|---|---|---|
| Docente | `docente@yachayplay.com` | `Docente123` |
| Estudiante | `estudiante@yachayplay.com` | `Estudiante123` |

### 3. Frontend
En otra terminal:
```bash
cd frontend
cp .env.example .env     # VITE_API_URL=http://localhost:4000
npm install
npm run dev              # http://localhost:5173
```

El servidor de Vite está abierto a la red local (`host: true`), así que puedes entrar desde un celular en el mismo Wi-Fi usando la IP de tu computadora (por ejemplo `http://192.168.1.10:5173`). En ese caso agrega esa URL a `CORS_ORIGIN`, separada por coma.

---

## Despliegue (producción)

1. **Base de datos:** ejecuta `backend/schema.sql` una sola vez.
2. **Backend** (Render, Railway o Fly.io): carpeta `backend`, build `npm install`, start `npm start`. Variables:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | Cadena de conexión (pooled) de la base de producción |
   | `AUTH_SECRET` | Clave larga y aleatoria, distinta a la de desarrollo |
   | `GEMINI_API_KEY` | Clave de Google AI Studio |
   | `NODE_ENV` | `production` |
   | `CORS_ORIGIN` | `https://www.yachayplay.com` (varias URLs separadas por coma, sin `/` final) |
   | `SEED_DEMO_USERS` | `false` |

3. **Frontend** (Vercel): Root Directory `frontend`, framework Vite. Variable `VITE_API_URL` con la URL pública del backend (sin `/` final). Después de cambiarla, hay que hacer redeploy.

Las cuentas demo no se crean en producción salvo que se ponga `SEED_DEMO_USERS=true`. Sus claves son públicas, así que no se recomienda.

---

## Trabajo en equipo

- **`main`** es la rama de producción. No se trabaja directamente en ella.
- Cada persona trabaja en su propia rama (por ejemplo `nombre-rama`) y pasa los cambios a `main` mediante **Pull Request** revisado por el equipo.
- Para traer lo último de `main` a tu rama:
  ```bash
  git checkout nombre-rama
  git fetch origin
  git merge origin/main
  git push origin nombre-rama
  ```
- Las ramas que no son `main` pueden generar una URL de prueba en Vercel. Revisa que la variable `VITE_API_URL` del entorno **Preview** apunte a un backend de pruebas y no al de producción.
- **Cambios en la base de datos:** solo agregar columnas o tablas nuevas. No borrar ni renombrar lo existente, porque la web en producción dejaría de funcionar hasta actualizar el backend.
- Nunca subir archivos `.env` a GitHub (ya están en `.gitignore`).

---

## Notas

- El estado en vivo de las partidas de Ludo y Crucigrama se mantiene en la memoria del servidor (la base de datos guarda los resultados y el historial). Conviene evitar reiniciar o desplegar el backend mientras haya clases jugando.
- `BUILD_VERSION` en `frontend/src/constants.js` se muestra en el pie de la pantalla de inicio. Actualízala en cada release para confirmar que el navegador no está sirviendo una versión vieja en caché.
