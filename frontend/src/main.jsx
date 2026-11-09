import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { AssistantFab } from "./AssistantFab";
import { CronometroMini } from "./CronometroMini";
import "./gamesDark.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      {/* Fuera de <App/> a propósito: se muestra en CUALQUIER pantalla donde
          haya sesión de docente (catálogo, Ludo, Crucigrama), sin tener que
          tocar el enrutamiento interno de ninguno de los dos juegos. */}
      <AssistantFab />
      {/* Ventanita del cronómetro: sale en cualquier pantalla mientras el conteo sigue en marcha. */}
      <CronometroMini />
    </ErrorBoundary>
  </React.StrictMode>
);
