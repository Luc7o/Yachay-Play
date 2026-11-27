import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BASE_COUNT,
  checkWord,
  candidateFragments,
  loadExtraWords,
  normalizeWord,
  saveExtraWords,
} from "./palabraDiccionario";
import { PalabraSolo } from "./palabra/PalabraSolo";
import { OnlineRoom, OnlineSetup } from "./palabra/PalabraOnline";
import "./palabraRelampago.css";

const COLORS = ["#17c7b5", "#4388ff", "#b18aff", "#ffc15d", "#f383a6", "#6ac9de", "#a4d75c", "#e1a7ff"];
const DEFAULT_TEAMS = "Equipo Menta, Equipo Azul, Equipo Violeta";
const parseNames = (value) =>
  [
    ...new Set(
      value
        .split(/[,\n]/)
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ].slice(0, 8);
const POSITIONS = (i, length) => {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / length;
  return { left: `${50 + 43 * Math.cos(angle)}%`, top: `${50 + 43 * Math.sin(angle)}%` };
};

// Modalidades:
//   individual -> una persona contra el reloj, 3 vidas (palabra/PalabraSolo.jsx)
//   team       -> equipos en UN mismo dispositivo, el docente proyecta (este archivo)
//   online     -> cada quien en su dispositivo, estudiantes o docente (palabra/PalabraOnline.jsx)
// Agregar palabras al diccionario es SOLO para docentes; los estudiantes usan el diccionario base.
export function PalabraRelampago({ goHome, frame, user = null, initialCode = "", initialName = "" }) {
  const canEditDictionary = user?.role === "docente";
  const [mode, setMode] = useState(initialCode ? "online" : "individual");
  const [screen, setScreen] = useState("setup"); // setup | solo | online
  const [soloName, setSoloName] = useState(initialName || user?.name || "");
  const [online, setOnline] = useState(null); // { code, name, host, hostPlays }
  const [names, setNames] = useState(DEFAULT_TEAMS);
  const [seconds, setSeconds] = useState(20);
  const [maxRounds, setMaxRounds] = useState(20);
  const [players, setPlayers] = useState([]);
  const [phase, setPhase] = useState("setup");
  const [turn, setTurn] = useState(0);
  const [round, setRound] = useState(1);
  const [remain, setRemain] = useState(20);
  const [fragment, setFragment] = useState("sa");
  const [used, setUsed] = useState([]);
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [extraWords, setExtraWords] = useState(() => (canEditDictionary ? loadExtraWords() : []));
  const [vocabularyText, setVocabularyText] = useState("");
  const [vocabularyStatus, setVocabularyStatus] = useState("");
  const [showVocabulary, setShowVocabulary] = useState(false);
  const [pending, setPending] = useState(false);
  const [uiTheme, setUiTheme] = useState(() => document.documentElement.dataset.theme || "dark");
  const toggleUiTheme = () => {
    const next = uiTheme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem("yp_theme", next);
    } catch {
      /* Almacenamiento opcional */
    }
    setUiTheme(next);
  };
  // Sigue el tema de <html>: dentro del panel lo cambia el botón del menú lateral, no uno propio.
  useEffect(() => {
    const raiz = document.documentElement;
    const obs = new MutationObserver(() => setUiTheme(raiz.dataset.theme || "dark"));
    obs.observe(raiz, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    const nombre = (initialName || user?.name || "").trim();
    if (initialCode && nombre) {
      setOnline({ code: initialCode, name: nombre, host: false, hostPlays: true });
      setScreen("online");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const startSolo = () => {
    if (!soloName.trim()) {
      setMessage("Escribe tu nombre para empezar.");
      return;
    }
    setMessage("");
    setScreen("solo");
  };
  const inputRef = useRef(null);
  const lockRef = useRef(false);
  const transitionRef = useRef(null);
  const usedRef = useRef([]);
  const playersRef = useRef([]);
  const turnRef = useRef(0);
  const fragmentRef = useRef("sa");
  const roundsRef = useRef(1);
  const timeRef = useRef(20);
  const extraSet = useMemo(() => new Set(extraWords), [extraWords]);
  const active = players[turn];
  const sorted = useMemo(() => [...players].sort((a, b) => b.score - a.score || b.lives - a.lives), [players]);
  const winner = sorted[0];
  // Resaltar el fragmento requerido en cualquier posición de la palabra escrita.
  const normalizedAnswer = normalizeWord(answer);
  const fragmentPosition = normalizedAnswer.indexOf(normalizeWord(fragment));
  const timerProgress = Math.max(0, Math.min(1, seconds ? remain / seconds : 0));
  const timerCircumference = 2 * Math.PI * 44;
  const timerOffset = timerCircumference * (1 - timerProgress);
  useEffect(
    () => () => {
      window.clearTimeout(transitionRef.current);
    },
    [],
  );
  const resetTimer = (nextFragment) => {
    fragmentRef.current = nextFragment;
    timeRef.current = seconds;
    setFragment(nextFragment);
    setRemain(seconds);
    setAnswer("");
    setMessage("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };
  const chooseFragment = (avoid) => {
    const choices = candidateFragments(usedRef.current, extraSet).filter((x) => x !== avoid);
    return choices[Math.floor(Math.random() * choices.length)] || "sa";
  };
  const start = () => {
    const entries = parseNames(names);
    if (entries.length < 2) {
      setMessage("Necesitas al menos 2 participantes separados por comas.");
      return;
    }
    const data = entries.map((name, id) => ({ id, name, score: 0, lives: 3, color: COLORS[id % COLORS.length] }));
    playersRef.current = data;
    usedRef.current = [];
    turnRef.current = 0;
    roundsRef.current = 1;
    lockRef.current = false;
    setPlayers(data);
    setUsed([]);
    setTurn(0);
    setRound(1);
    setPending(false);
    setPhase("playing");
    resetTimer("sa");
  };
  const finishTurn = (points, word = "", note = "") => {
    if (lockRef.current) return;
    lockRef.current = true;
    setPending(true);
    const current = turnRef.current;
    const updated = playersRef.current.map((p, i) =>
      i !== current ? p : { ...p, score: p.score + points, lives: Math.max(0, p.lives - (points ? 0 : 1)) },
    );
    playersRef.current = updated;
    setPlayers(updated);
    if (word) {
      usedRef.current = [...usedRef.current, normalizeWord(word)];
      setUsed([...usedRef.current]);
    }
    setMessage(note || (points ? `¡Correcto! +${points} puntos · ${word}` : "¡Se acabó el tiempo! Pierdes una vida."));
    const survivors = updated.filter((p) => p.lives > 0);
    const nextRound = roundsRef.current + 1;
    transitionRef.current = window.setTimeout(() => {
      if (survivors.length < 2 || nextRound > maxRounds) {
        setPhase("finished");
        return;
      }
      roundsRef.current = nextRound;
      setRound(nextRound);
      const next = Array.from({ length: updated.length }, (_, i) => (current + i + 1) % updated.length).find(
        (i) => updated[i].lives > 0,
      );
      turnRef.current = next;
      setTurn(next);
      lockRef.current = false;
      setPending(false);
      resetTimer(chooseFragment(fragmentRef.current));
    }, 1200);
  };
  useEffect(() => {
    if (phase !== "playing" || pending) return undefined;
    const interval = window.setInterval(() => {
      timeRef.current = Math.max(0, timeRef.current - 1);
      setRemain(timeRef.current);
      if (timeRef.current === 0) {
        window.clearInterval(interval);
        finishTurn(0);
      }
    }, 1000);
    return () => window.clearInterval(interval);
    // Timer restarts only at the beginning of the next round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round, pending]);
  const submit = (e) => {
    e.preventDefault();
    if (phase !== "playing" || lockRef.current) return;
    const reason = checkWord(answer, fragmentRef.current, usedRef.current, extraSet);
    if (reason) {
      setMessage(reason);
      return;
    }
    finishTurn(10 + timeRef.current, answer.trim());
  };
  const importWords = async (file) => {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setVocabularyStatus("El archivo es demasiado grande (máximo 1 MB).");
      return;
    }
    const text = await file.text();
    addWords(text);
  };
  const addWords = (text) => {
    const incoming = text
      .split(/[\s,;]+/u)
      .map(normalizeWord)
      .filter((x) => /^[a-zñü]{4,35}$/u.test(x));
    const merged = [...new Set([...extraWords, ...incoming])].slice(0, 50000);
    try {
      saveExtraWords(merged);
      setExtraWords(merged);
      setVocabularyStatus(`${merged.length} palabras personalizadas disponibles en este navegador.`);
      setVocabularyText("");
    } catch {
      setVocabularyStatus("No se pudo guardar el diccionario en el navegador. Prueba con un archivo más pequeño.");
    }
  };
  const content = (
    <div className={`pr-page pr-fullscreen ${uiTheme === "dark" ? "pr-night" : "pr-day"}`}>
      <header className="pr-top">
        <div>
          <span className="pr-kicker">YACHAYPLAY · JUEGO DE PALABRAS</span>
          <h1>Palabra Relámpago</h1>
          <p>Encuentra las letras en cualquier parte de una palabra antes de que termine tu turno.</p>
        </div>
        <div className="pr-top-actions">
          {!frame && (
            <button
              type="button"
              className="pr-theme-switch"
              onClick={toggleUiTheme}
              aria-label={uiTheme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
              {uiTheme === "dark" ? "☀ Modo claro" : "☾ Modo oscuro"}
            </button>
          )}
          <button type="button" className="pr-back" onClick={goHome}>
            ← Volver a juegos
          </button>
        </div>
      </header>
      {phase === "setup" && (
        <section className="pr-panel pr-setup">
          <div className="pr-burst">
            CA <span>→</span> BO<strong>CA</strong>DO
          </div>
          <h2>Elige cómo jugar</h2>
          <p>
            Solo contra el reloj, por equipos en una misma pantalla, o en línea con tus compañeros, cada quien desde su
            dispositivo.
          </p>
          <div className="pr-mode" role="group" aria-label="Modalidad">
            <button
              type="button"
              className={mode === "individual" ? "chosen" : ""}
              onClick={() => {
                setMode("individual");
                setMessage("");
              }}
            >
              👤 Individual
            </button>
            <button
              type="button"
              className={mode === "team" ? "chosen" : ""}
              onClick={() => {
                setMode("team");
                setMessage("");
              }}
            >
              👥 Equipos (una pantalla)
            </button>
            <button
              type="button"
              className={mode === "online" ? "chosen" : ""}
              onClick={() => {
                setMode("online");
                setMessage("");
              }}
            >
              🌐 En línea
            </button>
          </div>
          {mode === "individual" && (
            <>
              <label>
                Tu nombre
                <input
                  className="pr-name-input"
                  value={soloName}
                  onChange={(e) => setSoloName(e.target.value)}
                  maxLength={30}
                  placeholder="Escribe tu nombre"
                  autoComplete="off"
                />
              </label>
              <p className="pr-small">
                Juegas solo contra el reloj con <strong>3 vidas</strong>. La partida dura hasta que te quedes sin vidas:
                cada palabra tiene un tiempo que se va acortando a medida que aciertas. Si se acaba el tiempo o cambias
                las letras pierdes una vida. +10 puntos y los segundos que sobren por acierto · Sin palabras repetidas.
              </p>
            </>
          )}
          {mode === "online" && (
            <OnlineSetup
              user={user}
              extraWords={extraWords}
              initialCode={initialCode}
              initialName={initialName}
              onEnter={(info) => {
                setOnline(info);
                setScreen("online");
              }}
            />
          )}
          {mode === "team" && (
            <>
              <label>
                Nombres de los equipos
                <textarea
                  value={names}
                  onChange={(e) => setNames(e.target.value)}
                  rows={2}
                  maxLength={250}
                  placeholder="Separa los nombres con comas"
                />
              </label>
              <div className="pr-config">
                <label>
                  Tiempo por turno
                  <select value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}>
                    <option value={15}>15 segundos</option>
                    <option value={20}>20 segundos</option>
                    <option value={30}>30 segundos</option>
                  </select>
                </label>
                <label>
                  Turnos máximos
                  <select value={maxRounds} onChange={(e) => setMaxRounds(Number(e.target.value))}>
                    <option value={12}>12 turnos</option>
                    <option value={20}>20 turnos</option>
                    <option value={32}>32 turnos</option>
                    <option value={48}>48 turnos</option>
                  </select>
                </label>
              </div>
              <p className="pr-small">
                3 vidas por participante · +10 puntos y tiempo restante por acierto · Sin palabras repetidas · Contiene
                las letras en cualquier posición. Todos juegan en esta misma pantalla.
              </p>
            </>
          )}
          {canEditDictionary ? (
            <button
              type="button"
              className="pr-dict-toggle"
              onClick={() => setShowVocabulary((v) => !v)}
              aria-expanded={showVocabulary}
            >
              📖 Diccionario: {BASE_COUNT.toLocaleString("es")} palabras base + {extraWords.length.toLocaleString("es")}{" "}
              personalizadas {showVocabulary ? "−" : "+"}
            </button>
          ) : (
            <p className="pr-small">
              📖 Diccionario: {BASE_COUNT.toLocaleString("es")} palabras. Solo los docentes pueden agregar palabras
              nuevas.
            </p>
          )}
          {canEditDictionary && showVocabulary && (
            <div className="pr-vocabulary">
              <p>
                Agrega palabras específicas para tu clase o importa un <strong>.txt UTF-8</strong> (una palabra por
                línea o separadas por espacios). Se guardan en este navegador. Revisa previamente los términos: se
                consideran válidos automáticamente.
              </p>
              <textarea
                rows={3}
                value={vocabularyText}
                onChange={(e) => setVocabularyText(e.target.value)}
                placeholder="biotecnología&#10;fotosíntesis&#10;ecosistema"
              />
              <div className="pr-vocabulary-actions">
                <button
                  className="pr-skip"
                  type="button"
                  onClick={() => addWords(vocabularyText)}
                  disabled={!vocabularyText.trim()}
                >
                  Añadir palabras
                </button>
                <label className="pr-import">
                  Importar .txt
                  <input
                    type="file"
                    accept=".txt,text/plain"
                    onChange={(e) => {
                      importWords(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {vocabularyStatus && <p role="status">{vocabularyStatus}</p>}
            </div>
          )}
          {message && (
            <div className="pr-alert" role="alert">
              {message}
            </div>
          )}
          {mode === "individual" && (
            <button className="pr-primary" onClick={startSolo}>
              Empezar contrarreloj ⚡
            </button>
          )}
          {mode === "team" && (
            <button className="pr-primary" onClick={start}>
              Entrar a la arena →
            </button>
          )}
        </section>
      )}
      {phase === "playing" && (
        <div className="pr-game pr-approved-game">
          <section className="pr-panel pr-board">
            <div className="pr-gamehead">
              <span>
                Ronda {round} de {maxRounds}
              </span>
              <strong>Turno: {active?.name}</strong>
            </div>
            <div
              className="pr-arena pr-approved-arena"
              aria-label="Arena de jugadores y turnos"
              onClick={() => {
                if (!pending) inputRef.current?.focus();
              }}
            >
              <div className="pr-arena-layout">
                <div className="pr-prompt" aria-label="Letras y respuesta del turno">
                  <div className="pr-fragment-badge">{fragment.toUpperCase()}</div>
                  <div className="pr-current-turn">{active?.name} · TU TURNO</div>
                  <form onSubmit={submit} className="pr-entry pr-entry-hud pr-tiled-entry">
                    <div className="pr-letter-track" aria-hidden="true">
                      {Array.from(answer).map((letter, index) => (
                        <span
                          key={index}
                          className={
                            "pr-letter-tile" +
                            (fragmentPosition !== -1 &&
                            index >= fragmentPosition &&
                            index < fragmentPosition + normalizeWord(fragment).length
                              ? " pr-letter-match"
                              : "")
                          }
                        >
                          {letter.toUpperCase()}
                        </span>
                      ))}
                    </div>
                    <input
                      ref={inputRef}
                      value={answer}
                      disabled={pending}
                      onChange={(e) => setAnswer(e.target.value)}
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      placeholder=""
                      aria-label="Escribe una palabra y pulsa Enter para enviarla"
                      maxLength={35}
                    />
                  </form>
                </div>
                <div className="pr-arena-stage">
                  <div className="pr-player-ring">
                    {players.map((p, i) => {
                      const pos = POSITIONS(i, players.length);
                      return (
                        <div
                          key={p.id}
                          className={"pr-avatar " + (i === turn ? "pr-active" : "") + (p.lives === 0 ? " pr-out" : "")}
                          style={{ left: pos.left, top: pos.top, "--player-color": p.color }}
                        >
                          <div className="pr-avatar-bubble">{p.name.slice(0, 2).toUpperCase()}</div>
                          <span className="pr-avatar-name">{p.name}</span>
                          <span className="pr-avatar-lives">
                            {"♥".repeat(p.lives)}
                            {"♡".repeat(3 - p.lives)}
                          </span>
                          <span className="pr-avatar-points">{p.score} pts</span>
                          {i === turn && <span className="pr-turn-tag">TU TURNO</span>}
                        </div>
                      );
                    })}
                    {active && (
                      <div
                        className="pr-pointer"
                        style={{ "--pointer-angle": `${-90 + turn * (360 / players.length)}deg` }}
                        aria-hidden="true"
                      >
                        <div className="pr-pointer-line">
                          <span>➤</span>
                        </div>
                      </div>
                    )}
                    <div className="pr-bomb-anchor" aria-label={`${remain} segundos restantes`}>
                      <div
                        className={
                          "pr-bomb-timer " +
                          (remain <= 5 ? "pr-bomb-timer-low" : "") +
                          (pending && remain === 0 ? " pr-bomb-exploding" : "") +
                          (remain === 0 && pending ? " pr-exploding" : "")
                        }
                        role="img"
                        aria-label={`Tiempo restante: ${remain} segundos`}
                      >
                        <svg viewBox="0 0 120 120" className="pr-bomb-ring" aria-hidden="true">
                          <circle className="pr-bomb-ring-track" cx="60" cy="60" r="44" />
                          <circle
                            className="pr-bomb-ring-progress"
                            cx="60"
                            cy="60"
                            r="44"
                            strokeDasharray={timerCircumference}
                            strokeDashoffset={timerOffset}
                          />
                        </svg>
                        <div className="pr-bomb" aria-hidden="true">
                          <span className="pr-bomb-fuse" />
                          <span className="pr-bomb-body">
                            <span className="pr-bomb-shine" />
                          </span>
                          <span className="pr-bomb-spark">✦</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {message && (
              <div className="pr-alert" role="status" aria-live="polite">
                {message}
              </div>
            )}
            <button className="pr-skip" disabled={pending} onClick={() => finishTurn(0, "", "Turno pasado · −1 vida")}>
              Pasar turno (−1 vida)
            </button>
          </section>
          <aside className="pr-panel pr-scores">
            <h2>🏆 Clasificación</h2>
            {sorted.map((p, i) => (
              <div className={"pr-player " + (p.id === active?.id ? "pr-current" : "")} key={p.id}>
                <span className="pr-score-dot" style={{ background: p.color }} />
                <span>
                  {i + 1}. {p.name} {p.id === active?.id ? "➜" : ""}
                </span>
                <strong>{p.score} pts</strong>
                <small>
                  {"♥".repeat(p.lives)}
                  {"♡".repeat(3 - p.lives)}
                </small>
              </div>
            ))}
            <h3>Palabras utilizadas ({used.length})</h3>
            <div className="pr-used">
              {used.length ? used.slice(-18).map((w) => <span key={w}>{w}</span>) : "Todavía ninguna"}
            </div>
            <p className="pr-small">
              Modalidad: {mode === "team" ? "Equipos" : "Individual"} · Diccionario: {BASE_COUNT + extraWords.length}{" "}
              entradas aproximadamente
            </p>
          </aside>
        </div>
      )}
      {phase === "finished" && (
        <section className="pr-panel pr-finish">
          <div className="pr-burst">🏆</div>
          <h2>¡Partida terminada!</h2>
          <p>
            {sorted.filter((p) => p.score === winner?.score).length > 1 ? "Empate en el primer lugar" : "Ganador"}:{" "}
            <strong>
              {sorted
                .filter((p) => p.score === winner?.score)
                .map((p) => p.name)
                .join(" y ")}
            </strong>{" "}
            · {winner?.score} puntos
          </p>
          {sorted.map((p, i) => (
            <div className="pr-rank" key={p.id}>
              <span>
                {i + 1}. {p.name}
              </span>
              <strong>{p.score} puntos</strong>
            </div>
          ))}
          <button
            className="pr-primary"
            onClick={() => {
              setPhase("setup");
              setMessage("");
            }}
          >
            Jugar otra vez
          </button>
        </section>
      )}
    </div>
  );
  const overlay =
    screen === "solo" ? (
      <PalabraSolo name={soloName.trim()} extraWords={extraWords} onExit={() => setScreen("setup")} />
    ) : screen === "online" && online ? (
      <OnlineRoom
        key={online.code}
        code={online.code}
        name={online.name}
        host={online.host}
        hostPlays={online.hostPlays}
        onExit={() => {
          setScreen("setup");
          setOnline(null);
        }}
      />
    ) : null;
  const page = (
    <>
      {content}
      {overlay}
    </>
  );
  return frame ? frame(page) : page;
}
