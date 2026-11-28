import React, { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { GoogleButton, googleDisponible } from "./GoogleButton";
import { Icono, Marca, BotonTema } from "./campusUi";
import { Button } from "./ui";
import type { SinTipo } from "./tipos";
import type { Rol } from "../../shared/types/api";
import type { ErrorApi } from "./api";

// ============================================================================
// INICIAR SESIÓN / CREAR CUENTA — diseño "Campus" (ver campus.css, sección "acceso")
// El rol (docente / estudiante) se elige UNA sola vez, al crear la cuenta.
// Props (sin cambios respecto al diseño anterior):
//   tab ("login" | "register"), setTab, onSuccess({ token, user }), onBack, onGuest,
//   onForgot, onNeeds2FA(challenge)
// ============================================================================

const ROLES: { id: Rol; title: string; text: string }[] = [
  { id: "docente", title: "Docente", text: "Creo mis clases y lanzo las actividades." },
  { id: "estudiante", title: "Estudiante", text: "Me uno a mis clases y juego con el código." },
];

const IconEye = ({ off }: { off: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M4 4l16 16" />}
  </svg>
);

// Mismas reglas que valida el servidor (authCore.js → validatePassword).
// La de "contraseña demasiado común" solo la revisa el servidor.
function reglasClave(clave: string, correo: string) {
  return [
    { id: "largo", texto: "8 caracteres o más", ok: clave.length >= 8 && clave.length <= 100 },
    { id: "letra", texto: "Al menos una letra", ok: /[A-Za-z\u00C0-\u017F]/.test(clave) },
    { id: "numero", texto: "Al menos un número", ok: /\d/.test(clave) },
    {
      id: "correo",
      texto: "Distinta de tu correo",
      ok: !!clave && clave.toLowerCase() !== correo.trim().toLowerCase(),
    },
  ];
}

// Columna izquierda: el mensaje de la marca (se oculta en celular).
export function AuthSide({ titulo, texto }: { titulo: string; texto: string }) {
  const Check = Icono.check;
  return (
    <aside className="cp-auth-side" aria-hidden="true">
      <Marca />
      <div className="cp-auth-side-copy">
        <h2>{titulo}</h2>
        <p>{texto}</p>
        <ul>
          <li>
            <Check />
            Clases con sus estudiantes y actividades
          </li>
          <li>
            <Check />
            Juegos en vivo desde el celular, con un código
          </li>
          <li>
            <Check />
            Resultados por partida y por pregunta
          </li>
        </ul>
      </div>
      <span className="cp-auth-side-foot">yachay: aprender, saber (quechua)</span>
    </aside>
  );
}

export function AuthScreen({
  tab,
  setTab,
  onSuccess,
  onBack,
  onGuest,
  onForgot,
  onNeeds2FA,
}: {
  tab: SinTipo;
  setTab: (t: string) => void;
  onSuccess: SinTipo;
  onBack: () => void;
  onGuest: SinTipo;
  onForgot: () => void;
  onNeeds2FA: SinTipo;
}) {
  const registro = tab === "register";
  const [role, setRole] = useState<Rol | "">("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false); // aceptó Términos y Política de Privacidad
  const [edad, setEdad] = useState(false); // 14 años o más, o con autorización de sus padres o tutores
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const primerCampo = useRef<HTMLInputElement>(null);

  // Cuentas de prueba (solo si el servidor las ofrece): permiten entrar con un toque
  const [demo, setDemo] = useState<SinTipo[]>([]);
  useEffect(() => {
    api
      .demoAccounts()
      .then((r) => setDemo(r.accounts || []))
      .catch(() => {});
  }, []);
  function usarDemo(c) {
    setEmail(c.email);
    setPassword(c.password);
    setError("");
  }

  function cambiarTab(t: string) {
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

  const reglas = reglasClave(password, email);
  const claveOk = reglas.every((r) => r.ok);
  // Lo que falta para poder crear la cuenta (se muestra bajo el botón).
  const faltan = registro
    ? [
        !role && "elegir si eres docente o estudiante",
        name.trim().length < 2 && "escribir tu nombre",
        !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) && "un correo válido",
        !claveOk && "una contraseña que cumpla los requisitos",
        !terms && "aceptar los Términos y la Política de Privacidad",
        !edad && "confirmar tu edad",
      ].filter(Boolean)
    : [];
  const listo = registro ? faltan.length === 0 : email.trim() && password;
  // Para REGISTRARSE con Google hacen falta el rol y los términos (el servidor los exige).
  const googleBloqueado = registro && (!role || !terms || !edad);
  const cajaGoogle = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // inert: el botón de Google (un iframe) no recibe clics ni foco mientras esté bloqueado.
    if (cajaGoogle.current) cajaGoogle.current.inert = googleBloqueado;
  }, [googleBloqueado]);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!listo || loading) return;
    setLoading(true);
    setError("");
    try {
      const r = registro
        ? await api.register({ name, email, password, role: role as Rol, acceptTerms: terms, confirmAge: edad })
        : await api.login(email, password);
      if ("needs2FA" in r) return onNeeds2FA(r.challenge); // la cuenta tiene verificación en dos pasos
      onSuccess(r); // { token, user }
    } catch (err) {
      setError((err as ErrorApi).message);
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
  const edadRef = useRef(edad);
  edadRef.current = edad;
  const registroRef = useRef(registro);
  registroRef.current = registro;
  async function entrarConGoogle(credential: string) {
    if (!credential) return;
    if (registroRef.current && (!roleRef.current || !termsRef.current || !edadRef.current)) {
      setError(
        "Antes de registrarte con Google, elige si eres docente o estudiante, acepta los Términos y confirma tu edad.",
      );
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await api.google(
        credential,
        (roleRef.current || undefined) as Rol | undefined,
        termsRef.current,
        edadRef.current,
      );
      if ("needsRole" in r) {
        setTab("register");
        if (r.name) setName(r.name);
        if (r.email) setEmail(r.email);
        setError(
          "Aún no tienes cuenta. Elige si eres docente o estudiante, acepta los Términos, confirma tu edad y vuelve a pulsar «Continuar con Google».",
        );
        return;
      }
      if ("needs2FA" in r) return onNeeds2FA(r.challenge);
      onSuccess(r); // { token, user }
    } catch (err) {
      setError((err as ErrorApi).message);
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
          <Button variant="quiet" onClick={onBack}>
            ← Volver al inicio
          </Button>
          <span className="cp-auth-brand-mobile">
            <Marca onClick={onBack} label="Volver a YachayPlay" />
          </span>
          <BotonTema />
        </div>

        <div className="cp-auth-card">
          <div className="cp-seg" role="tablist" aria-label="Acceso">
            <button
              type="button"
              role="tab"
              aria-selected={!registro}
              className={!registro ? "on" : ""}
              onClick={() => cambiarTab("login")}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={registro}
              className={registro ? "on" : ""}
              onClick={() => cambiarTab("register")}
            >
              Crear cuenta
            </button>
          </div>

          <form className="cp-auth-form" onSubmit={enviar} noValidate>
            <h1>{registro ? "Crea tu cuenta" : "Inicia sesión"}</h1>

            {registro && (
              <fieldset className={"cp-roles" + (role ? "" : " pendiente")} aria-describedby="cp-rol-ayuda">
                <legend>
                  ¿Cómo vas a usar YachayPlay? <span className="cp-req">Obligatorio</span>
                </legend>
                {ROLES.map((r) => (
                  <label key={r.id} className={"cp-role" + (role === r.id ? " on" : "")}>
                    <input
                      type="radio"
                      name="cp-rol"
                      value={r.id}
                      required
                      checked={role === r.id}
                      onChange={() => setRole(r.id)}
                    />
                    <strong>{r.title}</strong>
                    <small>{r.text}</small>
                  </label>
                ))}
                <p id="cp-rol-ayuda" className="cp-help">
                  Se elige una sola vez y no se puede cambiar después.
                </p>
              </fieldset>
            )}

            {registro && (
              <div className="cp-field">
                <label htmlFor="cp-a-name">Tu nombre</label>
                <input
                  id="cp-a-name"
                  ref={primerCampo}
                  className="cp-input"
                  value={name}
                  maxLength={40}
                  autoComplete="name"
                  placeholder="Ej. Andrea Quispe"
                  onChange={(e) => setName(e.target.value)}
                />
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
                {!registro && (
                  <button type="button" className="cp-link" onClick={onForgot}>
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <div className="cp-pass">
                <input
                  id="cp-a-pass"
                  className="cp-input"
                  type={verClave ? "text" : "password"}
                  value={password}
                  autoComplete={registro ? "new-password" : "current-password"}
                  placeholder={registro ? "Crea una contraseña" : "Tu contraseña"}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="cp-eye"
                  onClick={() => setVerClave(!verClave)}
                  aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  <IconEye off={verClave} />
                </button>
              </div>
              {registro && (
                <ul className="cp-reglas" aria-label="Requisitos de la contraseña">
                  {reglas.map((r) => (
                    <li key={r.id} className={r.ok ? "ok" : ""}>
                      <span aria-hidden="true">{r.ok ? "✓" : "•"}</span>
                      {r.texto}
                      <span className="cp-sr">{r.ok ? " (cumplido)" : " (pendiente)"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {registro && (
              <label className="cp-check">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                <span>
                  Acepto los{" "}
                  <a href="/terminos-y-condiciones" target="_blank" rel="noopener noreferrer">
                    Términos y Condiciones
                  </a>{" "}
                  y la{" "}
                  <a href="/politica-de-privacidad" target="_blank" rel="noopener noreferrer">
                    Política de Privacidad
                  </a>
                  .
                </span>
              </label>
            )}
            {registro && (
              <label className="cp-check">
                <input type="checkbox" checked={edad} onChange={(e) => setEdad(e.target.checked)} />
                <span>Tengo 14 años o más, o cuento con la autorización de mis padres o tutores.</span>
              </label>
            )}

            {!registro && demo.length > 0 && (
              <div className="cp-demo-cuentas">
                <span>Cuentas de prueba:</span>
                {demo.map((c) => (
                  <button type="button" key={c.email} className="cp-chip" onClick={() => usarDemo(c)}>
                    {c.role === "docente" ? "Docente" : "Estudiante"}
                  </button>
                ))}
              </div>
            )}

            {error && (
              <p className="cp-msg error" role="alert">
                {error}
              </p>
            )}

            <Button
              size="lg"
              className="cp-full"
              type="submit"

              disabled={!listo || loading}
              aria-describedby={registro ? "cp-faltan" : undefined}
            >
              {loading ? "Un momento…" : registro ? "Crear mi cuenta" : "Entrar"}
            </Button>
            {registro && faltan.length > 0 && (
              <p id="cp-faltan" className="cp-help">
                Para crear tu cuenta falta: {faltan.join(", ")}.
              </p>
            )}

            {googleDisponible && (
              <>
                <div className="cp-or">
                  <span>o</span>
                </div>
                {googleBloqueado && (
                  <p className="cp-help cp-center" id="cp-google-ayuda">
                    Para registrarte con Google, primero{" "}
                    {[
                      !role && "elige si eres docente o estudiante",
                      !terms && "acepta los Términos",
                      !edad && "confirma tu edad",
                    ]
                      .filter(Boolean)
                      .join(", ")
                      .replace(/, ([^,]*)$/, " y $1")}
                    .
                  </p>
                )}
                <div
                  ref={cajaGoogle}
                  className={"cp-google" + (googleBloqueado ? " off" : "")}
                  aria-describedby={googleBloqueado ? "cp-google-ayuda" : undefined}
                >
                  <GoogleButton onCredential={entrarConGoogle} />
                </div>
              </>
            )}
          </form>

          <div className="cp-auth-links">
            {registro ? (
              <span>
                ¿Ya tienes cuenta?{" "}
                <button type="button" className="cp-link" onClick={() => cambiarTab("login")}>
                  Inicia sesión
                </button>
              </span>
            ) : (
              <span>
                ¿Aún no tienes cuenta?{" "}
                <button type="button" className="cp-link" onClick={() => cambiarTab("register")}>
                  Créala gratis
                </button>
              </span>
            )}
            <span>
              ¿Solo quieres jugar con un código?{" "}
              <button type="button" className="cp-link" onClick={onGuest}>
                Entrar como invitado
              </button>
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
