import React, { useEffect, useRef, useState } from "react";
import { api, getToken } from "./api";
import type { SinTipo } from "./tipos";
import type { ErrorApi } from "./api";

// ============================================================================
// ASISTENTE IA — botón flotante, SOLO visible para cuentas de docente
// ============================================================================
// Vive fuera del árbol de <App/> a propósito (se monta en main.jsx junto a
// <App/>, no dentro): así no hay que tocar el enrutamiento de Ludo ni del
// Crucigrama. Se entera de la sesión por su cuenta, consultando /api/auth/me,
// y se refresca cuando App avisa que alguien inició o cerró sesión mediante
// el evento "yachay-auth-changed".
// ============================================================================
// Diseño "Campus": sin mascota; un ícono de trazo en el botón y en los mensajes.
// (La mascota actual es el cóndor, /condor-*.png; aquí no se usa.)
const IconoIA = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 5h16v11H9l-5 4z" />
    <path d="M12 7.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill="currentColor" stroke="none" />
  </svg>
);

export function AssistantFab() {
  const [role, setRole] = useState<SinTipo>(null); // null = todavía no se sabe / no hay sesión
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SinTipo[]>([]); // { role: "user" | "assistant", content }
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Revisa quién es (o si ya no hay sesión) cada vez que algo pueda haber cambiado.
  useEffect(() => {
    function revisar() {
      if (!getToken()) return setRole(null);
      api
        .me()
        .then(({ user }: { user?: SinTipo }) => setRole(user?.role || null))
        .catch(() => setRole(null));
    }
    // "storage" salta con CUALQUIER clave (la Ruleta, el tema, el cronómetro...):
    // solo nos importa cuando cambia el token de sesión en otra pestaña.
    const alCambiarStorage = (e) => {
      if (e.key === null || e.key === "yachay_token") revisar();
    };
    revisar();
    window.addEventListener("yachay-auth-changed", revisar);
    window.addEventListener("storage", alCambiarStorage);
    return () => {
      window.removeEventListener("yachay-auth-changed", revisar);
      window.removeEventListener("storage", alCambiarStorage);
    };
  }, []);

  // Marca <body> mientras el botón del asistente está visible, para que las
  // pantallas (p. ej. el Cronómetro) le dejen su espacio y no se pisen.
  useEffect(() => {
    document.body.classList.toggle("has-ai-fab", role === "docente");
    return () => document.body.classList.remove("has-ai-fab");
  }, [role]);

  // Al cerrar sesión (o cambiar de cuenta) se borra la conversación: en una PC
  // compartida del aula, el siguiente docente no debe ver el chat del anterior.
  useEffect(() => {
    setMessages([]);
    setInput("");
    setError("");
    setOpen(false);
  }, [role]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const texto = input.trim();
    if (!texto || loading) return;
    const historial = [...messages, { role: "user", content: texto }];
    setMessages(historial);
    setInput("");
    setError("");
    setLoading(true);
    try {
      // Solo los últimos 20 mensajes: el historial completo crecía sin tope en cada envío.
      // (Y que empiece con un mensaje del docente, como espera la API del modelo.)
      const recorte = historial.slice(-20);
      if (recorte[0]?.role === "assistant") recorte.shift();
      const { reply } = await api.assistantChat(recorte);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      setError((err as ErrorApi).message);
    } finally {
      setLoading(false);
    }
  }

  // Si no hay sesión o la cuenta no es de docente, este componente no existe.
  if (role !== "docente") return null;

  return (
    <div className="ai-fab-wrap">
      {open && (
        <div className="ai-panel">
          <div className="ai-panel-head">
            <div className="ai-head-bar">
              <span className="ai-head-title">
                <span className="ai-head-ico">
                  <IconoIA />
                </span>
                Asistente IA <small>· solo docentes</small>
              </span>
              <button onClick={() => setOpen(false)} aria-label="Cerrar el asistente">
                ✕
              </button>
            </div>
          </div>

          <div className="ai-panel-body">
            {messages.length === 0 && (
              <p className="ai-empty">
                Pregúntame por ideas de preguntas, pistas para el crucigrama, cómo explicar un tema, o cualquier duda
                rápida sobre tu clase.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={"ai-row " + m.role}>
                {m.role === "assistant" && (
                  <span className="ai-avatar">
                    <IconoIA />
                  </span>
                )}
                <div className={"ai-msg " + m.role}>{m.content}</div>
              </div>
            ))}
            {loading && (
              <div className="ai-row assistant">
                <span className="ai-avatar">
                  <IconoIA />
                </span>
                <div className="ai-msg assistant ai-typing">Escribiendo…</div>
              </div>
            )}
            {error && <p className="ai-error">{error}</p>}
            <div ref={bottomRef} />
          </div>

          <form className="ai-panel-form" onSubmit={enviar}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta…"
              aria-label="Tu pregunta para el asistente"
              maxLength={2000}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()} aria-label="Enviar">
              ➤
            </button>
          </form>
        </div>
      )}

      <button
        className={"ai-fab" + (open ? " is-open" : "")}
        onClick={() => setOpen((o) => !o)}
        title="Asistente IA para docentes"
        aria-label={open ? "Cerrar el asistente IA" : "Abrir el asistente IA"}
        aria-expanded={open}
      >
        {open ? (
          <span className="ai-fab-x" aria-hidden="true">
            ✕
          </span>
        ) : (
          <IconoIA />
        )}
      </button>
    </div>
  );
}
