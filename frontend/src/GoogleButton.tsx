import React, { useEffect, useRef } from "react";
import type { SinTipo } from "./tipos";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
// Sin ID de cliente (p. ej. en local) no hay botón de Google: quien lo use puede ocultar su separador.
export const googleDisponible = !!CLIENT_ID;
// API de Google Identity Services (se carga desde su script, sin tipos publicados aquí)
declare global {
  interface Window {
    google?: SinTipo;
  }
}
let scriptPromise: Promise<unknown> | null = null;
let inicializado = false;
let manejador: ((credential: string) => void) | null = null;

function cargarGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = resolve;
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error("No se pudo cargar Google"));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export function GoogleButton({ onCredential }: { onCredential: (credential: string) => void }) {
  const caja = useRef<HTMLDivElement>(null);
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
        // Mismo ancho que el formulario (Google acepta entre 200 y 400 px).
        const ancho = Math.round(caja.current!.getBoundingClientRect().width) || 280;
        window.google.accounts.id.renderButton(caja.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          locale: "es",
          width: Math.min(400, Math.max(200, ancho)),
        });
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  if (!CLIENT_ID) return null;
  return <div className="yl-google" ref={caja} style={{ width: "100%" }} />;
}
