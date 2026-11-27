import React, { useCallback, useEffect, useRef, useState } from "react";
import { IconoEnLinea } from "../campusUi";
import { conClaseDestino, limpiarClaseDestino } from "../claseDestino";
import { API_URL, getToken } from "../api";
import { Brand } from "../Brand";
import { emitConTiempoLimite, loadJSON, saveJSON } from "../cw/helpers";
import { useSalaEnVivo } from "../salaEnVivo";
import "../herramientas.css";
import "./quiz.css";
import { Button } from "../ui";

// ============================================================================
// EVALUACIÓN RÁPIDA
//   Docente    -> arma preguntas de opción múltiple, crea la sala y la conduce en vivo
//   Estudiante -> entra con el código, responde desde el celular y ve su resultado
// El servidor (backend/quick/) lleva el reloj y NUNCA manda la respuesta correcta
// a los estudiantes antes de que se cierre cada pregunta.
// ============================================================================
const LS_BORRADOR = "yachay_qz_borrador"; // { nombre, preguntas } del docente
const LS_DOCENTE = "yachay_qz_docente"; // código de la última sala del docente
const LS_ALUMNO = "yachay_qz_alumno"; // { code, playerId, name }
const SEGUNDOS = [15, 30, 45, 60, 90, 120, 180];
const COLORES = ["#E21B3C", "#1368CE", "#C68A00", "#26890C"];
const FORMAS = ["▲", "◆", "●", "■"];
const LETRAS = ["A", "B", "C", "D"];

const preguntaNueva = () => ({ text: "", options: ["", ""], correct: -1, seconds: 30 });

async function pedir(path, options = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa que el backend esté encendido.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      data.error ||
        (res.status === 404
          ? "El servidor no tiene esta herramienta todavía: actualiza el backend y reinícialo."
          : "No se pudo completar la acción."),
    );
  return data;
}

// Mismas reglas que el servidor, para avisar antes de enviar.
function validar(preguntas) {
  if (!preguntas.length) return "Agrega al menos una pregunta.";
  for (let i = 0; i < preguntas.length; i++) {
    const q = preguntas[i];
    const ops = q.options.map((o) => o.trim()).filter(Boolean);
    if (!q.text.trim()) return `La pregunta ${i + 1} no tiene texto.`;
    if (ops.length < 2) return `La pregunta ${i + 1} necesita al menos 2 opciones con texto.`;
    if (new Set(ops.map((o) => o.toLowerCase())).size !== ops.length)
      return `La pregunta ${i + 1} tiene opciones repetidas.`;
    if (q.correct < 0 || !q.options[q.correct]?.trim()) return `Marca la respuesta correcta de la pregunta ${i + 1}.`;
  }
  return "";
}
// Quita las opciones vacías sin perder cuál era la correcta.
function limpiar(preguntas) {
  return preguntas.map((q) => {
    const options = [];
    let correct = -1;
    q.options.forEach((o, i) => {
      if (!o.trim()) return;
      if (i === q.correct) correct = options.length;
      options.push(o.trim());
    });
    return { text: q.text.trim(), options, correct, seconds: q.seconds };
  });
}
// Pegar preguntas desde un documento: bloques separados por línea en blanco;
// 1.ª línea = pregunta, siguientes = opciones; la correcta lleva * al inicio o al final.
function parsear(texto) {
  return texto
    .split(/\n\s*\n/)
    .map((b) =>
      b
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    )
    .filter((b) => b.length >= 3)
    .map(([text, ...ops]) => {
      let correct = -1;
      const options = ops.slice(0, 4).map((o, i) => {
        if (/^\*|\*$/.test(o)) correct = i;
        return o
          .replace(/^\*\s*|\s*\*$/g, "")
          .replace(/^[a-dA-D][).]\s+/, "")
          .trim();
      });
      return { text: text.replace(/^\d+[).]\s*/, "").trim(), options, correct, seconds: 30 };
    });
}
function descargarCSV(filas, nombre) {
  const celda = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = "\ufeff" + filas.map((f) => f.map(celda).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombre.replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, "").trim() || "evaluacion"}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Segundos que faltan, usando la hora del servidor (no la del celular).
