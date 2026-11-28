import React, { useEffect, useState } from "react";
import { api } from "./api";
import { AuthSide } from "./AuthScreen";
import { Marca, BotonTema } from "./campusUi";
import { Button } from "./ui";
import type { ErrorApi } from "./api";
import type { ReactNode } from "react";
import type { SinTipo } from "./tipos";

// ============================================================================
// PANTALLAS EXTRA DE SEGURIDAD — diseño "Campus", igual que el login (clases cp-auth-*)
//   <TwoFactorStep />       2.º paso del login: código de 6 dígitos o código de recuperación
//   <ForgotPasswordScreen/> "¿Olvidaste tu contraseña?": pide el correo
//   <ResetPasswordScreen/>  se abre desde el enlace del correo: nueva contraseña
//   <VerifyEmailScreen/>    se abre desde el enlace del correo de bienvenida: confirma el correo
// ============================================================================

function Marco({
  children,
  onBack,
  backText = "Volver",
}: {
  children: ReactNode;
  onBack: SinTipo;
  backText?: SinTipo;
}) {
  return (
    <div className="cp cp-auth">
      <AuthSide
        titulo="Tu cuenta, protegida."
        texto="Contraseñas guardadas con cifrado, enlaces de un solo uso y verificación en dos pasos opcional."
      />
      <main className="cp-auth-main">
        <div className="cp-auth-top">
          <Button variant="quiet" onClick={onBack}>
            ← {backText}
          </Button>
          <span className="cp-auth-brand-mobile">
            <Marca />
          </span>
          <BotonTema />
        </div>
        <div className="cp-auth-card cp-auth-form">{children}</div>
      </main>
    </div>
  );
}

// ------------------------- 2.º paso del login -------------------------
export function TwoFactorStep({
  challenge,
  onSuccess,
  onCancel,
}: {
  challenge: SinTipo;
  onSuccess: SinTipo;
  onCancel: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [usarRecuperacion, setUsarRecuperacion] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!codigo.trim() || cargando) return;
    setCargando(true);
    setError("");
    try {
      onSuccess(await api.login2fa(challenge, codigo.trim())); // { token, user }
    } catch (err) {
      setError((err as ErrorApi).message);
      if ((err as ErrorApi).status === 401 && /caducó/i.test((err as ErrorApi).message)) setTimeout(onCancel, 1800); // el desafío venció: volver al login
    } finally {
      setCargando(false);
    }
  }

  return (
    <Marco onBack={onCancel} backText="Cancelar">
      <form onSubmit={enviar} noValidate>
        <h1>Verificación en dos pasos</h1>
        <p className="cp-auth-lead">
          {usarRecuperacion
            ? "Escribe uno de tus códigos de recuperación (cada uno sirve una sola vez)."
            : "Abre tu app de autenticación (Google Authenticator, Authy…) y escribe el código de 6 dígitos de YachayPlay."}
        </p>
        <div className="cp-field">
          <label htmlFor="ax-code">{usarRecuperacion ? "Código de recuperación" : "Código de 6 dígitos"}</label>
          <input
            className="cp-input code"
            id="ax-code"
            value={codigo}
            autoFocus
            autoComplete="one-time-code"
            inputMode={usarRecuperacion ? "text" : "numeric"}
            maxLength={usarRecuperacion ? 11 : 7}
            placeholder={usarRecuperacion ? "XXXXX-XXXXX" : "123456"}
            onChange={(e) => setCodigo(e.target.value)}
          />
        </div>
        {error && (
          <p className="cp-msg error" role="alert">
            {error}
          </p>
        )}
        <Button size="lg" className="cp-full" type="submit" disabled={!codigo.trim() || cargando}>
          {cargando ? "Verificando…" : "Verificar y entrar"}
        </Button>
        <div className="cp-auth-links">
          <span>
            <button
              type="button"
              className="cp-link"
              onClick={() => {
                setUsarRecuperacion(!usarRecuperacion);
                setCodigo("");
                setError("");
              }}
            >
              {usarRecuperacion ? "Usar el código de mi app" : "Perdí mi celular: usar un código de recuperación"}
            </button>
          </span>
        </div>
      </form>
    </Marco>
  );
}

