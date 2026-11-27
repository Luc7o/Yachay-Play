import React, { useEffect, useMemo, useRef, useState } from "react";
import { IconoEnLinea } from "../campusUi";
import { candidateFragments, checkWord, normalizeWord } from "../palabraDiccionario";
import { Hearts, PalabraStage, StageFrame, useStageTheme } from "./PalabraStage";
import { Button } from "../ui";

// ============================================================================
// PALABRA RELÁMPAGO · INDIVIDUAL (una persona contra el reloj)
// ============================================================================
// - 3 vidas, igual que en equipos. La partida dura hasta quedarte sin vidas.
// - Cada palabra tiene su propio tiempo: empieza en START_SECONDS y se acorta
//   1 segundo cada WORDS_PER_LEVEL aciertos hasta llegar a MIN_SECONDS.
// - Si se acaba el tiempo o cambias las letras pierdes una vida; salen letras
//   nuevas al instante, sin esperar turnos.
// ============================================================================
const LIVES = 3;
const START_SECONDS = 20;
const MIN_SECONDS = 6;
const WORDS_PER_LEVEL = 2;
const timeFor = (words) => Math.max(MIN_SECONDS, START_SECONDS - Math.floor(words / WORDS_PER_LEVEL));
const levelOf = (words) => Math.floor(words / WORDS_PER_LEVEL) + 1;

const RECORD_KEY = "yachay-palabra-relampago-solo-best-v2";
const readBest = (name) => {
  try {
    return Number(JSON.parse(localStorage.getItem(RECORD_KEY) || "{}")[name.toLowerCase()]) || 0;
  } catch {
    return 0;
  }
};
const writeBest = (name, score) => {
  try {
    const all = JSON.parse(localStorage.getItem(RECORD_KEY) || "{}");
    all[name.toLowerCase()] = score;
    localStorage.setItem(RECORD_KEY, JSON.stringify(all));
  } catch {
    /* almacenamiento opcional */
  }
};

