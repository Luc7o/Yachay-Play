import { useRef, useState } from "react";
import { Marca, BotonTema, Icono } from "../campusUi";
import "./joinHub.css";
import { Button } from "../ui";

// ============================================================================
// ¿A QUÉ TE QUIERES UNIR? — para invitados y estudiantes
// ============================================================================
// Cada actividad en vivo tiene sus propios códigos, así que antes de pedir el
// código se elige a cuál se entra. Aquí se escribe el nombre una sola vez: pasa
// a la pantalla de unirse de la actividad elegida ya escrito.
//
// Para agregar una actividad nueva: añádela a OPCIONES y maneja su id en
// unirseA() de App.jsx.
// ============================================================================
const OPCIONES = [
  {
    id: "ludo",
    icono: Icono.ludo,
    nombre: "Ludo por equipos",
    desc: "Avanza por el tablero con tu equipo respondiendo preguntas.",
  },
  {
    id: "crucigrama",
    icono: Icono.crucigrama,
    nombre: "Crucigrama relámpago",
    desc: "Compite contra el reloj y contra tus compañeros.",
  },
  {
    id: "palabra",
    icono: Icono.palabra,
    nombre: "Palabra relámpago",
    desc: "Juega con tus compañeros: cada quien desde su dispositivo, con turnos y vidas.",
  },
  {
    id: "estudio",
    icono: Icono.estudio,
    nombre: "Presentación en vivo",
    desc: "Entra a la sala donde creas tu presentación, solo o en equipo.",
  },
  {
    id: "evaluacion",
    icono: Icono.evaluacion,
    nombre: "Evaluación rápida",
    desc: "Responde preguntas con tiempo y ranking en vivo.",
  },
];

export function JoinHub({ user, initialCode = "", initialName = "", onPick, onBack }) {
  const [name, setName] = useState(initialName || user?.name || "");
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const code = String(initialCode || "")
    .replace(/\D/g, "")
    .slice(0, 6);
  const sinNombre = name.trim().length === 0;

  function elegir(id) {
    const n = name.trim();
    if (!n) {
      setError("Escribe tu nombre para continuar.");
      nameRef.current?.focus();
      return;
    }
    onPick(id, { code, name: n });
  }

  const contenido = (
    <section className="jh-card" aria-labelledby="jh-t">
      <div>
        <span className="cp-eyebrow">Unirme con código</span>
        <h1 id="jh-t">¿A qué te quieres unir?</h1>
        <p className="jh-lead">
          Cada actividad tiene su propio código. Escribe tu nombre y elige la que te pidió tu docente.
        </p>
        {code && (
          <p className="jh-code">
            Código: <strong>{code}</strong>
          </p>
        )}
      </div>

      <div className="cp-field">
        <label htmlFor="jh-name">Tu nombre</label>
        <input
          id="jh-name"
          ref={nameRef}
          className="cp-input"
          value={name}
          maxLength={30}
          autoComplete="name"
          placeholder="Ej. Andrea"
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
        />
        {error && (
          <p className="cp-msg error" role="alert">
            {error}
          </p>
        )}
      </div>

      <div>
        <span className="jh-label" id="jh-lista">
          Elige a qué te unes
        </span>
        <ul className="jh-list" aria-labelledby="jh-lista">
          {OPCIONES.map((o) => {
            const Ico = o.icono;
            return (
              <li key={o.id}>
                <button type="button" className="jh-opt" aria-disabled={sinNombre} onClick={() => elegir(o.id)}>
                  <span className="jh-ico">
                    <Ico />
                  </span>
                  <span className="jh-txt">
                    <strong>{o.nombre}</strong>
                    <small>{o.desc}</small>
                  </span>
                  <span className="jh-arrow" aria-hidden="true">
                    →
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );

  // Con sesión, el menú lateral ya está puesto por AppShell: solo va el contenido.
  if (user) return <div className="jh-wrap">{contenido}</div>;

  // Invitado: pantalla propia con el logo arriba.
  return (
    <div className="cp stu-page">
      <header className="stu-top">
        <Marca onClick={onBack} label="Volver al inicio de YachayPlay" />
        <div className="stu-top-right">
          <BotonTema />
          <Button variant="quiet" onClick={onBack}>
            ← Volver
          </Button>
        </div>
      </header>
      <main className="stu-main">{contenido}</main>
    </div>
  );
}
