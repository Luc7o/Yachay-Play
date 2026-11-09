import React, { useEffect, useState } from "react";
import { Brand } from "./Brand";
import { api } from "./api";

const ROLES = [
  { id: "docente", icon: "🖥️", title: "Docente", text: "Creo las partidas y las proyecto en clase.", color: "#023A73", soft: "#E6EEF7" },
  { id: "estudiante", icon: "📱", title: "Estudiante", text: "Juego desde mi celular con el código de mi docente.", color: "#009F91", soft: "#E0F8F2" },
];

// Pantalla de "Iniciar sesión" y "Crear cuenta".
// El rol (docente / estudiante) se elige UNA sola vez, al crear la cuenta.
export function AuthScreen({ tab, setTab, onSuccess, onBack, onGuest }) {
  const registro = tab === "register";
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Cuentas de prueba (solo si el servidor las ofrece): permiten entrar con un toque
  const [demo, setDemo] = useState([]);
  useEffect(() => {
    api.demoAccounts().then((r) => setDemo(r.accounts || [])).catch(() => {});
  }, []);
  function usarDemo(c) {
    setEmail(c.email);
    setPassword(c.password);
    setError("");
  }

  function cambiarTab(t) {
    setTab(t);
    setError("");
  }

  const listo = registro
    ? role && name.trim().length >= 2 && email.trim() && password.length >= 6
    : email.trim() && password;

  async function enviar(e) {
    e.preventDefault();
    if (!listo || loading) return;
    setLoading(true);
    setError("");
    try {
      const r = registro
        ? await api.register({ name, email, password, role })
        : await api.login(email, password);
      onSuccess(r); // { token, user }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const globo = registro
    ? "Crea tu cuenta una sola vez. Tu rol queda guardado y ya no tendrás que elegirlo cada vez que juegues."
    : "¡Qué bueno verte! Inicia sesión y entrarás directo a tu panel.";

  return (
    <div className="app join-page">
      <header className="ref-topbar">
        <Brand subtitle={registro ? "Crear cuenta" : "Iniciar sesión"} onClick={onBack} />
      </header>

      <main className="join-main">
        <aside className="join-guide">
          <img src="/mascota-explica.png" alt="" />
          <p>{globo}</p>
        </aside>

        <section className="join-card">
          <div className="auth-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={!registro} className={!registro ? "on" : ""} onClick={() => cambiarTab("login")}>
              Iniciar sesión
            </button>
            <button type="button" role="tab" aria-selected={registro} className={registro ? "on" : ""} onClick={() => cambiarTab("register")}>
              Crear cuenta
            </button>
          </div>

          <h1>{registro ? "Crea tu cuenta" : "¡Bienvenido de nuevo!"}</h1>

          <form onSubmit={enviar} noValidate>
            {registro && (
              <>
                <span className="auth-label">¿Cómo vas a usar YachayPlay?</span>
                <div className="auth-roles" role="radiogroup">
                  {ROLES.map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      role="radio"
                      aria-checked={role === r.id}
                      className={"auth-role" + (role === r.id ? " picked" : "")}
                      style={{ "--tc": r.color, "--ts": r.soft }}
                      onClick={() => setRole(r.id)}
                    >
                      <span className="auth-role-icon">{r.icon}</span>
                      <strong>{r.title}</strong>
                      <small>{r.text}</small>
                      {role === r.id && <span className="join-check">✓</span>}
                    </button>
                  ))}
                </div>

                <label className="auth-label" htmlFor="auth-name">Tu nombre</label>
                <input id="auth-name" className="auth-input" value={name} maxLength={40} autoComplete="name"
                  placeholder="Ej. Andrea Quispe" onChange={(e) => setName(e.target.value)} />
              </>
            )}

            <label className="auth-label" htmlFor="auth-email">Correo electrónico</label>
            <input id="auth-email" className="auth-input" type="email" value={email} autoComplete="email"
              placeholder="tucorreo@ejemplo.com" onChange={(e) => setEmail(e.target.value)} />

            <label className="auth-label" htmlFor="auth-pass">Contraseña</label>
            <div className="auth-pass">
              <input id="auth-pass" className="auth-input" type={verClave ? "text" : "password"} value={password}
                autoComplete={registro ? "new-password" : "current-password"}
                placeholder={registro ? "Mínimo 6 caracteres" : "Tu contraseña"}
                onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="auth-eye" onClick={() => setVerClave(!verClave)}>
                {verClave ? "Ocultar" : "Ver"}
              </button>
            </div>

            {!registro && demo.length > 0 && (
              <div className="auth-demo">
                <span>Cuentas de prueba:</span>
                {demo.map((c) => (
                  <button type="button" key={c.email} onClick={() => usarDemo(c)}>
                    {c.role === "docente" ? "🖥️ Docente" : "📱 Estudiante"}
                  </button>
                ))}
              </div>
            )}

            {error && <p className="join-error" role="alert">{error}</p>}

            <button type="submit" className="join-btn" disabled={!listo || loading}>
              {loading ? "Un momento…" : registro ? "Crear mi cuenta 🚀" : "Entrar 🎲"}
            </button>
          </form>

          <p className="auth-switch">
            {registro ? "¿Ya tienes cuenta?" : "¿Aún no tienes cuenta?"}{" "}
            <button type="button" onClick={() => cambiarTab(registro ? "login" : "register")}>
              {registro ? "Inicia sesión" : "Créala gratis"}
            </button>
          </p>
          <div className="auth-guest">
            <span>¿Solo quieres jugar con un código?</span>
            <button type="button" onClick={onGuest}>Entrar como invitado →</button>
          </div>
          <button className="back-link" onClick={onBack}>← Volver al inicio</button>
        </section>
      </main>
    </div>
  );
}
