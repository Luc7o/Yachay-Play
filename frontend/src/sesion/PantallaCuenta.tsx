import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthScreen } from "../AuthScreen";
import { ForgotPasswordScreen, ResetPasswordScreen, TwoFactorStep, VerifyEmailScreen } from "../AuthExtras";
import type { SinTipo } from "../tipos";

// ============================================================================
// PANTALLAS DE CUENTA: enlaces del correo (verificar / restablecer), segundo
// paso del 2FA, "olvidé mi contraseña" e iniciar sesión / crear cuenta.
// Devuelve null cuando la ruta no es de cuenta: entonces App sigue con lo demás.
//   ruta: lo que devuelve leerRuta()   alEntrar({ token, user }): sesión iniciada
//   alInvitado(): "entrar como invitado"   permitirLogin: false con una partida de Ludo abierta
//   conSesion: con la sesión ya iniciada, #/entrar y #/registro no se muestran (App lleva al panel)
// ============================================================================
export function usePantallaCuenta({ ruta, alEntrar, alInvitado, permitirLogin, conSesion }) {
  const navigate = useNavigate();
  const [desafio2fa, setDesafio2fa] = useState<SinTipo>(null); // 2.º paso del login (cuenta con 2FA)
  // Los tokens del correo se guardan en memoria y se sacan de la barra de direcciones apenas se leen.
  const [resetToken, setResetToken] = useState(() => ruta.restablecer || null);
  const [verifyToken, setVerifyToken] = useState(() => ruta.verificar || null);
  // (También si el enlace llega con la app ya abierta: solo cambia el "#".)
  useEffect(() => {
    if (!ruta.restablecer && !ruta.verificar) return;
    if (ruta.restablecer) setResetToken(ruta.restablecer);
    if (ruta.verificar) setVerifyToken(ruta.verificar);
    navigate("/", { replace: true });
  }, [ruta.restablecer, ruta.verificar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Los enlaces del correo van primero, aunque haya una partida o modo guardado.
  if (verifyToken)
    return (
      <VerifyEmailScreen
        token={verifyToken}
        onDone={() => {
          setVerifyToken(null);
          window.location.reload(); // así el perfil ya muestra el correo verificado
        }}
      />
    );
  if (resetToken)
    return (
      <ResetPasswordScreen
        token={resetToken}
        onDone={() => {
          setResetToken(null);
          navigate("/entrar", { replace: true });
        }}
      />
    );
  if (!permitirLogin) return null;
  if (desafio2fa)
    return (
      <TwoFactorStep
        challenge={desafio2fa}
        onSuccess={(r) => {
          setDesafio2fa(null);
          alEntrar(r);
        }}
        onCancel={() => setDesafio2fa(null)}
      />
    );
  if (ruta.olvide) return <ForgotPasswordScreen onBack={() => navigate("/entrar")} />;
  if (ruta.auth && !conSesion)
    return (
      <AuthScreen
        tab={ruta.auth}
        setTab={(t) => navigate(t === "login" ? "/entrar" : "/registro")}
        onSuccess={alEntrar}
        onForgot={() => navigate("/olvide")}
        onNeeds2FA={setDesafio2fa}
        onBack={() => navigate("/")}
        onGuest={alInvitado}
      />
    );
  return null;
}
