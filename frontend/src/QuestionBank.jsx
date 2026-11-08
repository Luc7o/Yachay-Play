import React, { useEffect, useState } from "react";
import { Brand } from "./Brand";
import { api } from "./api";
import "./tools.css";

const VACIA = { topic: "", level: "Comprensión", question: "", options: ["", "", "", ""], answerIndex: 0 };
const LETRAS = ["A", "B", "C", "D"];

function PreguntaItem({ q, onEdit, onToggle, onDelete }) {
  return (
    <div className={"tl-q" + (q.active === false ? " off" : "")}>
      <div className="tl-q-top">
        <span className="tl-pill">{q.topic}</span>
        <span className="tl-pill warn">{q.level}</span>
        {q.active === false && <span className="tl-pill lose">desactivada</span>}
      </div>
      <p>{q.question}</p>
      <ol type="A">
        {q.options.map((o, i) => (
          <li key={i} className={i === q.answerIndex ? "right" : ""}>{o}{i === q.answerIndex ? " ✔" : ""}</li>
        ))}
      </ol>
      {onEdit && (
        <div className="tl-q-actions">
          <button className="tl-link" onClick={() => onEdit(q)}>✏️ Editar</button>
          <button className="tl-link" onClick={() => onToggle(q)}>{q.active === false ? "✅ Activar" : "⏸️ Desactivar"}</button>
          <button className="tl-link danger" onClick={() => onDelete(q)}>🗑️ Borrar</button>
        </div>
      )}
    </div>
  );
}

export function QuestionBankPage({ goHome }) {
  const [data, setData] = useState(null); // { levels, max, mine, official }
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [form, setForm] = useState(VACIA);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("mine");

  const cargar = () =>
    api
      .questionBank()
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    cargar();
  }, []);

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));
  const setOpcion = (i, v) => setForm((f) => ({ ...f, options: f.options.map((o, j) => (j === i ? v : o)) }));
  const quitarOpcion = (i) =>
    setForm((f) => {
      const options = f.options.filter((_, j) => j !== i);
      let answerIndex = f.answerIndex;
      if (i === answerIndex) answerIndex = 0;
      else if (i < answerIndex) answerIndex -= 1;
      return { ...f, options, answerIndex };
    });
  const agregarOpcion = () => setForm((f) => (f.options.length < 4 ? { ...f, options: [...f.options, ""] } : f));

  function limpiar() {
    setForm(VACIA);
    setEditId(null);
  }

  async function guardar() {
    setError("");
    setOk("");
    // Quitamos las opciones vacías del final y recalculamos cuál es la correcta
    const llenas = form.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
    const nueva = llenas.findIndex((x) => x.i === form.answerIndex);
    const payload = { ...form, options: llenas.map((x) => x.o), answerIndex: nueva };
    if (nueva < 0) return setError("La opción marcada como correcta está vacía. Escríbela o marca otra.");
    setSaving(true);
    try {
      if (editId) await api.questionUpdate(editId, payload);
      else await api.questionCreate(payload);
      setOk(editId ? "Pregunta actualizada." : "¡Pregunta guardada! Ya saldrá en tus partidas de Ludo.");
      limpiar();
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function editar(q) {
    const opciones = [...q.options];
    while (opciones.length < 2) opciones.push("");
    setForm({ topic: q.topic, level: q.level, question: q.question, options: opciones, answerIndex: q.answerIndex });
    setEditId(q.id);
    setError("");
    setOk("");
    setTab("mine");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function alternar(q) {
    setError("");
    setOk("");
    try {
      await api.questionActive(q.id, q.active === false);
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function borrar(q) {
    if (!window.confirm("¿Borrar esta pregunta? No se puede deshacer.")) return;
    setError("");
    setOk("");
    try {
      await api.questionDelete(q.id);
      if (editId === q.id) limpiar();
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const niveles = data?.levels || ["Comprensión", "Aplicación", "Análisis", "Pensamiento Crítico"];
  return (
    <div className="app tl-page">
      <header className="ref-topbar">
        <Brand subtitle="Mis preguntas" onClick={goHome} />
      </header>
      <main className="tl-main">
        <button className="tl-back" onClick={goHome}>← Volver al inicio</button>
        <h1 className="tl-title">📚 Mis preguntas</h1>
        <p className="tl-sub">
          Crea tus propias preguntas de opción múltiple. En tus partidas de Ludo se usan junto con el banco oficial.
          Las preguntas oficiales no se pueden editar.
        </p>
        {error && <div className="tl-error">{error}</div>}
        {ok && <div className="tl-ok">{ok}</div>}

        <section className="tl-box tl-form" style={{ marginBottom: 16 }}>
          <h2>{editId ? "✏️ Editar pregunta" : "➕ Nueva pregunta"}</h2>
          <label>Tema</label>
          <input type="text" maxLength={60} value={form.topic} onChange={(e) => set("topic", e.target.value)} placeholder="Ej.: Revolución Industrial" />
          <label>Nivel</label>
          <select value={form.level} onChange={(e) => set("level", e.target.value)}>
            {niveles.map((n) => <option key={n}>{n}</option>)}
          </select>
          <label>Pregunta</label>
          <textarea maxLength={300} value={form.question} onChange={(e) => set("question", e.target.value)} placeholder="Escribe la pregunta…" />
          <label>Opciones (marca la correcta)</label>
          {form.options.map((o, i) => (
            <div className="tl-opt" key={i}>
              <input type="radio" name="correcta" checked={form.answerIndex === i} onChange={() => set("answerIndex", i)} aria-label={`Opción ${LETRAS[i]} correcta`} />
              <input type="text" maxLength={120} value={o} onChange={(e) => setOpcion(i, e.target.value)} placeholder={`Opción ${LETRAS[i]}`} />
              {form.options.length > 2 ? <button className="tl-x" onClick={() => quitarOpcion(i)} title="Quitar opción">×</button> : <span />}
            </div>
          ))}
          {form.options.length < 4 && <button className="tl-link" onClick={agregarOpcion}>+ Agregar otra opción</button>}
          <div className="tl-actions">
            <button className="tl-btn orange" disabled={saving} onClick={guardar}>{saving ? "Guardando…" : editId ? "Guardar cambios" : "Guardar pregunta"}</button>
            {(editId || form.question || form.topic) && <button className="tl-btn ghost" onClick={limpiar}>Cancelar</button>}
          </div>
        </section>

        <div className="tl-tabs">
          <button className={"tl-tab" + (tab === "mine" ? " on" : "")} onClick={() => setTab("mine")}>Mis preguntas ({data?.mine.length ?? 0})</button>
          <button className={"tl-tab" + (tab === "official" ? " on" : "")} onClick={() => setTab("official")}>Banco oficial ({data?.official.length ?? 0})</button>
        </div>

        <section className="tl-box">
          {!data && !error && <div className="tl-loading">Cargando…</div>}
          {data && tab === "mine" && (data.mine.length === 0 ? (
            <p className="tl-empty">Aún no has creado preguntas. Usa el formulario de arriba (máximo {data.max}).</p>
          ) : (
            data.mine.map((q) => <PreguntaItem key={q.id} q={q} onEdit={editar} onToggle={alternar} onDelete={borrar} />)
          ))}
          {data && tab === "official" && data.official.map((q) => <PreguntaItem key={q.id} q={q} />)}
        </section>
      </main>
    </div>
  );
}
