import React, { useEffect, useRef, useState } from "react";
import { api, getToken } from "./api";

// ============================================================================
// ASISTENTE IA — botón flotante, SOLO visible para cuentas de docente
// ============================================================================
// Vive fuera del árbol de <App/> a propósito (se monta en main.jsx junto a
// <App/>, no dentro): así no hay que tocar el enrutamiento de Ludo ni del
// Crucigrama. Se entera de la sesión por su cuenta, consultando /api/auth/me,
// y se refresca cuando App avisa que alguien inició o cerró sesión mediante
// el evento "yachay-auth-changed".
// ============================================================================
const IMG_CABEZA = "/asistente-cabeza.png"; // burbuja flotante + avatar en los mensajes
const IMG_CUERPO = "/asistente-cuerpo.jpg"; // banner del chat abierto

export function AssistantFab() {
  const [role, setRole] = useState(null); // null = todavía no se sabe / no hay sesión
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { role: "user" | "assistant", content }
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  // Revisa quién es (o si ya no hay sesión) cada vez que algo pueda haber cambiado.
  useEffect(() => {
    function revisar() {
      if (!getToken()) return setRole(null);
      api
        .me()
        .then(({ user }) => setRole(user?.role || null))
        .catch(() => setRole(null));
    }
    revisar();
    window.addEventListener("yachay-auth-changed", revisar);
    window.addEventListener("storage", revisar); // por si hay otra pestaña abierta
    return () => {
      window.removeEventListener("yachay-auth-changed", revisar);
      window.removeEventListener("storage", revisar);
    };
  }, []);

  // Marca <body> mientras el botón del asistente está visible, para que las
  // pantallas (p. ej. el Cronómetro) le dejen su espacio y no se pisen.
  useEffect(() => {
    document.body.classList.toggle("has-ai-fab", role === "docente");
    return () => document.body.classList.remove("has-ai-fab");
  }, [role]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function enviar(e) {
    e.preventDefault();
    const texto = input.trim();
    if (!texto || loading) return;
    const historial = [...messages, { role: "user", content: texto }];
    setMessages(historial);
    setInput("");
    setError("");
    setLoading(true);
    try {
      const { reply } = await api.assistantChat(historial);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err.message);
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
            <img className="ai-hero" src={IMG_CUERPO} alt="Yachay, tu asistente" />
            <div className="ai-head-bar">
              <span>Asistente IA <small>· solo docentes</small></span>
              <button onClick={() => setOpen(false)} aria-label="Cerrar">✕</button>
            </div>
          </div>

          <div className="ai-panel-body">
            {messages.length === 0 && (
              <p className="ai-empty">
                Pregúntame por ideas de preguntas, pistas para el crucigrama, cómo explicar un tema, o cualquier
                duda rápida sobre tu clase.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={"ai-row " + m.role}>
                {m.role === "assistant" && <img className="ai-avatar" src={IMG_CABEZA} alt="" />}
                <div className={"ai-msg " + m.role}>{m.content}</div>
              </div>
            ))}
            {loading && (
              <div className="ai-row assistant">
                <img className="ai-avatar" src={IMG_CABEZA} alt="" />
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
              maxLength={2000}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()}>➤</button>
          </form>
        </div>
      )}

      <button className={"ai-fab" + (open ? " is-open" : "")} onClick={() => setOpen((o) => !o)} title="Asistente IA para docentes">
        {open ? <span className="ai-fab-x">✕</span> : <img src={IMG_CABEZA} alt="Asistente IA" />}
      </button>
    </div>
  );
}
