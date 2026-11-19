import React, { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { GoogleButton, googleDisponible } from "./GoogleButton";
import { Icono, Marca, BotonTema } from "./campusUi";

// ============================================================================
// INICIAR SESIÓN / CREAR CUENTA — diseño "Campus" (ver campus.css, sección "acceso")
// El rol (docente / estudiante) se elige UNA sola vez, al crear la cuenta.
// Props (sin cambios respecto al diseño anterior):
//   tab ("login" | "register"), setTab, onSuccess({ token, user }), onBack, onGuest,
//   onForgot, onNeeds2FA(challenge)
// ============================================================================

const ROLES = [
  { id: "docente", title: "Docente", text: "Creo mis clases y lanzo las actividades." },
  { id: "estudiante", title: "Estudiante", text: "Me uno a mis clases y juego con el código." },
];

const IconEye = ({ off }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M4 4l16 16" />}
  </svg>
);

// Columna izquierda: el mensaje de la marca (se oculta en celular).
export function AuthSide({ titulo, texto }) {
  const Check = Icono.check;
  return (
    <aside className="cp-auth-side" aria-hidden="true">
      <Marca />
      <div className="cp-auth-side-copy">
        <h2>{titulo}</h2>
        <p>{texto}</p>
        <ul>
          <li><Check />Clases con sus estudiantes y actividades</li>
          <li><Check />Juegos en vivo desde el celular, con un código</li>
          <li><Check />Resultados por partida y por pregunta</li>
        </ul>
      </div>
      <span className="cp-auth-side-foot">yachay: aprender, saber (quechua)</span>
    </aside>
  );
}

export function AuthScreen({ tab, setTab, onSuccess, onBack, onGuest, onForgot, onNeeds2FA }) {
  const registro = tab === "register";
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false); // aceptó Términos y Política de Privacidad
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const primerCampo = useRef(null);

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
  // Al cambiar de pestaña, el foco va al primer campo.
  const primeraCarga = useRef(true);
  useEffect(() => {
    if (primeraCarga.current) {
      primeraCarga.current = false;
      return;
    }
    primerCampo.current?.focus({ preventScroll: true });
  }, [registro]);

  const listo = registro
    ? role && name.trim().length >= 2 && email.trim() && password.length >= 8 && terms
    : email.trim() && password;

  async function enviar(e) {
    e.preventDefault();
    if (!listo || loading) return;
    setLoading(true);
    setError("");
    try {
      const r = registro
        ? await api.register({ name, email, password, role, acceptTerms: terms })
        : await api.login(email, password);
      if (r.needs2FA) return onNeeds2FA(r.challenge); // la cuenta tiene verificación en dos pasos
      onSuccess(r); // { token, user }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ---- Google ----
  // El botón de Google guarda su callback al iniciar, así que leemos rol y términos desde refs.
  const roleRef = useRef(role);
  roleRef.current = role;
  const termsRef = useRef(terms);
  termsRef.current = terms;
  async function entrarConGoogle(credential) {
    if (!credential) return;
    setLoading(true);
    setError("");
    try {
      const r = await api.google(credential, roleRef.current || undefined, termsRef.current);
      if (r.needsRole) {
        setTab("register");
        if (r.name) setName(r.name);
        if (r.email) setEmail(r.email);
        setError("Aún no tienes cuenta. Elige si eres docente o estudiante, acepta los Términos y la Política de Privacidad, y vuelve a pulsar «Continuar con Google».");
        return;
      }
      if (r.needs2FA) return onNeeds2FA(r.challenge);
      onSuccess(r); // { token, user }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="cp cp-auth">
      <AuthSide
        titulo={registro ? "Crea tu cuenta una sola vez." : "Bienvenido de nuevo."}
        texto={
          registro
            ? "Tu rol queda guardado: como docente organizas tus clases; como estudiante entras a ellas y a sus partidas."
            : "Entra a tu panel para seguir con tus clases y tus partidas."
        }
      />

      <main className="cp-auth-main">
        <div className="cp-auth-top">
          <button type="button" className="cp-btn quiet" onClick={onBack}>← Volver al inicio</button>
          <span className="cp-auth-brand-mobile"><Marca onClick={onBack} label="Volver a YachayPlay" /></span>
          <BotonTema />
        </div>

        <div className="cp-auth-card">
          <div className="cp-seg" role="tablist" aria-label="Acceso">
            <button type="button" role="tab" aria-selected={!registro} className={!registro ? "on" : ""} onClick={() => cambiarTab("login")}>Iniciar sesión</button>
            <button type="button" role="tab" aria-selected={registro} className={registro ? "on" : ""} onClick={() => cambiarTab("register")}>Crear cuenta</button>
          </div>

          <form className="cp-auth-form" onSubmit={enviar} noValidate>
            <h1>{registro ? "Crea tu cuenta" : "Inicia sesión"}</h1>

            {registro && (
              <fieldset className="cp-roles">
                <legend>¿Cómo vas a usar YachayPlay?</legend>
                {ROLES.map((r) => (
                  <label key={r.id} className={"cp-role" + (role === r.id ? " on" : "")}>
                    <input type="radio" name="cp-rol" value={r.id} checked={role === r.id} onChange={() => setRole(r.id)} />
                    <strong>{r.title}</strong>
                    <small>{r.text}</small>
                  </label>
                ))}
              </fieldset>
            )}

            {registro && (
              <div className="cp-field">
                <label htmlFor="cp-a-name">Tu nombre</label>
                <input id="cp-a-name" ref={primerCampo} className="cp-input" value={name} maxLength={40} autoComplete="name" placeholder="Ej. Andrea Quispe" onChange={(e) => setName(e.target.value)} />
              </div>
            )}

            <div className="cp-field">
              <label htmlFor="cp-a-email">Correo electrónico</label>
              <input
                id="cp-a-email"
                ref={registro ? undefined : primerCampo}
                className="cp-input"
                type="email"
                value={email}
                autoComplete="email"
                placeholder="tucorreo@universidad.edu"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="cp-field">
              <div className="cp-field-head">
                <label htmlFor="cp-a-pass">Contraseña</label>
                {!registro && <button type="button" className="cp-link" onClick={onForgot}>¿Olvidaste tu contraseña?</button>}
              </div>
              <div className="cp-pass">
                <input
                  id="cp-a-pass"
                  className="cp-input"
                  type={verClave ? "text" : "password"}
                  value={password}
                  autoComplete={registro ? "new-password" : "current-password"}
                  placeholder={registro ? "Mínimo 8, con letras y números" : "Tu contraseña"}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" className="cp-eye" onClick={() => setVerClave(!verClave)} aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}>
                  <IconEye off={verClave} />
                </button>
              </div>
            </div>

            {registro && (
              <label className="cp-check">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                <span>
                  Acepto los <a href="/terminos-y-condiciones" target="_blank" rel="noopener noreferrer">Términos y Condiciones</a> y la{" "}
                  <a href="/politica-de-privacidad" target="_blank" rel="noopener noreferrer">Política de Privacidad</a>.
                </span>
              </label>
            )}

            {!registro && demo.length > 0 && (
              <div className="cp-demo">
                <span>Cuentas de prueba:</span>
                {demo.map((c) => (
                  <button type="button" key={c.email} className="cp-chip" onClick={() => usarDemo(c)}>
                    {c.role === "docente" ? "Docente" : "Estudiante"}
                  </button>
                ))}
              </div>
            )}

            {error && <p className="cp-msg error" role="alert">{error}</p>}

            <button type="submit" className="cp-btn primary lg cp-full" disabled={!listo || loading}>
              {loading ? "Un momento…" : registro ? "Crear mi cuenta" : "Entrar"}
            </button>

            {googleDisponible && (
              <>
                <div className="cp-or"><span>o</span></div>
                <div className="cp-google"><GoogleButton onCredential={entrarConGoogle} /></div>
              </>
            )}
          </form>

          <div className="cp-auth-links">
            {registro ? (
              <span>¿Ya tienes cuenta? <button type="button" className="cp-link" onClick={() => cambiarTab("login")}>Inicia sesión</button></span>
            ) : (
              <span>¿Aún no tienes cuenta? <button type="button" className="cp-link" onClick={() => cambiarTab("register")}>Créala gratis</button></span>
            )}
            <span>¿Solo quieres jugar con un código? <button type="button" className="cp-link" onClick={onGuest}>Entrar como invitado</button></span>
          </div>
        </div>
      </main>
    </div>
  );
}
