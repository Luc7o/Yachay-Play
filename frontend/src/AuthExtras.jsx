import React, { useEffect, useState } from "react";
import { api } from "./api";
import "./authAnim.css";
import "./authExtras.css";

// ============================================================================
// PANTALLAS EXTRA DE SEGURIDAD (comparten el aspecto del login: clases yl-*)
//   <TwoFactorStep />       2.º paso del login: código de 6 dígitos o código de recuperación
//   <ForgotPasswordScreen/> "¿Olvidaste tu contraseña?": pide el correo
//   <ResetPasswordScreen/>  se abre desde el enlace del correo: nueva contraseña
//   <VerifyEmailScreen/>    se abre desde el enlace del correo de bienvenida: confirma el correo
// ============================================================================

function Marco({ children, onBack, backText = "Volver" }) {
  return (
    <div className="yl-page">
      <div className="yl-top">
        <button type="button" className="yl-pill" onClick={onBack}>{backText}</button>
      </div>
      <main className="ax-card">{children}</main>
    </div>
  );
}

// ------------------------- 2.º paso del login -------------------------
export function TwoFactorStep({ challenge, onSuccess, onCancel }) {
  const [codigo, setCodigo] = useState("");
  const [usarRecuperacion, setUsarRecuperacion] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    if (!codigo.trim() || cargando) return;
    setCargando(true);
    setError("");
    try {
      onSuccess(await api.login2fa(challenge, codigo.trim())); // { token, user }
    } catch (err) {
      setError(err.message);
      if (err.status === 401 && /caducó/i.test(err.message)) setTimeout(onCancel, 1800); // el desafío venció: volver al login
    } finally {
      setCargando(false);
    }
  }

  return (
    <Marco onBack={onCancel} backText="Cancelar">
      <form onSubmit={enviar} noValidate>
        <h1>Verificación en dos pasos</h1>
        <p className="ax-lead">
          {usarRecuperacion
            ? "Escribe uno de tus códigos de recuperación (cada uno sirve una sola vez)."
            : "Abre tu app de autenticación (Google Authenticator, Authy…) y escribe el código de 6 dígitos de YachayPlay."}
        </p>
        <div className="yl-field">
          <label htmlFor="ax-code">{usarRecuperacion ? "Código de recuperación" : "Código de 6 dígitos"}</label>
          <input
            id="ax-code"
            value={codigo}
            autoFocus
            autoComplete="one-time-code"
            inputMode={usarRecuperacion ? "text" : "numeric"}
            maxLength={usarRecuperacion ? 11 : 7}
            placeholder={usarRecuperacion ? "XXXXX-XXXXX" : "123456"}
            onChange={(e) => setCodigo(e.target.value)}
          />
          <i className="yl-bar" />
        </div>
        {error && <p className="yl-error" role="alert">{error}</p>}
        <button type="submit" className="yl-btn" disabled={!codigo.trim() || cargando}>{cargando ? "Verificando…" : "Verificar y entrar"}</button>
        <div className="yl-links">
          <span>
            <button type="button" onClick={() => { setUsarRecuperacion(!usarRecuperacion); setCodigo(""); setError(""); }}>
              {usarRecuperacion ? "Usar el código de mi app" : "Perdí mi celular: usar un código de recuperación"}
            </button>
          </span>
        </div>
      </form>
    </Marco>
  );
}

// ------------------------- olvidé mi contraseña -------------------------
export function ForgotPasswordScreen({ onBack }) {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    if (!email.trim() || cargando) return;
    setCargando(true);
    setError("");
    try {
      const r = await api.forgotPassword(email.trim());
      setEnviado(r.message || "Si ese correo tiene una cuenta, te enviamos un enlace.");
    } catch (err) {
      setError(err.message);
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
            <p className="yl-ok" role="status">{enviado}</p>
            <p className="ax-lead">El enlace vale 30 minutos. Si no llega, revisa la carpeta de spam o inténtalo de nuevo.</p>
            <button type="button" className="yl-btn" onClick={onBack}>Volver a iniciar sesión</button>
          </>
        ) : (
          <>
            <p className="ax-lead">Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva contraseña.</p>
            <div className="yl-field">
              <label htmlFor="ax-email">Correo electrónico</label>
              <input id="ax-email" type="email" value={email} autoFocus autoComplete="email" placeholder="tucorreo@ejemplo.com" onChange={(e) => setEmail(e.target.value)} />
              <i className="yl-bar" />
            </div>
            {error && <p className="yl-error" role="alert">{error}</p>}
            <button type="submit" className="yl-btn" disabled={!email.trim() || cargando}>{cargando ? "Enviando…" : "Enviarme el enlace"}</button>
          </>
        )}
      </form>
    </Marco>
  );
}

// ------------------------- nueva contraseña (desde el correo) -------------------------
export function ResetPasswordScreen({ token, onDone }) {
  const [clave, setClave] = useState("");
  const [repetir, setRepetir] = useState("");
  const [ver, setVer] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    if (cargando) return;
    if (clave !== repetir) return setError("Las contraseñas no coinciden.");
    setCargando(true);
    setError("");
    try {
      await api.resetPassword(token, clave);
      setListo(true);
    } catch (err) {
      setError(err.message);
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
            <p className="yl-ok" role="status">Contraseña actualizada. Por seguridad se cerraron las demás sesiones.</p>
            <button type="button" className="yl-btn" onClick={onDone}>Iniciar sesión</button>
          </>
        ) : (
          <>
            <p className="ax-lead">Mínimo 8 caracteres, con al menos una letra y un número.</p>
            <div className="yl-field">
              <label htmlFor="ax-p1">Contraseña nueva</label>
              <input id="ax-p1" type={ver ? "text" : "password"} value={clave} autoFocus autoComplete="new-password" onChange={(e) => setClave(e.target.value)} />
              <i className="yl-bar" />
            </div>
            <div className="yl-field">
              <label htmlFor="ax-p2">Repite la contraseña</label>
              <input id="ax-p2" type={ver ? "text" : "password"} value={repetir} autoComplete="new-password" onChange={(e) => setRepetir(e.target.value)} />
              <i className="yl-bar" />
            </div>
            <label className="ax-check"><input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} /> Mostrar contraseñas</label>
            {error && <p className="yl-error" role="alert">{error}</p>}
            <button type="submit" className="yl-btn" disabled={!clave || !repetir || cargando}>{cargando ? "Guardando…" : "Guardar contraseña"}</button>
          </>
        )}
      </form>
    </Marco>
  );
}

// ------------------------- confirmar correo (desde el correo de bienvenida) -------------------------
export function VerifyEmailScreen({ token, onDone }) {
  const [estado, setEstado] = useState("cargando"); // cargando | ok | error
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    let vivo = true;
    api
      .verifyEmail(token)
      .then((r) => { if (vivo) { setEstado("ok"); setMensaje(r.message || "Correo verificado."); } })
      .catch((e) => { if (vivo) { setEstado("error"); setMensaje(e.message); } });
    return () => { vivo = false; };
  }, [token]);

  return (
    <Marco onBack={onDone} backText="Ir al inicio">
      <div>
        <h1>Confirmar correo</h1>
        {estado === "cargando" && <p className="ax-lead">Verificando tu enlace…</p>}
        {estado === "ok" && <p className="yl-ok" role="status">{mensaje}</p>}
        {estado === "error" && <p className="yl-error" role="alert">{mensaje}</p>}
        {estado !== "cargando" && <button type="button" className="yl-btn" onClick={onDone}>Continuar</button>}
      </div>
    </Marco>
  );
}