function useCuenta(deadline, offset) {
  const [seg, setSeg] = useState(0);
  useEffect(() => {
    if (!deadline) {
      setSeg(0);
      return undefined;
    }
    const f = () => setSeg(Math.max(0, Math.ceil((deadline - (Date.now() + offset)) / 1000)));
    f();
    const id = setInterval(f, 250);
    return () => clearInterval(id);
  }, [deadline, offset]);
  return seg;
}
// Mantiene el estado de la sala al día con lo que manda el servidor.
function useSala(code, estadoInicial, reunir) {
  const [estado, setEstado] = useState(() => ({ ...estadoInicial, offset: estadoInicial.now - Date.now() }));
  const reunirRef = useRef(reunir);
  reunirRef.current = reunir;
  const alEstado = (st) => st?.code === code && setEstado({ ...st, offset: st.now - Date.now() });
  useSalaEnVivo({
    clave: code,
    eventos: { "qz:state": alEstado },
    // tras un corte de red se vuelve a entrar a la sala
    alReconectar: () => emitConTiempoLimite(...reunirRef.current(), (ack) => ack?.state && alEstado(ack.state)),
  });
  return estado;
}

// ============================================================================
export function Evaluacion({ user, goHome, onLogin, onRegister, initialCode = "", initialName = "" }) {
  const esDocente = user?.role === "docente";
  const [sala, setSala] = useState(null); // docente: { code, state }
  const [alumno, setAlumno] = useState(null); // estudiante: { code, playerId, name, state }
  const [cargando, setCargando] = useState(esDocente || !!loadJSON(LS_ALUMNO));

  // Al volver a abrir (o recargar) se reconecta a la sala que había
  useEffect(() => {
    let vivo = true;
    if (esDocente) {
      const code = loadJSON(LS_DOCENTE);
      if (!code) {
        setCargando(false);
        return undefined;
      }
      emitConTiempoLimite("qz:watch", { code }, (ack) => {
        if (!vivo) return;
        if (ack?.ok && ack.state.status !== "ended") setSala({ code, state: ack.state });
        else saveJSON(LS_DOCENTE, null);
        setCargando(false);
      });
    } else {
      const g = loadJSON(LS_ALUMNO);
      if (!g) {
        setCargando(false);
        return undefined;
      }
      emitConTiempoLimite("qz:join", g, (ack) => {
        if (!vivo) return;
        if (ack?.ok) setAlumno({ ...g, playerId: ack.playerId, state: ack.state });
        else saveJSON(LS_ALUMNO, null);
        setCargando(false);
      });
    }
    return () => {
      vivo = false;
    };
  }, [esDocente]);

  const salirDocente = () => {
    saveJSON(LS_DOCENTE, null);
    setSala(null);
  };
  const salirAlumno = () => {
    saveJSON(LS_ALUMNO, null);
    setAlumno(null);
  };

  const cuerpo = () => {
    if (cargando) return <p className="qz-centro">Conectando…</p>;
    if (esDocente)
      return sala ? (
        <VistaDocente key={sala.code} sala={sala} onNueva={salirDocente} />
      ) : (
        <Editor
          onCreada={(code, state) => {
            saveJSON(LS_DOCENTE, code);
            setSala({ code, state });
          }}
        />
      );
    if (alumno) return <VistaAlumno key={alumno.code} alumno={alumno} onSalir={salirAlumno} />;
    return (
      <Unirse
        user={user}
        initialCode={initialCode}
        initialName={initialName}
        onLogin={onLogin}
        onRegister={onRegister}
        onEntrar={(g, state) => {
          saveJSON(LS_ALUMNO, g);
          setAlumno({ ...g, state });
        }}
      />
    );
  };

  return (
    <div className="app hr-page qz-page">
      <header className="ref-topbar">
        <Brand subtitle="Evaluación rápida" onClick={goHome} />
        <Button variant="ghost" className="hr-back" onClick={goHome}>
          ← Volver al inicio
        </Button>
      </header>
      <main className="qz-main">{cuerpo()}</main>
    </div>
  );
}

