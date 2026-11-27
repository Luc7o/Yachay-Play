import React from "react";
import { PublicAulaHeader } from "./PublicAulaHeader";
import { AppShell } from "./AppShell";
import { Icono, Marca } from "./campusUi";
import { api } from "./api";
import { Tile } from "./ui";

// ============================================================================
// PORTADA PÚBLICA E INICIO CON SESIÓN — diseño "Campus" (ver campus.css)
// ============================================================================
// Para agregar un juego: añádelo a JUEGOS (ok: true si ya se puede jugar).
// Para agregar una herramienta del docente: añádela a HERRAMIENTAS.
// ============================================================================

export const JUEGOS = [
  {
    id: "ludo",
    icono: Icono.ludo,
    nombre: "Ludo por equipos",
    desc: "Responde para avanzar. Gana el equipo que llega primero a la meta.",
    ok: true,
    docente: "Crear partida",
  },
  {
    id: "crucigrama",
    icono: Icono.crucigrama,
    nombre: "Crucigrama relámpago",
    desc: "Cada estudiante resuelve contra el reloj y puede frenar a sus rivales.",
    ok: true,
    docente: "Crear crucigrama",
  },
  {
    id: "palabra",
    icono: Icono.palabra,
    nombre: "Palabra relámpago",
    desc: "Forma palabras con las letras indicadas antes de que acabe tu turno.",
    ok: true,
    docente: "Abrir juego",
  },
  {
    id: "evaluacion",
    icono: Icono.evaluacion,
    nombre: "Evaluación rápida",
    desc: "Preguntas con tiempo y ranking en vivo para cerrar un tema.",
    ok: true,
    docente: "Crear evaluación",
    estudiante: "Unirme con código",
  },
  {
    id: "estudio",
    icono: Icono.estudio,
    nombre: "Presentaciones en vivo",
    desc: "Los estudiantes crean su presentación, solos o en equipo, y el docente la ve en vivo.",
    ok: true,
    docente: "Crear sala",
    estudiante: "Unirme con código",
  },
];
const PROXIMAMENTE = ["Quiz", "Sí o No", "Sopa de letras", "Memoria", "Ordenar frases"];

const HERRAMIENTAS = [
  {
    id: "cronometro",
    icono: Icono.cronometro,
    nombre: "Cronómetro",
    desc: "Controla el tiempo de ejercicios y dinámicas; sigue visible en una ventanita.",
  },
  {
    id: "ruleta",
    icono: Icono.ruleta,
    nombre: "Ruleta de sorteos",
    desc: "Elige estudiantes o equipos al azar, frente a toda la clase.",
  },
  {
    id: "pizarra",
    icono: Icono.pizarra,
    nombre: "Pizarra digital",
    desc: "Explica con trazos, formas y texto, y descarga el resultado.",
  },
];

// Mini tablero de Ludo (lo usa la pantalla de elegir cómo entrar).
export function LudoIcon() {
  return (
    <svg viewBox="0 0 100 100" className="game-icon-svg" aria-hidden="true">
      <rect x="10" y="10" width="36" height="36" rx="8" fill="#ef4444" />
      <rect x="54" y="10" width="36" height="36" rx="8" fill="#10b981" />
      <rect x="54" y="54" width="36" height="36" rx="8" fill="#eab308" />
      <rect x="10" y="54" width="36" height="36" rx="8" fill="#3b82f6" />
      <circle cx="28" cy="28" r="9" fill="#fff" />
      <circle cx="72" cy="28" r="9" fill="#fff" />
      <circle cx="72" cy="72" r="9" fill="#fff" />
      <circle cx="28" cy="72" r="9" fill="#fff" />
      <rect x="42" y="42" width="16" height="16" rx="4" fill="#009F91" stroke="#fff" strokeWidth="3" />
    </svg>
  );
}

