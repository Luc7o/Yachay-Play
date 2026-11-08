// ============================================================================
// ASISTENTE IA — solo para cuentas de docente
// ============================================================================
// Usa la API de Google Gemini (plan gratuito de Google AI Studio).
// Necesita la variable de entorno GEMINI_API_KEY (backend/.env).
// Opcional: GEMINI_MODEL para cambiar de modelo sin tocar el código.
// ============================================================================
import { Router } from "express";
import { requireTeacher } from "./auth.js";

export const assistantRouter = Router();

const SYSTEM_PROMPT = `Eres el asistente de IA para docentes dentro de YachayPlay, una plataforma de juegos
educativos (Ludo Educativo y Crucigrama Relámpago, ambos usados en el aula).
Ayudas a los docentes a: redactar preguntas de opción múltiple o pistas de crucigrama para sus temas,
explicar conceptos para preparar una clase, sugerir cómo organizar una partida, y resolver dudas rápidas
sobre cómo usar la plataforma. Responde en español, de forma breve y práctica, pensando en que quien
pregunta es un docente con poco tiempo entre clases.`;

// --- límite de uso: cuida la cuota gratuita (20 mensajes / hora por docente) ---
const USOS_POR_HORA = 20;
const usos = new Map(); // userId -> { n, inicio }
function demasiados(userId) {
  const ahora = Date.now();
  const u = usos.get(userId);
  if (!u || ahora - u.inicio > 60 * 60 * 1000) {
    usos.set(userId, { n: 1, inicio: ahora });
    return false;
  }
  u.n += 1;
  return u.n > USOS_POR_HORA;
}

assistantRouter.post("/chat", requireTeacher, async (req, res) => {
  // Se lee aquí (y no arriba) porque server.js carga el .env después de importar este archivo.
  const MODELO = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "El asistente no está configurado todavía (falta GEMINI_API_KEY en el servidor)." });
  }
  if (demasiados(req.user.id)) {
    return res.status(429).json({ error: `Llegaste al límite de ${USOS_POR_HORA} mensajes por hora. Prueba de nuevo más tarde.` });
  }

  const entrada = Array.isArray(req.body?.messages) ? req.body.messages : null;
  if (!entrada || entrada.length === 0) {
    return res.status(400).json({ error: "Falta el mensaje." });
  }

  // Solo mandamos los últimos mensajes, y recortamos cada uno (cuida cuota y evita abuso).
  // Gemini usa el rol "model" en vez de "assistant", y no acepta textos vacíos.
  let contents = entrada
    .slice(-20)
    .map((m) => ({
      role: m?.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m?.content || "").slice(0, 4000) }],
    }))
    .filter((c) => c.parts[0].text.trim());
  // La conversación debe empezar y terminar con un mensaje del docente.
  while (contents.length && contents[0].role !== "user") contents.shift();
  while (contents.length && contents[contents.length - 1].role !== "user") contents.pop();
  if (contents.length === 0) {
    return res.status(400).json({ error: "El mensaje está vacío." });
  }

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODELO)}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: { maxOutputTokens: 1000 },
        }),
      }
    );
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 429) {
        return res.status(429).json({ error: "El asistente alcanzó su límite gratuito por ahora. Prueba de nuevo en unos minutos." });
      }
      console.error("Gemini error:", r.status, data?.error?.message);
      return res.status(502).json({ error: data?.error?.message || "El asistente no pudo responder." });
    }
    const texto = (data.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || "")
      .join("\n")
      .trim();
    res.json({ reply: texto || "No tengo una respuesta para eso. ¿Puedes reformular la pregunta?" });
  } catch {
    res.status(502).json({ error: "No se pudo conectar con el asistente. Prueba de nuevo en un momento." });
  }
});