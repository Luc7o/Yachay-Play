import React, { Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./ui/tokens.css"; // colores, tipografía y tonos: la única fuente (va primero)
import "./styles.css";
import "./estilos"; // TODOS los CSS en su orden de siempre (ver el comentario en estilos.js)
import App from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { AssistantFab } from "./AssistantFab";
import { CronometroMini } from "./CronometroMini";
import { AvisoDestino } from "./clases/AvisoDestino";
import "./gamesDark.css";
import "./aulaFinal.css";
import "./campus.css"; // diseño "Campus": va el ÚLTIMO para ganar sobre los estilos antiguos
import "./campusJuegos.css"; // diseño "Campus" para juegos y herramientas (después de campus.css)
import "./ui/dispositivos.css"; // celular y proyector (va al final)
import "./theme.js";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* Mientras llega el código de una pantalla que se carga bajo demanda. */}
      <Suspense
        fallback={
          <div className="app-cargando" role="status" aria-live="polite">
            Cargando…
          </div>
        }
      >
        <App />
      </Suspense>
      {/* Fuera de <App/> a propósito: se muestra en CUALQUIER pantalla donde
          haya sesión de docente (catálogo, Ludo, Crucigrama), sin tener que
          tocar el enrutamiento interno de ninguno de los dos juegos. */}
      <AssistantFab />
      {/* Ventanita del cronómetro: sale en cualquier pantalla mientras el conteo sigue en marcha. */}
      <CronometroMini />
      {/* "Esta actividad quedará en la clase X" mientras el docente prepara una actividad desde una clase. */}
      <AvisoDestino />
    </ErrorBoundary>
  </React.StrictMode>,
);