// Campo "¿Tienes un código?": solo dígitos, máximo 6.
function CampoCodigo({ id, onEntrar, etiqueta = "Código de la partida", boton = "Entrar", className = "" }) {
  const [codigo, setCodigo] = React.useState("");
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        onEntrar(codigo);
      }}
    >
      <label htmlFor={id}>{etiqueta}</label>
      <div className="cp-join">
        <input
          id={id}
          className="cp-input code"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000000"
          value={codigo}
          maxLength={6}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
        <button type="submit" className="cp-btn ghost">
          {boton}
        </button>
      </div>
    </form>
  );
}

const NOMBRE_TIPO = {
  ludo: "Ludo",
  crucigrama: "Crucigrama",
  palabra: "Palabra relámpago",
  evaluacion: "Evaluación",
  estudio: "Presentaciones",
};

// Resumen de "Mis clases" en el inicio: lo que está en vivo y las clases más recientes.
// Si falla la petición (p. ej. backend sin la migración de clases), simplemente no se muestra.
function ResumenClases({ esDocente, onNavigate, onOpenClass, onEnterActivity }) {
  const [clases, setClases] = React.useState(null);
  React.useEffect(() => {
    let vivo = true;
    const cargar = () =>
      api
        .classes()
        .then((r) => vivo && setClases(r.classes))
        .catch(() => vivo && setClases((c) => c || []));
    cargar();
    const t = setInterval(() => document.visibilityState === "visible" && cargar(), 20000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);
  if (clases === null) return null;

  const enVivo = clases.flatMap((c) => c.live.map((a) => ({ ...a, clase: c })));
  return (
    <>
      {enVivo.map((a) => (
        <section className="cp-band cp-band-live" key={a.kind + a.code} aria-label="Actividad en vivo">
          <div>
            <span className="cp-live">{esDocente ? "En vivo ahora" : "Partida en curso en una de tus clases"}</span>
            <h3>
              {NOMBRE_TIPO[a.kind] || a.kind} · {a.name}
            </h3>
            <p>
              {a.clase.name} · código <b className="cp-code-inline">{a.code}</b> · {a.players}{" "}
              {a.players === 1 ? "conectado" : "conectados"}
            </p>
          </div>
          {esDocente ? (
            <button type="button" className="cp-btn primary" onClick={() => onOpenClass?.(a.clase.id)}>
              Ver clase
            </button>
          ) : (
            <button type="button" className="cp-btn primary" onClick={() => onEnterActivity?.(a)}>
              Entrar a la partida
            </button>
          )}
        </section>
      ))}

      <section aria-labelledby="cp-hc-t">
        <div className="cp-sec-row">
          <h2 id="cp-hc-t" className="cp-sec-title">
            Mis clases
          </h2>
          {clases.length > 0 && (
            <button type="button" className="cp-btn quiet sm" onClick={() => onNavigate("clases")}>
              Ver todas
            </button>
          )}
        </div>
        {clases.length === 0 ? (
          <div className="cp-card cp-panel">
            <p>
              {esDocente
                ? "Crea una clase por curso y sección: tus estudiantes se inscriben con su código y las actividades quedan guardadas en ella."
                : "Pide a tu docente el código de su clase para ver aquí sus actividades en vivo."}
            </p>
            <div>
              <button type="button" className="cp-btn ghost" onClick={() => onNavigate("clases")}>
                {esDocente ? "Crear mi primera clase" : "Unirme a una clase"}
              </button>
            </div>
          </div>
        ) : (
          <div className="cp-tiles">
            {clases.slice(0, 3).map((c) => (
              <button
                type="button"
                key={c.id}
                className={"cp-tile" + (c.live.length ? " is-live" : "")}
                onClick={() => onOpenClass?.(c.id)}
              >
                <span className="cp-tile-top">
                  <span className="cp-chip accent">{c.section || "Clase"}</span>
                  {c.live.length > 0 && <span className="cp-live">En vivo</span>}
                </span>
                <strong>{c.name}</strong>
                <p>
                  {esDocente
                    ? `${c.members} ${c.members === 1 ? "estudiante" : "estudiantes"} · ${c.activities} ${c.activities === 1 ? "actividad" : "actividades"}`
                    : `Prof. ${c.teacher}`}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

// ============================================================================
// INICIO CON SESIÓN. `section` (inicio | juegos | herramientas) la maneja App.jsx.
// ============================================================================
function HomeLogged({
  onSelectGame,
  onJoinWithCode,
  buildVersion,
  user,
  onLogout,
  onNavigate,
  onOpenClass,
  onEnterActivity,
  section = "inicio",
}) {
  const resumen = (
    <ResumenClases
      esDocente={user.role === "docente"}
      onNavigate={onNavigate}
      onOpenClass={onOpenClass}
      onEnterActivity={onEnterActivity}
    />
  );
  const esDocente = user.role === "docente";
  const primerNombre = user.name.trim().split(/\s+/)[0];
  const seccion = section === "herramientas" && !esDocente ? "inicio" : section;
  const activo = seccion === "inicio" ? "home" : seccion;

  const tilesJuegos = JUEGOS.map((g) => (
    <Tile
      key={g.id}
      tono={g.id}
      icon={g.icono}
      title={g.nombre}
      desc={g.desc}
      cta={esDocente ? g.docente : g.estudiante || "Ver cómo se juega"}
      onClick={() => onSelectGame(g.id)}
    />
  ));

  const vistas = {
    inicio: esDocente ? (
      <div className="cp cp-home">
        <div className="cp-pagehead">
          <div>
            <span className="cp-eyebrow">Hola, {primerNombre}</span>
            <h1>¿Qué hacemos hoy en clase?</h1>
          </div>
        </div>

        {resumen}

        <section className="cp-band" aria-labelledby="cp-band-t">
          <div>
            <h2 id="cp-band-t">Lanza una actividad en vivo</h2>
            <p>Elige un juego, proyecta el código y tus estudiantes entran desde el celular, sin instalar nada.</p>
          </div>
          <button type="button" className="cp-btn primary" onClick={() => onSelectGame("ludo")}>
            Crear partida de Ludo
          </button>
        </section>

        <section aria-labelledby="cp-act-t">
          <h2 id="cp-act-t" className="cp-sec-title">
            Actividades
          </h2>
          <div className="cp-tiles">{tilesJuegos.slice(0, 3)}</div>
        </section>

        <section aria-labelledby="cp-tools-t">
          <h2 id="cp-tools-t" className="cp-sec-title">
            Herramientas de aula
          </h2>
          <div className="cp-tiles">
            {HERRAMIENTAS.map((t) => (
              <Tile
                key={t.id}
                tono={t.id}
                icon={t.icono}
                title={t.nombre}
                desc={t.desc}
                cta="Abrir"
                onClick={() => onSelectGame(t.id)}
              />
            ))}
          </div>
        </section>

        <div className="cp-split">
          <section className="cp-card cp-panel">
            <h2>Estadísticas</h2>
            <p>Mira quién participó, quién ganó y qué preguntas se fallan más en tus partidas.</p>
            <div>
              <button type="button" className="cp-btn ghost" onClick={() => onNavigate("stats")}>
                Ver estadísticas
              </button>
            </div>
          </section>
          <section className="cp-card cp-panel">
            <h2>Banco de preguntas</h2>
            <p>Prepara tus preguntas por tema y nivel; tus partidas las usan junto con las oficiales.</p>
            <div>
              <button type="button" className="cp-btn ghost" onClick={() => onNavigate("questions")}>
                Abrir mis preguntas
              </button>
            </div>
          </section>
        </div>
      </div>
    ) : (
      <div className="cp cp-home">
        <div className="cp-pagehead">
          <div>
            <span className="cp-eyebrow">Hola, {primerNombre}</span>
            <h1>Entra a tu partida</h1>
            <p>
              Escribe el código que muestra tu docente. Con tu cuenta, cada partida queda en tu historial y suma al
              ranking.
            </p>
          </div>
        </div>

        {resumen}

        <div className="cp-split">
          <section className="cp-band" aria-labelledby="cp-join-t" style={{ flexBasis: "420px" }}>
            <div>
              <h2 id="cp-join-t">Unirme con código</h2>
              <p>Ludo por equipos. Para el crucigrama, la evaluación o las presentaciones, entra desde su tarjeta.</p>
            </div>
            <CampoCodigo
              id="cp-home-code"
              etiqueta="Código de la partida"
              onEntrar={(c) => onJoinWithCode?.(c)}
              boton="Unirme"
              className="cp-band-form"
            />
          </section>
          <section className="cp-card cp-panel">
            <h2>Mis resultados</h2>
            <p>Tus partidas, tus aciertos y tu posición en el ranking de estudiantes.</p>
            <div className="cp-join">
              <button type="button" className="cp-btn ghost" onClick={() => onNavigate("stats")}>
                Ver resultados
              </button>
              <button type="button" className="cp-btn quiet" onClick={() => onNavigate("profile")}>
                Mi perfil
              </button>
            </div>
          </section>
        </div>

        <section aria-labelledby="cp-jg-t">
          <h2 id="cp-jg-t" className="cp-sec-title">
            Juegos
          </h2>
          <div className="cp-tiles">{tilesJuegos}</div>
        </section>
      </div>
    ),

    juegos: (
      <div className="cp cp-home">
        <div className="cp-pagehead">
          <div>
            <span className="cp-eyebrow">Juegos</span>
            <h1>Actividades para la clase</h1>
            <p>
              {esDocente
                ? "Elige una actividad para crear la partida y compartir el código."
                : "Elige un juego para ver cómo se juega o unirte con el código de tu docente."}
            </p>
          </div>
        </div>
        <div className="cp-tiles">
          {tilesJuegos}
          {PROXIMAMENTE.map((n) => (
            <Tile key={n} title={n} desc="Próximamente." disabled extra={<span className="cp-chip">Pronto</span>} />
          ))}
        </div>
      </div>
    ),

    herramientas: (
      <div className="cp cp-home">
        <div className="cp-pagehead">
          <div>
            <span className="cp-eyebrow">Herramientas</span>
            <h1>Herramientas para dictar tu clase</h1>
            <p>Úsalas mientras proyectas: no necesitan que los estudiantes tengan cuenta.</p>
          </div>
        </div>
        <div className="cp-tiles">
          {HERRAMIENTAS.map((t) => (
            <Tile
              key={t.id}
              tono={t.id}
              icon={t.icono}
              title={t.nombre}
              desc={t.desc}
              cta="Abrir"
              onClick={() => onSelectGame(t.id)}
            />
          ))}
          {JUEGOS.filter((g) => g.id === "evaluacion" || g.id === "estudio").map((g) => (
            <Tile
              key={g.id}
              tono={g.id}
              icon={g.icono}
              title={g.nombre}
              desc={g.desc}
              cta={g.docente}
              onClick={() => onSelectGame(g.id)}
            />
          ))}
        </div>
      </div>
    ),
  };

  return (
    <AppShell user={user} active={activo} onNavigate={onNavigate} onLogout={onLogout} buildVersion={buildVersion}>
      {vistas[seccion] || vistas.inicio}
    </AppShell>
  );
}

// ============================================================================
// PORTADA PÚBLICA
// ============================================================================
const SECCIONES = ["inicio", "como-funciona", "docentes", "estudiantes", "juegos"];

function Landing({ onSelectGame, onJoinWithCode, buildVersion, onLogin, onRegister }) {
  const leerHash = () => {
    const raw = window.location.hash.replace(/^#\/?/, "").split("?")[0];
    return SECCIONES.includes(raw) ? raw : "inicio";
  };
  const [activa, setActiva] = React.useState(leerHash);

  // Los enlaces de la cabecera (#/juegos...) desplazan hasta su sección.
  React.useEffect(() => {
    const ir = () => {
      const id = leerHash();
      setActiva(id);
      if (id === "inicio") window.scrollTo({ top: 0 });
      else document.getElementById(`cp-${id}`)?.scrollIntoView({ block: "start" });
    };
    ir();
    window.addEventListener("hashchange", ir);
    return () => window.removeEventListener("hashchange", ir);
  }, []);

  const Check = Icono.check;

  return (
    <div className="cp cp-landing">
      <PublicAulaHeader activePage={activa === "inicio" ? null : activa} onLogin={onLogin} onRegister={onRegister} />
      <main>
        {/* ---------- Hero ---------- */}
        <section className="cp-wrap cp-hero" aria-labelledby="cp-hero-t">
          <div className="cp-hero-copy">
            <span className="cp-eyebrow accent" style={{ alignSelf: "flex-start" }}>
              Para clases universitarias
            </span>
            <h1 id="cp-hero-t">Tus clases, con la energía de una partida.</h1>
            <p className="cp-hero-lead">
              El docente lanza actividades en vivo y dicta con sus herramientas de aula. Los estudiantes entran desde el
              celular con un código y aprenden compitiendo, sin instalar nada.
            </p>
            <div className="cp-hero-actions">
              <button type="button" className="cp-btn primary lg" onClick={onRegister}>
                Soy docente
              </button>
              <button type="button" className="cp-btn ghost lg" onClick={onLogin}>
                Soy estudiante
              </button>
            </div>
            <CampoCodigo
              id="cp-hero-code"
              etiqueta="¿Tienes un código de partida?"
              onEntrar={(c) => onJoinWithCode?.(c)}
              className="cp-hero-join"
            />
          </div>

          {/* Muestra del producto (ilustrativa) */}
          <div className="cp-hero-art" aria-hidden="true">
            <img className="cp-condor cp-hero-condor" src="/condor-512.png" alt="" width="512" height="512" />
            <div className="cp-card cp-demo">
              <div className="cp-demo-head">
                <div>
                  <span className="cp-muted" style={{ fontSize: 12 }}>
                    Ejemplo de sesión en vivo
                  </span>
                  <strong>Cálculo Diferencial</strong>
                </div>
                <span className="cp-live">En vivo</span>
              </div>
              <div className="cp-demo-meta">
                <div>
                  Actividad<strong>Crucigrama</strong>
                </div>
                <div>
                  Código<strong className="code">482 913</strong>
                </div>
                <div>
                  Duración<strong>8 min</strong>
                </div>
              </div>
              <div className="cp-rank">
                <span className="cp-eyebrow">Marcador</span>
                <div className="cp-rank-row">
                  <span>1</span>
                  <span>Valeria</span>
                  <span className="bar">
                    <i style={{ width: "92%" }} />
                  </span>
                  <b>920</b>
                </div>
                <div className="cp-rank-row">
                  <span>2</span>
                  <span>Diego</span>
                  <span className="bar">
                    <i style={{ width: "78%" }} />
                  </span>
                  <b>780</b>
                </div>
                <div className="cp-rank-row">
                  <span>3</span>
                  <span>Camila</span>
                  <span className="bar">
                    <i style={{ width: "64%" }} />
                  </span>
                  <b>640</b>
                </div>
              </div>
            </div>
            <div className="cp-demo-row">
              <div className="cp-demo-q">
                <span>Pregunta 4 de 10</span>
                <strong>¿Cuál es la derivada de sen(x) · x²?</strong>
                <span className="bar">
                  <i />
                </span>
              </div>
              <div className="cp-card cp-demo-tools">
                <span className="cp-muted" style={{ fontSize: 12 }}>
                  Herramientas de aula
                </span>
                <ul>
                  <li className="cp-chip">Cronómetro</li>
                  <li className="cp-chip">Ruleta</li>
                  <li className="cp-chip">Pizarra</li>
                  <li className="cp-chip">Presentaciones</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Cómo funciona ---------- */}
        <section id="cp-como-funciona" className="cp-section alt" aria-labelledby="cp-como-t">
          <div className="cp-wrap">
            <div className="cp-section-head">
              <h2 id="cp-como-t">Tres pasos, de la clase a la partida.</h2>
              <p>Todo pasa en el navegador: el docente proyecta y el estudiante juega desde su celular.</p>
            </div>
            <div className="cp-grid cp-grid-3">
              <div className="cp-card cp-step">
                <span>01</span>
                <strong>Prepara tu actividad</strong>
                <p>Elige un juego o una evaluación y usa las preguntas oficiales o las de tu propio banco.</p>
              </div>
              <div className="cp-card cp-step">
                <span>02</span>
                <strong>Comparte el código</strong>
                <p>Proyecta el código de seis dígitos: la clase entra desde el celular o la laptop.</p>
              </div>
              <div className="cp-card cp-step">
                <span>03</span>
                <strong>Revisa qué se aprendió</strong>
                <p>Mira quién participó y qué preguntas se fallan más, para reforzar en la siguiente sesión.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Docentes / estudiantes ---------- */}
        <section className="cp-section" aria-label="Para docentes y estudiantes">
          <div className="cp-wrap cp-audience">
            <div id="cp-docentes" className="cp-card cp-aud">
              <span className="cp-eyebrow">Para docentes</span>
              <h3>Todo lo que necesitas para dictar, en un solo lugar.</h3>
              <ul>
                <li>
                  <Check />
                  Juegos y evaluaciones en vivo con tus propias preguntas
                </li>
                <li>
                  <Check />
                  Herramientas de aula: cronómetro, ruleta, pizarra y presentaciones
                </li>
                <li>
                  <Check />
                  Asistente con IA para preparar preguntas y dinámicas
                </li>
                <li>
                  <Check />
                  Estadísticas de tus partidas y de cada pregunta
                </li>
              </ul>
              <div>
                <button type="button" className="cp-btn primary" onClick={onRegister}>
                  Crear cuenta de docente
                </button>
              </div>
            </div>
            <div id="cp-estudiantes" className="cp-aud dark">
              <span className="cp-eyebrow">Para estudiantes</span>
              <h3>Entra a la partida desde el celular.</h3>
              <ul>
                <li>
                  <Check />
                  Únete con un código, sin instalar ninguna app
                </li>
                <li>
                  <Check />
                  Compite solo o con tu equipo en tiempo real
                </li>
                <li>
                  <Check />
                  Tu historial, tus aciertos y tu posición en el ranking
                </li>
              </ul>
              <div>
                <button type="button" className="cp-btn primary" onClick={() => onJoinWithCode?.("")}>
                  Unirme a una partida
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Juegos ---------- */}
        <section id="cp-juegos" className="cp-section alt" aria-labelledby="cp-juegos-t">
          <div className="cp-wrap">
            <div className="cp-section-head">
              <h2 id="cp-juegos-t">Actividades para la clase</h2>
              <p>Más actividades en camino: {PROXIMAMENTE.slice(0, 3).join(", ").toLowerCase()} y otras.</p>
            </div>
            <div className="cp-grid cp-grid-4">
              {JUEGOS.slice(0, 4).map((g) => (
                <div className={`cp-card cp-game tono-${g.id}`} key={g.id}>
                  <span className="cp-ico">
                    <g.icono />
                  </span>
                  <strong>{g.nombre}</strong>
                  <p>{g.desc}</p>
                  <button type="button" className="cp-btn ghost" onClick={() => onSelectGame(g.id)}>
                    Ver juego
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Llamado final ---------- */}
        <section className="cp-section">
          <div className="cp-wrap">
            <div className="cp-cta">
              <div>
                <h2>Prepara tu próxima clase en minutos.</h2>
                <p>Crea tu cuenta de docente y lanza tu primera actividad hoy.</p>
              </div>
              <button type="button" className="cp-btn lg" onClick={onRegister}>
                Crear cuenta gratis
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="cp-foot">
        <div className="cp-wrap">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            <Marca />{" "}
            <span>
              © {new Date().getFullYear()}
              {buildVersion ? ` · Build ${buildVersion}` : ""}
            </span>
          </span>
          <nav aria-label="Información legal y acceso">
            <button type="button" onClick={onLogin}>
              Iniciar sesión
            </button>
            <a href="/politica-de-privacidad.html" target="_blank" rel="noopener noreferrer">
              Política de privacidad
            </a>
            <a href="/terminos-y-condiciones.html" target="_blank" rel="noopener noreferrer">
              Términos y condiciones
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function GameCatalog(props) {
  return props.user ? <HomeLogged {...props} /> : <Landing {...props} />;
}