// ------------------------- olvidé mi contraseña -------------------------
export function ForgotPasswordScreen({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() || cargando) return;
    setCargando(true);
    setError("");
    try {
      const r = await api.forgotPassword(email.trim());
      setEnviado(r.message || "Si ese correo tiene una cuenta, te enviamos un enlace.");
    } catch (err) {
      setError((err as ErrorApi).message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <Marco onBack={onBack} backText="Volver a iniciar sesión">
      <form onSubmit={enviar} noValidate>
        <h1>Recuperar contraseña</h1>
        {enviado ? (
          <>
            <p className="cp-msg ok" role="status">
              {enviado}
            </p>
            <p className="cp-auth-lead">
              El enlace vale 30 minutos. Si no llega, revisa la carpeta de spam o inténtalo de nuevo.
            </p>
            <Button size="lg" className="cp-full" onClick={onBack}>
              Volver a iniciar sesión
            </Button>
          </>
        ) : (
          <>
            <p className="cp-auth-lead">
              Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva contraseña.
            </p>
            <div className="cp-field">
              <label htmlFor="ax-email">Correo electrónico</label>
              <input
                className="cp-input"
                id="ax-email"
                type="email"
                value={email}
                autoFocus
                autoComplete="email"
                placeholder="tucorreo@ejemplo.com"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && (
              <p className="cp-msg error" role="alert">
                {error}
              </p>
            )}
            <Button size="lg" className="cp-full" type="submit" disabled={!email.trim() || cargando}>
              {cargando ? "Enviando…" : "Enviarme el enlace"}
            </Button>
          </>
        )}
      </form>
    </Marco>
  );
}

// ------------------------- nueva contraseña (desde el correo) -------------------------
export function ResetPasswordScreen({ token, onDone }: { token: SinTipo; onDone: () => void }) {
  const [clave, setClave] = useState("");
  const [repetir, setRepetir] = useState("");
  const [ver, setVer] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (cargando) return;
    if (clave !== repetir) return setError("Las contraseñas no coinciden.");
    setCargando(true);
    setError("");
    try {
      await api.resetPassword(token, clave);
      setListo(true);
    } catch (err) {
      setError((err as ErrorApi).message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <Marco onBack={onDone} backText="Ir al inicio">
      <form onSubmit={enviar} noValidate>
        <h1>Nueva contraseña</h1>
        {listo ? (
          <>
            <p className="cp-msg ok" role="status">
              Contraseña actualizada. Por seguridad se cerraron las demás sesiones.
            </p>
            <Button size="lg" className="cp-full" onClick={onDone}>
              Iniciar sesión
            </Button>
          </>
        ) : (
          <>
            <p className="cp-auth-lead">Mínimo 8 caracteres, con al menos una letra y un número.</p>
            <div className="cp-field">
              <label htmlFor="ax-p1">Contraseña nueva</label>
              <input
                className="cp-input"
                id="ax-p1"
                type={ver ? "text" : "password"}
                value={clave}
                autoFocus
                autoComplete="new-password"
                onChange={(e) => setClave(e.target.value)}
              />
            </div>
            <div className="cp-field">
              <label htmlFor="ax-p2">Repite la contraseña</label>
              <input
                className="cp-input"
                id="ax-p2"
                type={ver ? "text" : "password"}
                value={repetir}
                autoComplete="new-password"
                onChange={(e) => setRepetir(e.target.value)}
              />
            </div>
            <label className="cp-check">
              <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} /> Mostrar contraseñas
            </label>
            {error && (
              <p className="cp-msg error" role="alert">
                {error}
              </p>
            )}
            <Button size="lg" className="cp-full" type="submit" disabled={!clave || !repetir || cargando}>
              {cargando ? "Guardando…" : "Guardar contraseña"}
            </Button>
          </>
        )}
      </form>
    </Marco>
  );
}

// ------------------------- confirmar correo (desde el correo de bienvenida) -------------------------
export function VerifyEmailScreen({ token, onDone }: { token: SinTipo; onDone: () => void }) {
  const [estado, setEstado] = useState("cargando"); // cargando | ok | error
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    let vivo = true;
    api
      .verifyEmail(token)
      .then((r) => {
        if (vivo) {
          setEstado("ok");
          setMensaje(r.message || "Correo verificado.");
        }
      })
      .catch((e) => {
        if (vivo) {
          setEstado("error");
          setMensaje(e.message);
        }
      });
    return () => {
      vivo = false;
    };
  }, [token]);

  return (
    <Marco onBack={onDone} backText="Ir al inicio">
      <div>
        <h1>Confirmar correo</h1>
        {estado === "cargando" && <p className="cp-auth-lead">Verificando tu enlace…</p>}
        {estado === "ok" && (
          <p className="cp-msg ok" role="status">
            {mensaje}
          </p>
        )}
        {estado === "error" && (
          <p className="cp-msg error" role="alert">
            {mensaje}
          </p>
        )}
        {estado !== "cargando" && (
          <Button size="lg" className="cp-full" onClick={onDone}>
            Continuar
          </Button>
        )}
      </div>
    </Marco>
  );
}
