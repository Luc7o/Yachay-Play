import React, { useState } from "react";
import { api } from "./api";
import { Button, Card, Chip, Field, Input, Notice } from "./ui";
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
    } catch {
      /* el navegador no permite copiar */
    }
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
      <Notice tone="ok">
        Guarda estos códigos en un lugar seguro. Se muestran <strong>una sola vez</strong>.
      </Notice>
      <p className="ui-text">Si pierdes tu celular, cada código te deja entrar una vez.</p>
      <ul className="ax-codes">
        {codigos.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="ui-actions">
        <Button variant="ghost" onClick={copiar}>
          {copiado ? "¡Copiados!" : "Copiar"}
        </Button>
        <Button variant="ghost" onClick={descargar}>
          Descargar .txt
        </Button>
        <Button onClick={onListo}>Ya los guardé</Button>
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
  const reiniciar = () => {
    setFase("inicio");
    setCodigo("");
    setClave("");
    setSetup(null);
  };

  async function ejecutar(fn) {
    setCargando(true);
    setMsg({ tipo: "", texto: "" });
    try {
      await fn();
    } catch (e) {
      error(e.message);
    } finally {
      setCargando(false);
    }
  }

  // Se pide la contraseña: con solo una sesión robada no se puede activar el 2FA y dejar fuera al dueño.
  const empezar = () =>
    ejecutar(async () => {
      setSetup(await api.twoFactorSetup(clave || undefined));
      setClave("");
      setFase("configurar");
    });

  const activar = () =>
    ejecutar(async () => {
      const r = await api.twoFactorEnable(codigo);
      onUserUpdate?.({ ...user, ...r.user });
      setRecuperacion(r.recoveryCodes);
      setCodigo("");
      setFase("codigos");
    });

  const desactivar = () =>
    ejecutar(async () => {
      const r = await api.twoFactorDisable(codigo, clave || undefined);
      onUserUpdate?.({ ...user, ...r.user });
      reiniciar();
      setMsg({ tipo: "ok", texto: "Verificación en dos pasos desactivada." });
    });

  const nuevosCodigos = () =>
    ejecutar(async () => {
      const r = await api.twoFactorNewCodes(codigo);
      setRecuperacion(r.recoveryCodes);
      setCodigo("");
      setFase("codigos");
    });

  const limpiar = (siguiente) => () => {
    setMsg({ tipo: "", texto: "" });
    setFase(siguiente);
  };
  const CampoCodigo = ({ maxLength }) => (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={maxLength}
      placeholder="123456"
      value={codigo}
      onChange={(e) => setCodigo(e.target.value)}
    />
  );

  return (
    <Card
      title="Verificación en dos pasos"
      actions={<Chip tone={activo ? "win" : undefined}>{activo ? "Activada" : "Desactivada"}</Chip>}
    >
      <Notice tone={msg.tipo === "ok" ? "ok" : "error"}>{msg.texto}</Notice>

      {fase === "inicio" && (
        <>
          <p className="ui-text">
            {activo
              ? "Al iniciar sesión te pediremos un código de tu app de autenticación además de la contraseña."
              : "Protege tu cuenta: además de la contraseña, se pedirá un código de 6 dígitos de una app como Google Authenticator o Authy."}
          </p>
          <div className="ui-actions">
            {activo ? (
              <>
                <Button variant="ghost" onClick={limpiar("nuevos")}>
                  Generar códigos de recuperación nuevos
                </Button>
                <Button variant="ghost" onClick={limpiar("desactivar")}>
                  Desactivar
                </Button>
              </>
            ) : (
              <>
                {user.hasPassword && (
                  <Field label="Tu contraseña actual" htmlFor="tf-clave">
                    <Input
                      id="tf-clave"
                      type="password"
                      autoComplete="current-password"
                      value={clave}
                      onChange={(e) => setClave(e.target.value)}
                    />
                  </Field>
                )}
                <Button disabled={cargando || (user.hasPassword && !clave)} onClick={empezar}>
                  {cargando ? "Preparando…" : "Activar"}
                </Button>
              </>
            )}
          </div>
        </>
      )}

      {fase === "configurar" && setup && (
        <>
          <p className="ui-text">
            <strong>1.</strong> Abre tu app de autenticación y escanea este código QR.
          </p>
          {setup.qr && <img className="ax-qr" src={setup.qr} alt="Código QR para la app de autenticación" />}
          <p className="ui-text">{setup.qr ? "¿No puedes escanear? " : ""}Escribe esta clave en la app:</p>
          <code className="ax-secret">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</code>
          <Field label="2. Código de 6 dígitos que muestra la app">{CampoCodigo({ maxLength: 7 })}</Field>
          <div className="ui-actions">
            <Button disabled={cargando || codigo.replace(/\s/g, "").length < 6} onClick={activar}>
              {cargando ? "Verificando…" : "Verificar y activar"}
            </Button>
            <Button variant="ghost" onClick={reiniciar}>
              Cancelar
            </Button>
          </div>
        </>
      )}

      {fase === "codigos" && (
        <CodigosRecuperacion
          codigos={recuperacion}
          onListo={() => {
            setRecuperacion([]);
            reiniciar();
            setMsg({ tipo: "ok", texto: "Listo: tu cuenta tiene verificación en dos pasos." });
          }}
        />
      )}

      {(fase === "desactivar" || fase === "nuevos") && (
        <>
          <p className="ui-text">
            {fase === "desactivar"
              ? "Para desactivarla, confirma con un código de tu app (o de recuperación)"
              : "Para generar códigos nuevos (los anteriores dejarán de servir), confirma con un código de tu app"}
            {fase === "desactivar" && user.hasPassword ? " y tu contraseña." : "."}
          </p>
          <Field label="Código">{CampoCodigo({ maxLength: 11 })}</Field>
          {fase === "desactivar" && user.hasPassword && (
            <Field label="Contraseña" htmlFor="tf-clave2">
              <Input
                id="tf-clave2"
                type="password"
                autoComplete="current-password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
              />
            </Field>
          )}
          <div className="ui-actions">
            <Button
              disabled={cargando || !codigo.trim() || (fase === "desactivar" && user.hasPassword && !clave)}
              onClick={fase === "desactivar" ? desactivar : nuevosCodigos}
            >
              {cargando ? "Un momento…" : fase === "desactivar" ? "Desactivar" : "Generar códigos"}
            </Button>
            <Button variant="ghost" onClick={reiniciar}>
              Cancelar
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
