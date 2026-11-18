import React, { useState } from "react";
import { api } from "./api";
import "./authExtras.css";

// ============================================================================
// Tarjeta "Verificación en dos pasos" para la pantalla Mi perfil.
//   <TwoFactorSettings user={user} onUserUpdate={setUser} />
// ============================================================================

function CodigosRecuperacion({ codigos, onListo }) {
  const [copiado, setCopiado] = useState(false);
  const texto = `Códigos de recuperación de YachayPlay\n(cada código sirve una sola vez)\n\n${codigos.join("\n")}\n`;
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch { /* el navegador no permite copiar */ }
  }
  function descargar() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([texto], { type: "text/plain" }));
    a.download = "yachayplay-codigos-de-recuperacion.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  return (
    <>
      <div className="tl-ok">Guarda estos códigos en un lugar seguro. Se muestran <strong>una sola vez</strong>.</div>
      <p className="ax-step">Si pierdes tu celular, cada código te deja entrar una vez.</p>
      <ul className="ax-codes">{codigos.map((c) => <li key={c}>{c}</li>)}</ul>
      <div className="tl-actions">
        <button className="tl-btn ghost" onClick={copiar}>{copiado ? "¡Copiados!" : "Copiar"}</button>
        <button className="tl-btn ghost" onClick={descargar}>Descargar .txt</button>
        <button className="tl-btn" onClick={onListo}>Ya los guardé</button>
      </div>
    </>
  );
}

export function TwoFactorSettings({ user, onUserUpdate }) {
  const [fase, setFase] = useState("inicio"); // inicio | configurar | codigos | desactivar | nuevos
  const [setup, setSetup] = useState(null); // { secret, qr }
  const [codigo, setCodigo] = useState("");
  const [clave, setClave] = useState("");
  const [recuperacion, setRecuperacion] = useState([]);
  const [msg, setMsg] = useState({ tipo: "", texto: "" });
  const [cargando, setCargando] = useState(false);

  const activo = !!user.twoFactorEnabled;
  const error = (texto) => setMsg({ tipo: "error", texto });
  const reiniciar = () => { setFase("inicio"); setCodigo(""); setClave(""); setSetup(null); };

  async function ejecutar(fn) {
    setCargando(true);
    setMsg({ tipo: "", texto: "" });
    try { await fn(); } catch (e) { error(e.message); } finally { setCargando(false); }
  }

  const empezar = () => ejecutar(async () => { setSetup(await api.twoFactorSetup()); setFase("configurar"); });

  const activar = () => ejecutar(async () => {
    const r = await api.twoFactorEnable(codigo);
    onUserUpdate?.({ ...user, ...r.user });
    setRecuperacion(r.recoveryCodes);
    setCodigo("");
    setFase("codigos");
  });

  const desactivar = () => ejecutar(async () => {
    const r = await api.twoFactorDisable(codigo, clave || undefined);
    onUserUpdate?.({ ...user, ...r.user });
    reiniciar();
    setMsg({ tipo: "ok", texto: "Verificación en dos pasos desactivada." });
  });

  const nuevosCodigos = () => ejecutar(async () => {
    const r = await api.twoFactorNewCodes(codigo);
    setRecuperacion(r.recoveryCodes);
    setCodigo("");
    setFase("codigos");
  });

  return (
    <section className="tl-box tl-form">
      <h2>🛡️ Verificación en dos pasos <span className={`ax-badge ${activo ? "on" : "off"}`}>{activo ? "Activada" : "Desactivada"}</span></h2>
      {msg.texto && <div className={msg.tipo === "ok" ? "tl-ok" : "tl-error"}>{msg.texto}</div>}

      {fase === "inicio" && (
        <>
          <p className="ax-step">
            {activo
              ? "Al iniciar sesión te pediremos un código de tu app de autenticación además de la contraseña."
              : "Protege tu cuenta: además de la contraseña, se pedirá un código de 6 dígitos de una app como Google Authenticator o Authy."}
          </p>
          <div className="tl-actions">
            {activo ? (
              <>
                <button className="tl-btn ghost" onClick={() => { setMsg({ tipo: "", texto: "" }); setFase("nuevos"); }}>Generar códigos de recuperación nuevos</button>
                <button className="tl-btn ghost" onClick={() => { setMsg({ tipo: "", texto: "" }); setFase("desactivar"); }}>Desactivar</button>
              </>
            ) : (
              <button className="tl-btn" disabled={cargando} onClick={empezar}>{cargando ? "Preparando…" : "Activar"}</button>
            )}
          </div>
        </>
      )}

      {fase === "configurar" && setup && (
        <>
          <p className="ax-step"><strong>1.</strong> Abre tu app de autenticación y escanea este código QR.</p>
          {setup.qr && <img className="ax-qr" src={setup.qr} alt="Código QR para la app de autenticación" />}
          <p className="ax-step">{setup.qr ? "¿No puedes escanear? " : ""}Escribe esta clave en la app:</p>
          <code className="ax-secret">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</code>
          <p className="ax-step"><strong>2.</strong> Escribe el código de 6 dígitos que muestra la app:</p>
          <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123456" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          <div className="tl-actions">
            <button className="tl-btn" disabled={cargando || codigo.replace(/\s/g, "").length < 6} onClick={activar}>{cargando ? "Verificando…" : "Verificar y activar"}</button>
            <button className="tl-btn ghost" onClick={reiniciar}>Cancelar</button>
          </div>
        </>
      )}

      {fase === "codigos" && <CodigosRecuperacion codigos={recuperacion} onListo={() => { setRecuperacion([]); reiniciar(); setMsg({ tipo: "ok", texto: "Listo: tu cuenta tiene verificación en dos pasos." }); }} />}

      {(fase === "desactivar" || fase === "nuevos") && (
        <>
          <p className="ax-step">
            {fase === "desactivar" ? "Para desactivarla, confirma con un código de tu app (o de recuperación)" : "Para generar códigos nuevos (los anteriores dejarán de servir), confirma con un código de tu app"}
            {fase === "desactivar" && user.hasPassword ? " y tu contraseña." : "."}
          </p>
          <label>Código</label>
          <input type="text" autoComplete="one-time-code" maxLength={11} placeholder="123456" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          {fase === "desactivar" && user.hasPassword && (
            <>
              <label>Contraseña</label>
              <input type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
            </>
          )}
          <div className="tl-actions">
            <button className="tl-btn" disabled={cargando || !codigo.trim() || (fase === "desactivar" && user.hasPassword && !clave)} onClick={fase === "desactivar" ? desactivar : nuevosCodigos}>
              {cargando ? "Un momento…" : fase === "desactivar" ? "Desactivar" : "Generar códigos"}
            </button>
            <button className="tl-btn ghost" onClick={reiniciar}>Cancelar</button>
          </div>
        </>
      )}
    </section>
  );
}