// ============================================================================
// DOCENTE · EDITOR DE PREGUNTAS
// ============================================================================
function Editor({ onCreada }) {
  const guardado = useRef(loadJSON(LS_BORRADOR)).current;
  const [nombre, setNombre] = useState(guardado?.nombre ?? "");
  const [preguntas, setPreguntas] = useState(guardado?.preguntas?.length ? guardado.preguntas : [preguntaNueva()]);
  const [pegar, setPegar] = useState(false);
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    saveJSON(LS_BORRADOR, { nombre, preguntas });
  }, [nombre, preguntas]);

  const cambiar = (i, parche) => setPreguntas((ps) => ps.map((q, k) => (k === i ? { ...q, ...parche } : q)));
  const cambiarOpcion = (i, j, v) => cambiar(i, { options: preguntas[i].options.map((o, k) => (k === j ? v : o)) });
  const quitarOpcion = (i, j) => {
    const q = preguntas[i];
    cambiar(i, {
      options: q.options.filter((_, k) => k !== j),
      correct: q.correct === j ? -1 : q.correct > j ? q.correct - 1 : q.correct,
    });
  };
  const duplicar = (i) =>
    setPreguntas((ps) => [...ps.slice(0, i + 1), JSON.parse(JSON.stringify(ps[i])), ...ps.slice(i + 1)]);
  const quitar = (i) => setPreguntas((ps) => (ps.length === 1 ? [preguntaNueva()] : ps.filter((_, k) => k !== i)));

  function importar() {
    const nuevas = parsear(texto);
    if (!nuevas.length)
      return setAviso(
        "No encontré preguntas. Cada una necesita el enunciado y al menos 2 opciones, separadas por una línea en blanco.",
      );
    setPreguntas((ps) => [...(ps.length === 1 && !ps[0].text.trim() ? [] : ps), ...nuevas].slice(0, 30));
    setTexto("");
    setPegar(false);
    setAviso(`Se agregaron ${nuevas.length} preguntas. Revisa que cada una tenga marcada su respuesta correcta.`);
  }
  async function crear() {
    const error = validar(preguntas);
    if (error) return setAviso(error);
    setBusy(true);
    setAviso("");
    try {
      const r = await pedir("/api/quick-quizzes", {
        method: "POST",
        body: JSON.stringify({ name: nombre, questions: limpiar(preguntas), ...conClaseDestino() }),
      });
      limpiarClaseDestino();
      emitConTiempoLimite("qz:watch", { code: r.code }, (ack) => {
        setBusy(false);
        if (ack?.ok) onCreada(r.code, ack.state);
        else setAviso(ack?.error || "No se pudo abrir la sala.");
      });
    } catch (e) {
      setBusy(false);
      setAviso(e.message);
    }
  }

  return (
    <section className="qz-editor">
      <div className="hr-card qz-cabecera">
        <h2>Nueva evaluación rápida</h2>
        <p className="hr-muted">
          Arma las preguntas, crea la sala y proyecta el código: tus estudiantes responden desde el celular y ves los
          resultados al instante.
        </p>
        <label className="hr-label" htmlFor="qz-nombre">
          Nombre (opcional)
        </label>
        <input
          id="qz-nombre"
          type="text"
          maxLength={60}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej.: Repaso de la unidad 2"
        />
      </div>

      {preguntas.map((q, i) => (
        <article key={i} className="hr-card qz-pregunta">
          <div className="qz-p-top">
            <b>Pregunta {i + 1}</b>
            <span className="qz-p-acc">
              <select
                aria-label={`Tiempo de la pregunta ${i + 1}`}
                value={q.seconds}
                onChange={(e) => cambiar(i, { seconds: Number(e.target.value) })}
              >
                {SEGUNDOS.map((s) => (
                  <option key={s} value={s}>
                    {s < 60 ? `${s} s` : `${s / 60} min`}
                  </option>
                ))}
              </select>
              <button className="hr-icon" title="Duplicar" aria-label="Duplicar pregunta" onClick={() => duplicar(i)}>
                ⧉
              </button>
              <button className="hr-icon" title="Eliminar" aria-label="Eliminar pregunta" onClick={() => quitar(i)}>
                ✕
              </button>
            </span>
          </div>
          <textarea
            rows={2}
            maxLength={300}
            value={q.text}
            onChange={(e) => cambiar(i, { text: e.target.value })}
            placeholder="Escribe la pregunta…"
            aria-label={`Texto de la pregunta ${i + 1}`}
          />
          <div className="qz-ops">
            {q.options.map((o, j) => (
              <div key={j} className={"qz-op" + (q.correct === j ? " ok" : "")}>
                <input
                  type="radio"
                  name={`c${i}`}
                  checked={q.correct === j}
                  onChange={() => cambiar(i, { correct: j })}
                  aria-label={`Marcar la opción ${LETRAS[j]} como correcta`}
                  title="Respuesta correcta"
                />
                <span className="qz-letra" style={{ background: COLORES[j] }}>
                  {LETRAS[j]}
                </span>
                <input
                  type="text"
                  maxLength={150}
                  value={o}
                  onChange={(e) => cambiarOpcion(i, j, e.target.value)}
                  placeholder={`Opción ${LETRAS[j]}`}
                  aria-label={`Opción ${LETRAS[j]} de la pregunta ${i + 1}`}
                />
                {q.options.length > 2 && (
                  <button className="hr-icon" aria-label="Quitar opción" onClick={() => quitarOpcion(i, j)}>
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="qz-p-pie">
            {q.options.length < 4 && (
              <button className="hr-link" onClick={() => cambiar(i, { options: [...q.options, ""] })}>
                + Agregar opción
              </button>
            )}
            {q.correct < 0 && <span className="qz-falta">Marca la respuesta correcta (círculo)</span>}
          </div>
        </article>
      ))}

      <div className="hr-row qz-acciones">
        <Button
          variant="ghost"
          size="lg"
          disabled={preguntas.length >= 30}
          onClick={() => setPreguntas([...preguntas, preguntaNueva()])}
        >
          + Agregar pregunta
        </Button>
        <Button variant="ghost" size="lg" onClick={() => setPegar(!pegar)}>
          Pegar desde un documento
        </Button>
      </div>
      {pegar && (
        <div className="hr-card">
          <p className="hr-muted">
            Una pregunta por bloque (separa los bloques con una línea en blanco). Primera línea: la pregunta.
            Siguientes: las opciones. Marca la correcta con <b>*</b> al inicio o al final.
          </p>
          <textarea
            rows={8}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={"1. ¿Cuál es la capital de Perú?\na) Lima *\nb) Cusco\nc) Arequipa"}
          />
          <div className="hr-row">
            <Button size="sm" onClick={importar}>
              Importar preguntas
            </Button>
          </div>
        </div>
      )}
      {aviso && (
        <p className="hr-aviso" role="status">
          {aviso}
        </p>
      )}
      <div className="qz-crear">
        <Button size="lg" className="hr-grande" disabled={busy} onClick={crear}>
          {busy ? "Creando…" : `Crear sala (${preguntas.length} ${preguntas.length === 1 ? "pregunta" : "preguntas"})`}
        </Button>
      </div>
    </section>
  );
}

// ============================================================================
// DOCENTE · SALA EN VIVO
// ============================================================================
function Barras({ question, counts, correcto }) {
  const total = counts ? counts.reduce((a, b) => a + b, 0) : 0;
  return (
    <div className="qz-barras">
      {question.options.map((o, j) => {
        const n = counts?.[j] ?? 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        return (
          <div key={j} className={"qz-barra" + (correcto && question.correct === j ? " ok" : correcto ? " no" : "")}>
            <span className="qz-letra" style={{ background: COLORES[j] }}>
              {LETRAS[j]}
            </span>
            <span className="qz-b-txt">{o}</span>
            <span className="qz-b-pista">
              <i style={{ width: `${pct}%`, background: COLORES[j] }} />
            </span>
            <span className="qz-b-n">
              {n}
              {total ? ` · ${pct}%` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function VistaDocente({ sala, onNueva }) {
  const { code } = sala;
  const st = useSala(code, sala.state, () => ["qz:watch", { code }]);
  const seg = useCuenta(st.deadline, st.offset);
  const [error, setError] = useState("");
  const accion = useCallback(
    (evento) => emitConTiempoLimite(evento, { code }, (ack) => setError(ack?.error || "")),
    [code],
  );
  const exportar = () =>
    emitConTiempoLimite("qz:export", { code }, (ack) =>
      ack?.ok ? descargarCSV(ack.rows, ack.name) : setError(ack?.error || "No se pudo exportar."),
    );
  const ultima = st.qIndex + 1 >= st.total;

  return (
    <section className="qz-vivo">
      <div className="qz-barra-sup">
        <span>
          <b>{st.name}</b> · código <b className="qz-codigo-mini">{code}</b> · <IconoEnLinea nombre="grupo" />
          {st.players}
        </span>
        {st.status !== "ended" && (
          <button
            className="hr-link"
            onClick={() => window.confirm("¿Terminar la evaluación ahora?") && accion("qz:end")}
          >
            Terminar ahora
          </button>
        )}
      </div>
      {error && (
        <p className="hr-aviso" role="alert">
          {error}
        </p>
      )}

      {st.status === "lobby" && (
        <div className="hr-card qz-lobby">
          <p className="hr-muted">Los estudiantes entran a YachayPlay → Evaluación rápida → «Unirme con código»</p>
          <div className="qz-codigo" aria-label={`Código ${code}`}>
            {code}
          </div>
          <p className="qz-cuenta-j">
            {st.players === 0
              ? "Esperando estudiantes…"
              : `${st.players} ${st.players === 1 ? "estudiante conectado" : "estudiantes conectados"}`}
          </p>
          <div className="qz-chips">
            {st.names.map((n) => (
              <span key={n} className="qz-chip">
                {n}
              </span>
            ))}
          </div>
          <Button size="lg" className="hr-grande" disabled={st.players === 0} onClick={() => accion("qz:start")}>
            ▶ Iniciar ({st.total} {st.total === 1 ? "pregunta" : "preguntas"})
          </Button>
        </div>
      )}

      {(st.status === "question" || st.status === "reveal") && st.question && (
        <div className="hr-card qz-pantalla">
          <div className="qz-q-top">
            <span>
              Pregunta {st.qIndex + 1} de {st.total}
            </span>
            {st.status === "question" ? (
              <span className={"qz-reloj" + (seg <= 5 ? " urgente" : "")} role="timer">
                {seg}s
              </span>
            ) : (
              <span className="qz-reloj fin">Respuesta</span>
            )}
          </div>
          <h2 className="qz-enunciado">{st.question.text}</h2>
          <Barras question={st.question} counts={st.counts} correcto={st.status === "reveal"} />
          <p className="qz-respondieron">
            ✍️ Respondieron {st.answered} de {st.players}
          </p>
          {st.status === "reveal" && st.top?.length > 0 && (
            <ol className="qz-top">
              {st.top.map((t) => (
                <li key={t.rank}>
                  <b>{t.rank}.</b> {t.name} <span>{t.score} pts</span>
                </li>
              ))}
            </ol>
          )}
          <div className="hr-row qz-acciones">
            {st.status === "question" && (
              <Button variant="ghost" size="lg" onClick={() => accion("qz:reveal")}>
                👁 Mostrar respuesta
              </Button>
            )}
            <Button size="lg" onClick={() => accion("qz:next")}>
              {ultima ? "Ver resultados" : "Siguiente pregunta"}
            </Button>
          </div>
        </div>
      )}

      {st.status === "ended" && (
        <>
          <div className="hr-card">
            <h2>Resultados</h2>
            {st.ranking.length === 0 ? (
              <p className="hr-muted">Nadie participó.</p>
            ) : (
              <div className="hr-tabla">
                <table>
                  <thead>
                    <tr>
                      <th className="n">#</th>
                      <th>Estudiante</th>
                      <th>Aciertos</th>
                      <th>Puntaje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {st.ranking.map((r) => (
                      <tr key={r.name}>
                        <td className="n">{r.rank}</td>
                        <td>{r.name}</td>
                        <td>
                          {r.correct} / {st.total}
                        </td>
                        <td>{r.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="hr-card">
            <h2>¿Qué quedó claro?</h2>
            <p className="hr-muted">Porcentaje de aciertos por pregunta: las más bajas son los temas para reforzar.</p>
            {st.review.map((q, i) => {
              const pct = q.respondieron ? Math.round((q.aciertos / q.respondieron) * 100) : 0;
              return (
                <div key={i} className="qz-rev">
                  <div className="qz-rev-top">
                    <span>
                      {i + 1}. {q.text}
                    </span>
                    <b className={pct < 50 ? "bajo" : pct < 80 ? "medio" : "alto"}>{pct}%</b>
                  </div>
                  <span className="qz-b-pista">
                    <i
                      style={{ width: `${pct}%`, background: pct < 50 ? "#D92D20" : pct < 80 ? "#D99A00" : "#26890C" }}
                    />
                  </span>
                  <small className="hr-muted">
                    Correcta: {LETRAS[q.correct]}) {q.options[q.correct]} · {q.aciertos} de {q.respondieron} acertaron
                  </small>
                </div>
              );
            })}
          </div>
          <div className="hr-row qz-acciones">
            <Button size="lg" onClick={exportar}>
              ⬇ Descargar resultados (Excel/CSV)
            </Button>
            <Button variant="ghost" size="lg" onClick={onNueva}>
              + Nueva evaluación
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

// ============================================================================
// ESTUDIANTE
// ============================================================================
function Unirse({ user, onLogin, onRegister, onEntrar, initialCode = "", initialName = "" }) {
  const [code, setCode] = useState(
    String(initialCode || "")
      .replace(/\D/g, "")
      .slice(0, 6),
  );
  const [name, setName] = useState(initialName || user?.name || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const listo = code.length === 6 && name.trim().length > 0;

  function entrar() {
    setBusy(true);
    setError("");
    emitConTiempoLimite("qz:join", { code, name: name.trim() }, (ack) => {
      setBusy(false);
      if (ack?.ok) onEntrar({ code, playerId: ack.playerId, name: name.trim() }, ack.state);
      else setError(ack?.error || "No se pudo entrar.");
    });
  }
  return (
    <section className="hr-card qz-unirse">
      <h2>Unirme a una evaluación</h2>
      <p className="hr-muted">Escribe el código que proyecta tu docente.</p>
      <label className="hr-label" htmlFor="qz-code">
        Código
      </label>
      <input
        id="qz-code"
        className="qz-code-in"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={code}
        placeholder="000000"
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
      />
      <label className="hr-label" htmlFor="qz-name">
        Tu nombre
      </label>
      <input
        id="qz-name"
        type="text"
        maxLength={30}
        autoComplete="name"
        value={name}
        placeholder="Nombre y apellido"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && listo && !busy && entrar()}
      />
      {error && (
        <p className="hr-aviso" role="alert">
          {error}
        </p>
      )}
      <Button size="lg" className="hr-grande" disabled={!listo || busy} onClick={entrar}>
        {busy ? "Entrando…" : "Entrar"}
      </Button>
      {!user && (
        <p className="hr-muted qz-docente-link">
          ¿Eres docente?{" "}
          <button className="hr-link" onClick={onLogin}>
            Inicia sesión
          </button>{" "}
          o{" "}
          <button className="hr-link" onClick={onRegister}>
            crea una cuenta
          </button>{" "}
          para crear evaluaciones.
        </p>
      )}
    </section>
  );
}

function VistaAlumno({ alumno, onSalir }) {
  const { code, playerId, name } = alumno;
  const st = useSala(code, alumno.state, () => ["qz:join", { code, playerId, name }]);
  const seg = useCuenta(st.deadline, st.offset);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    setError("");
    setEnviando(false);
  }, [st.qIndex]);

  function responder(j) {
    if (enviando || st.me?.choice != null || st.status !== "question") return;
    setEnviando(true);
    emitConTiempoLimite("qz:answer", { choice: j }, (ack) => {
      setEnviando(false);
      if (ack?.error) setError(ack.error);
    });
  }
  const elegida = st.me?.choice;

  return (
    <section className="qz-alumno">
      <div className="qz-barra-sup">
        <span>
          <IconoEnLinea nombre="persona" />
          <b>{name}</b>
          {st.me && st.status !== "lobby" ? ` · ${st.me.score} pts` : ""}
        </span>
        <button className="hr-link" onClick={onSalir}>
          Salir
        </button>
      </div>

      {st.status === "lobby" && (
        <div className="hr-card qz-espera">
          <h2>¡Listo, {name}!</h2>
          <p className="hr-muted">Espera a que tu docente inicie la evaluación…</p>
          <p className="qz-cuenta-j">
            <IconoEnLinea nombre="grupo" />
            {st.players} conectados
          </p>
        </div>
      )}

      {(st.status === "question" || st.status === "reveal") && st.question && (
        <div className="qz-pantalla-al">
          <div className="qz-q-top">
            <span>
              Pregunta {st.qIndex + 1} de {st.total}
            </span>
            {st.status === "question" && (
              <span className={"qz-reloj" + (seg <= 5 ? " urgente" : "")} role="timer">
                {seg}s
              </span>
            )}
          </div>
          <h2 className="qz-enunciado">{st.question.text}</h2>
          <div className="qz-botones">
            {st.question.options.map((o, j) => {
              const reveal = st.status === "reveal";
              let clase = "qz-boton";
              if (reveal) clase += st.question.correct === j ? " ok" : elegida === j ? " mal" : " apagado";
              else if (elegida != null) clase += elegida === j ? " elegida" : " apagado";
              return (
                <button
                  key={j}
                  className={clase}
                  style={{ "--qz-c": COLORES[j] }}
                  disabled={reveal || elegida != null || enviando}
                  onClick={() => responder(j)}
                >
                  <span className="qz-forma" aria-hidden="true">
                    {FORMAS[j]}
                  </span>
                  <span>{o}</span>
                </button>
              );
            })}
          </div>
          {error && (
            <p className="hr-aviso" role="alert">
              {error}
            </p>
          )}
          {st.status === "question" && elegida != null && (
            <p className="qz-estado">✅ Respuesta enviada. Espera a tus compañeros…</p>
          )}
          {st.status === "question" && elegida == null && seg === 0 && <p className="qz-estado">Se acabó el tiempo</p>}
          {st.status === "reveal" && (
            <p className={"qz-estado grande " + (elegida === st.question.correct ? "bien" : "mal")}>
              {elegida == null
                ? "No respondiste a tiempo"
                : elegida === st.question.correct
                  ? `¡Correcto! +${st.me.points} pts`
                  : "Incorrecto"}
              {st.me?.rank ? ` · vas en el puesto ${st.me.rank}` : ""}
            </p>
          )}
        </div>
      )}

      {st.status === "ended" && (
        <div className="hr-card qz-espera">
          <h2>¡Evaluación terminada!</h2>
          <p className="qz-final">{st.me?.rank ? `Puesto ${st.me.rank} de ${st.players}` : ""}</p>
          <p className="qz-final-pts">{st.me?.score ?? 0} puntos</p>
          {st.top?.length > 0 && (
            <ol className="qz-top">
              {st.top.map((t) => (
                <li key={t.rank}>
                  <b>{t.rank}.</b> {t.name} <span>{t.score} pts</span>
                </li>
              ))}
            </ol>
          )}
          <Button size="lg" onClick={onSalir}>
            Salir
          </Button>
        </div>
      )}
    </section>
  );
}
