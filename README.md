# YachayPlay

Juegos educativos para el aula (Ludo Educativo y Crucigrama Relámpago).

- `frontend/` React + Vite → se despliega en **Vercel**
- `backend/` Express + Socket.IO + PostgreSQL (Supabase) → necesita un servidor siempre encendido (**Render, Railway o Fly.io**), NO Vercel

## Local
```bash
cd backend && cp .env.example .env   # rellena DATABASE_URL, GEMINI_API_KEY, AUTH_SECRET
npm install && npm start             # http://localhost:4000

cd frontend && cp .env.example .env  # VITE_API_URL=http://localhost:4000
npm install && npm run dev           # http://localhost:5173
```

## Despliegue
0. **Base de datos** (Neon/Supabase): ejecuta `backend/schema.sql` una vez.
1. **Backend** (Render/Railway): carpeta `backend`, build `npm install`, start `npm start`.
   Variables: `DATABASE_URL`, `GEMINI_API_KEY`, `AUTH_SECRET`, `NODE_ENV=production`,
   `CORS_ORIGIN=https://tu-app.vercel.app`, `SEED_DEMO_USERS=false`.
2. **Frontend** (Vercel): Root Directory `frontend`, framework Vite.
   Variable: `VITE_API_URL=https://tu-backend.onrender.com` (sin `/` final). Luego redeploy.

Las cuentas demo (`docente@yachayplay.com`...) solo se crean en producción si `SEED_DEMO_USERS=true`.

## Estructura del frontend (`frontend/src`)
- `App.jsx` estado general y navegación (antes tenía todo en 1 archivo de 1.900 líneas)
- `constants.js` colores, orden de turnos, versión
- `screens/` pantallas de inicio, carga y fin de partida
- `ludo/` Ludo: configuración, sala, tablero, dado, pestañas y vista del estudiante
- `Crossword.jsx`, `Pizarra.jsx`, `Ruleta.jsx`, `Cronometro.jsx` otros juegos y herramientas
