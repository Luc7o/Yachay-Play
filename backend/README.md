# Backend YachayPlay
Express + Socket.IO + PostgreSQL (Neon o Supabase).

1. Crea la base y ejecuta `schema.sql` una sola vez (SQL Editor de Neon/Supabase).
2. Copia `.env.example` a `.env` y rellena `DATABASE_URL`, `AUTH_SECRET`, `GEMINI_API_KEY`.
3. `npm install` y `npm start` (puerto 4000). Necesita un servidor siempre encendido (Render/Railway/Fly), no Vercel.