export function PalabraSolo({ name, extraWords = [], onExit }) {
  const [theme, toggleTheme] = useStageTheme();
  const extraSet = useMemo(() => new Set(extraWords), [extraWords]);
  const inputRef = useRef(null);
  const initial = () => ({
    lives: LIVES,
    score: 0,
    words: [],
    streak: 0,
    best: 0,
    fragment: "",
    total: START_SECONDS,
    remain: START_SECONDS,
    answer: "",
    message: null,
    over: false,
    boom: false,
  });
  const [g, setG] = useState(initial);
  const gr = useRef(g);
  const deadline = useRef(0);
  const usedRef = useRef([]);
  const [record, setRecord] = useState({ isNew: false, best: 0 });

  const commit = (patch) => {
    gr.current = { ...gr.current, ...patch };
    setG(gr.current);
  };
  const focus = () => window.setTimeout(() => inputRef.current?.focus(), 0);

  // Letras nuevas + reloj de la palabra siguiente (empieza de inmediato).
  const nextWord = (patch = {}, wordsCount = gr.current.words.length) => {
    const choices = candidateFragments(usedRef.current, extraSet).filter((f) => f !== gr.current.fragment);
    const fragment = choices[Math.floor(Math.random() * choices.length)] || "sa";
    const total = timeFor(wordsCount);
    deadline.current = Date.now() + total * 1000;
    commit({ ...patch, fragment, total, remain: total, answer: "" });
    focus();
  };

  useEffect(() => {
    nextWord({}, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loseLife = (text) => {
    const s = gr.current;
    const lives = s.lives - 1;
    if (lives <= 0) {
      const prev = readBest(name);
      const isNew = s.score > 0 && s.score > prev;
      if (isNew) writeBest(name, s.score);
      setRecord({ isNew, best: Math.max(prev, s.score) });
      commit({ lives: 0, over: true, streak: 0, message: { text, tone: "bad" } });
      return;
    }
    nextWord({
      lives,
      streak: 0,
      message: { text: `${text} · te quedan ${lives} ${lives === 1 ? "vida" : "vidas"}`, tone: "bad" },
      boom: true,
    });
    window.setTimeout(() => !gr.current.over && commit({ boom: false }), 500);
  };

  // Reloj de la palabra: se calcula con la hora real, así no se "acorta" el primer segundo.
  useEffect(() => {
    const id = window.setInterval(() => {
      const s = gr.current;
      if (s.over || !s.fragment) return;
      const remain = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      if (remain <= 0) loseLife("¡Se acabó el tiempo!");
      else if (remain !== s.remain) commit({ remain });
    }, 200);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = () => {
    const s = gr.current;
    if (s.over) return;
    const motivo = checkWord(s.answer, s.fragment, usedRef.current, extraSet);
    if (motivo) {
      commit({ message: { text: motivo, tone: "bad" } });
      return;
    }
    const word = s.answer.trim();
    const points = 10 + s.remain;
    usedRef.current = [...usedRef.current, normalizeWord(word)];
    const words = [...s.words, word];
    const streak = s.streak + 1;
    const subio = timeFor(words.length) < timeFor(s.words.length);
    nextWord(
      {
        score: s.score + points,
        words,
        streak,
        best: Math.max(s.best, streak),
        message: {
          text: subio
            ? `¡Correcto! +${points} · Nivel ${levelOf(words.length)}: ahora ${timeFor(words.length)} s por palabra`
            : `¡Correcto! +${points} puntos · ${word}`,
          tone: "good",
        },
      },
      words.length,
    );
  };

  const skip = () => {
    if (!gr.current.over) loseLife("Cambiaste las letras");
  };

  const restart = () => {
    usedRef.current = [];
    gr.current = initial();
    setG(gr.current);
    setRecord({ isNew: false, best: 0 });
    nextWord({}, 0);
  };

  const usedItems = [...g.words].reverse();

  if (g.over) {
    return (
      <StageFrame
        theme={theme}
        onToggleTheme={toggleTheme}
        onExit={onExit}
        exitLabel="Volver"
        title="Palabra Relámpago"
        kicker="INDIVIDUAL"
      >
        <div className="pf-center">
          <section className="pf-card" aria-live="polite">
            <div style={{ fontSize: 54 }} aria-hidden="true">
              <IconoEnLinea nombre="rayo" />
            </div>
            <h2>¡Te quedaste sin vidas!</h2>
            <p>
              <strong>{name}</strong> sumó <strong>{g.score} puntos</strong> con {g.words.length}{" "}
              {g.words.length === 1 ? "palabra" : "palabras"}.
            </p>
            <p>
              Nivel alcanzado: {levelOf(g.words.length)} · Mejor racha: {g.best}
            </p>
            <p>
              {record.isNew
                ? "¡Nuevo récord personal en este navegador!"
                : `Tu récord en este navegador: ${record.best} puntos`}
            </p>
            {g.words.length > 0 && (
              <div className="pf-people" aria-label="Palabras que lograste">
                {g.words.map((w, i) => (
                  <span className="pf-word" key={i}>
                    {w}
                  </span>
                ))}
              </div>
            )}
            <div className="pf-actions">
              <Button onClick={restart}>Jugar otra vez</Button>
              <Button variant="ghost" onClick={onExit}>
                Volver a juegos
              </Button>
            </div>
          </section>
        </div>
      </StageFrame>
    );
  }

  return (
    <PalabraStage
      theme={theme}
      onToggleTheme={toggleTheme}
      onExit={onExit}
      exitLabel="Salir"
      title="Palabra Relámpago"
      kicker="INDIVIDUAL · CONTRA EL RELOJ"
      status={`${name} · Nivel ${levelOf(g.words.length)} · ${g.total} s por palabra`}
      fragment={g.fragment || "··"}
      clock={{ remain: g.remain, total: g.total, low: g.remain <= Math.min(5, Math.ceil(g.total / 3)), boom: g.boom }}
      entry={{ editable: true, value: g.answer, onChange: (v) => commit({ answer: v }), onSubmit: submit, inputRef }}
      message={g.message}
      actions={
        <Button variant="ghost" onClick={skip}>
          Cambiar letras (−1 vida)
        </Button>
      }
      side={
        <>
          <h2>
            <IconoEnLinea nombre="rayo" />
            Tu partida
          </h2>
          <div className="pf-stats">
            <div>
              <strong>{g.score}</strong>
              <span>puntos</span>
            </div>
            <div>
              <strong>{g.words.length}</strong>
              <span>palabras</span>
            </div>
            <div>
              <strong>{g.streak}</strong>
              <span>racha</span>
            </div>
            <div>
              <strong>{g.best}</strong>
              <span>mejor</span>
            </div>
          </div>
          <p className="pf-level">
            <span>Vidas</span>
            <Hearts lives={g.lives} max={LIVES} />
          </p>
        </>
      }
      used={usedItems}
    />
  );
}
