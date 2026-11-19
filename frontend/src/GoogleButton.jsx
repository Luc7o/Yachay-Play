import React, { useEffect, useRef } from "react";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
// Sin ID de cliente (p. ej. en local) no hay botón de Google: quien lo use puede ocultar su separador.
export const googleDisponible = !!CLIENT_ID;
let scriptPromise = null;
let inicializado = false;
let manejador = null;

function cargarGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = resolve;
      s.onerror = () => { scriptPromise = null; reject(new Error("No se pudo cargar Google")); };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export function GoogleButton({ onCredential }) {
  const caja = useRef(null);
  manejador = onCredential;

  useEffect(() => {
    if (!CLIENT_ID) return;
    let vivo = true;
    cargarGoogle()
      .then(() => {
        if (!vivo || !caja.current) return;
        if (!inicializado) {
          window.google.accounts.id.initialize({
            client_id: CLIENT_ID,
            callback: (r) => manejador?.(r.credential),
          });
          inicializado = true;
        }
        window.google.accounts.id.renderButton(caja.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          locale: "es",
          width: 280,
        });
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  if (!CLIENT_ID) return null;
  return <div className="yl-google" ref={caja} />;
}