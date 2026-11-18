import React, { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { GoogleButton } from "./GoogleButton";
import "./authAnim.css";
import "./authExtras.css";

const ROLES = [
  { id: "docente", title: "Docente", text: "Creo y proyecto las partidas." },
  { id: "estudiante", title: "Estudiante", text: "Juego con el código de mi docente." },
];

// Recortes de la hoja clara: a la izquierda (inicio de sesión) o a la derecha (crear cuenta).
// Colapsada a un lado u otro, la hoja desaparece un instante y reaparece por el lado contrario.
const P = {
  L: "polygon(0 0,47% 0,55% 100%,0 100%)",
  R: "polygon(53% 0,100% 0,100% 100%,45% 100%)",
  cl: "polygon(0 0,0 0,0 100%,0 100%)",
  cr: "polygon(100% 0,100% 0,100% 100%,100% 100%)",
};

const IconMail = () => (
  <svg className="yl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);
const IconUser = () => (
  <svg className="yl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M20 21a8 8 0 0 0-16 0" />
  </svg>
);
const IconEye = ({ off }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M4 4l16 16" />}
  </svg>
);

// Pantalla de "Iniciar sesión" y "Crear cuenta".
// El rol (docente / estudiante) se elige UNA sola vez, al crear la cuenta.
// Una hoja clara con corte diagonal se desliza sobre un panel verde al cambiar de pestaña.
export function AuthScreen({ tab, setTab, onSuccess, onBack, onGuest, onForgot, onNeeds2FA }) {
  const registro = tab === "register";
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");
  const toggleTheme = () => {
    const next = (document.documentElement.dataset.theme || "light") === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try { localStorage.setItem("yp_theme", next); } catch { /* navegación privada */ }
  };
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false); // aceptó Términos y Política de Privacidad
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
  // El botón de Google guarda su callback al iniciar, así que leemos rol y pestaña desde refs.
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

  // ---- Animación de la hoja diagonal ----
  const sheetRef = useRef(null);
  const loginRef = useRef(null);
  const regRef = useRef(null);
  const animRef = useRef(null);
  const prevTab = useRef(tab);

  // El formulario que no se ve queda inerte: no recibe foco ni clics.
  useEffect(() => {
    if (loginRef.current) loginRef.current.inert = registro;
    if (regRef.current) regRef.current.inert = !registro;
  }, [registro]);

  useEffect(() => {
    if (prevTab.current === tab) return; // primera carga: sin animación
    prevTab.current = tab;
    const destino = (registro ? regRef : loginRef).current;
    const enfocar = () => destino?.querySelector("input")?.focus({ preventScroll: true });
    const quieto =
      window.matchMedia("(max-width:819px)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sheet = sheetRef.current;
    if (quieto || !sheet || !sheet.animate) { enfocar(); return; }
    if (animRef.current) animRef.current.cancel();
    const a = sheet.animate(
      [
        { clipPath: registro ? P.L : P.R, offset: 0, easing: "cubic-bezier(.6,0,.9,.4)" },
        { clipPath: registro ? P.cl : P.cr, offset: 0.4, easing: "linear" },
        { clipPath: registro ? P.cr : P.cl, offset: 0.46, easing: "cubic-bezier(.12,.9,.25,1)" },
        { clipPath: registro ? P.R : P.L, offset: 1 },
      ],
      { duration: 1150, fill: "both" }
    );
    animRef.current = a;
    a.onfinish = () => { a.cancel(); animRef.current = null; enfocar(); };
  }, [tab, registro]);

  useEffect(() => () => animRef.current?.cancel(), []);

  const campoClave = (id) => (
    <div className="yl-field">
      <label htmlFor={id}>Contraseña</label>
      <input
        id={id}
        type={verClave ? "text" : "password"}
        value={password}
        autoComplete={registro ? "new-password" : "current-password"}
        placeholder={registro ? "Mínimo 8, con letras y números" : "Tu contraseña"}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="button" className="yl-eye" onClick={() => setVerClave(!verClave)} aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}>
        <IconEye off={verClave} />
      </button>
      <i className="yl-bar" />
    </div>
  );

  const bloqueError = error && (
    <p className="yl-error" role="alert">{error}</p>
  );

  return (
    <div className="yl-page">
      <div className="yl-top">
        <button type="button" className="yl-pill" onClick={onBack}>Volver al inicio</button>
        <button type="button" className="yl-pill" onClick={toggleTheme} aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>
          <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span> {theme === "dark" ? "Modo claro" : "Modo oscuro"}
        </button>
      </div>

      <button type="button" className="yl-logo" onClick={onBack} aria-label="Volver a YachayPlay">
        <img className="yl-lg-light" src="/logo-aula.png" alt="YachayPlay" />
        <img className="yl-lg-dark" src="/logo-aula-dark.png" alt="" aria-hidden="true" />
      </button>

      <main className="yl-card" data-mode={registro ? "register" : "login"}>
        {/* Panel verde (fondo) */}
        <div className="yl-green">
          <div className="yl-blk yl-blk-login">
            <img src="/mascota-explica.png" alt="" />
            <h2>Bienvenido <em>de nuevo.</em></h2>
            <p>Qué bueno verte. Inicia sesión y entrarás directo a tu panel.</p>
          </div>
          <div className="yl-blk yl-blk-reg">
            <img src="/mascota-explica.png" alt="" />
            <h2>Empieza tu <em>primera partida.</em></h2>
            <p>Crea tu cuenta una sola vez. Tu rol queda guardado y no tendrás que elegirlo cada vez que juegues.</p>
          </div>
        </div>

        {/* Hoja clara con corte diagonal */}
        <div className="yl-wrap">
          <div className="yl-sheet" ref={sheetRef}>
            <form className="yl-form yl-form-login" ref={loginRef} onSubmit={enviar} noValidate aria-hidden={registro}>
              <h1>Iniciar sesión</h1>
              <div className="yl-field">
                <label htmlFor="yl-l-email">Correo electrónico</label>
                <input id="yl-l-email" type="email" value={email} autoComplete="email" placeholder="tucorreo@ejemplo.com" onChange={(e) => setEmail(e.target.value)} />
                <IconMail />
                <i className="yl-bar" />
              </div>
              {campoClave("yl-l-pass")}
              <button type="button" className="yl-forgot" onClick={onForgot}>¿Olvidaste tu contraseña?</button>

              {demo.length > 0 && (
                <div className="yl-demo">
                  <span>Cuentas de prueba:</span>
                  {demo.map((c) => (
                    <button type="button" key={c.email} onClick={() => usarDemo(c)}>
                      {c.role === "docente" ? "Docente" : "Estudiante"}
                    </button>
                  ))}
                </div>
              )}

              {!registro && bloqueError}
              <button type="submit" className="yl-btn" disabled={!listo || loading}>
                {loading ? "Un momento…" : "Entrar"}
              </button>
              <div className="yl-or"><span>o</span></div>
              <GoogleButton onCredential={entrarConGoogle} />
              <div className="yl-links">
                <span>¿Aún no tienes cuenta? <button type="button" onClick={() => cambiarTab("register")}>Créala gratis</button></span>
                <span>¿Solo quieres jugar con un código? <button type="button" onClick={onGuest}>Entrar como invitado</button></span>
              </div>
            </form>

            <form className="yl-form yl-form-reg" ref={regRef} onSubmit={enviar} noValidate aria-hidden={!registro}>
              <h1>Crea tu cuenta</h1>
              <span className="yl-lbl yl-lbl-roles" id="yl-roles-lbl">¿Cómo vas a usar YachayPlay?</span>
              <div className="yl-roles" role="radiogroup" aria-labelledby="yl-roles-lbl">
                {ROLES.map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    role="radio"
                    aria-checked={role === r.id}
                    data-r={r.id}
                    className="yl-role"
                    onClick={() => setRole(r.id)}
                  >
                    <strong>{r.title}</strong>
                    <small>{r.text}</small>
                  </button>
                ))}
              </div>
              <div className="yl-field">
                <label htmlFor="yl-r-name">Tu nombre</label>
                <input id="yl-r-name" value={name} maxLength={40} autoComplete="name" placeholder="Ej. Andrea Quispe" onChange={(e) => setName(e.target.value)} />
                <IconUser />
                <i className="yl-bar" />
              </div>
              <div className="yl-field">
                <label htmlFor="yl-r-email">Correo electrónico</label>
                <input id="yl-r-email" type="email" value={email} autoComplete="email" placeholder="tucorreo@ejemplo.com" onChange={(e) => setEmail(e.target.value)} />
                <IconMail />
                <i className="yl-bar" />
              </div>
              {campoClave("yl-r-pass")}

              <label className="ax-terms">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                <span>
                  Acepto los <a href="/terminos-y-condiciones" target="_blank" rel="noopener noreferrer">Términos y Condiciones</a> y la{" "}
                  <a href="/politica-de-privacidad" target="_blank" rel="noopener noreferrer">Política de Privacidad</a>.
                </span>
              </label>
              {registro && bloqueError}
              <button type="submit" className="yl-btn" disabled={!listo || loading}>
                {loading ? "Un momento…" : "Crear mi cuenta"}
              </button>
              <div className="yl-or"><span>o</span></div>
              <GoogleButton onCredential={entrarConGoogle} />
              <div className="yl-links">
                <span>¿Ya tienes cuenta? <button type="button" onClick={() => cambiarTab("login")}>Inicia sesión</button></span>
                <span>¿Solo quieres jugar con un código? <button type="button" onClick={onGuest}>Entrar como invitado</button></span>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
