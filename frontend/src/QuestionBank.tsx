import React, { useEffect, useState } from "react";
import { api } from "./api";
import { Button, Card, Chip, Empty, Field, Input, Loading, Notice, PageHeader, Select, Tabs, Textarea } from "./ui";
import "./questionBank.css";
import type { SinTipo } from "./tipos";
import type { ErrorApi } from "./api";

const VACIA = { topic: "", level: "Comprensión", question: "", options: ["", "", "", ""], answerIndex: 0 };
const LETRAS = ["A", "B", "C", "D"];

function PreguntaItem({
  q,
  onEdit,
  onToggle,
  onDelete,
}: {
  q: SinTipo;
  onEdit?: (q: SinTipo) => void;
  onToggle?: (q: SinTipo) => void;
  onDelete?: (q: SinTipo) => void;
}) {
  return (
    <div className={"qb-item" + (q.active === false ? " off" : "")}>
      <div className="qb-chips">
        <Chip tone="accent">{q.topic}</Chip>
        <Chip tone="warn">{q.level}</Chip>
        {q.active === false && <Chip tone="lose">desactivada</Chip>}
      </div>
      <p>{q.question}</p>
      <ol type="A">
        {q.options.map((o, i) => (
          <li key={i} className={i === q.answerIndex ? "right" : ""}>
            {o}
            {i === q.answerIndex ? " · correcta" : ""}
          </li>
        ))}
      </ol>
      {onEdit && (
        <div className="qb-actions">
          <Button variant="quiet" size="sm" onClick={() => onEdit(q)}>
            Editar
          </Button>
          <Button variant="quiet" size="sm" onClick={() => onToggle?.(q)}>
            {q.active === false ? "Activar" : "Desactivar"}
          </Button>
          <Button variant="quiet" size="sm" className="qb-danger" onClick={() => onDelete?.(q)}>
            Borrar
          </Button>
        </div>
      )}
    </div>
  );
}

export function QuestionBankPage() {
  const [data, setData] = useState<SinTipo>(null); // { levels, max, mine, official }
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [form, setForm] = useState(VACIA);
  const [editId, setEditId] = useState<SinTipo>(null);
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

  const set = (campo: string, valor: string | number) => setForm((f) => ({ ...f, [campo]: valor }));
  const setOpcion = (i: number, v: string) =>
    setForm((f) => ({ ...f, options: f.options.map((o, j) => (j === i ? v : o)) }));
  const quitarOpcion = (i: number) =>
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
      setError((e as ErrorApi).message);
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
      setError((e as ErrorApi).message);
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
      setError((e as ErrorApi).message);
    }
  }

  const niveles = data?.levels || ["Comprensión", "Aplicación", "Análisis", "Pensamiento Crítico"];
  return (
    <>
      <PageHeader
        eyebrow="Docente"
        title="Mis preguntas"
        lead="Crea tus propias preguntas de opción múltiple. En tus partidas de Ludo se usan junto con el banco oficial. Las preguntas oficiales no se pueden editar."
      />
      <Notice tone="error">{error}</Notice>
      <Notice tone="ok">{ok}</Notice>

      <Card title={editId ? "Editar pregunta" : "Nueva pregunta"}>
        <Field label="Tema" htmlFor="qb-tema">
          <Input
            id="qb-tema"
            type="text"
            maxLength={60}
            value={form.topic}
            onChange={(e) => set("topic", e.target.value)}
            placeholder="Ej.: Revolución Industrial"
          />
        </Field>
        <Field label="Nivel" htmlFor="qb-nivel">
          <Select id="qb-nivel" value={form.level} onChange={(e) => set("level", e.target.value)}>
            {niveles.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </Select>
        </Field>
        <Field label="Pregunta" htmlFor="qb-pregunta">
          <Textarea
            id="qb-pregunta"
            maxLength={300}
            value={form.question}
            onChange={(e) => set("question", e.target.value)}
            placeholder="Escribe la pregunta…"
          />
        </Field>
        <fieldset className="qb-opciones">
          <legend>Opciones (marca la correcta)</legend>
          {form.options.map((o, i) => (
            <div className="qb-opt" key={i}>
              <input
                type="radio"
                name="correcta"
                checked={form.answerIndex === i}
                onChange={() => set("answerIndex", i)}
                aria-label={`Opción ${LETRAS[i]} correcta`}
              />
              <Input
                type="text"
                maxLength={120}
                value={o}
                onChange={(e) => setOpcion(i, e.target.value)}
                placeholder={`Opción ${LETRAS[i]}`}
                aria-label={`Opción ${LETRAS[i]}`}
              />
              {form.options.length > 2 ? (
                <Button
                  variant="quiet"
                  size="sm"
                  onClick={() => quitarOpcion(i)}
                  aria-label={`Quitar opción ${LETRAS[i]}`}
                >
                  ×
                </Button>
              ) : (
                <span />
              )}
            </div>
          ))}
          {form.options.length < 4 && (
            <Button variant="quiet" size="sm" onClick={agregarOpcion}>
              + Agregar otra opción
            </Button>
          )}
        </fieldset>
        <div className="ui-actions">
          <Button disabled={saving} onClick={guardar}>
            {saving ? "Guardando…" : editId ? "Guardar cambios" : "Guardar pregunta"}
          </Button>
          {(editId || form.question || form.topic) && (
            <Button variant="ghost" onClick={limpiar}>
              Cancelar
            </Button>
          )}
        </div>
      </Card>

      <Tabs
        label="Preguntas"
        value={tab}
        onChange={setTab}
        items={[
          { id: "mine", label: `Mis preguntas (${data?.mine.length ?? 0})` },
          { id: "official", label: `Banco oficial (${data?.official.length ?? 0})` },
        ]}
      />

      <Card>
        {!data && !error && <Loading />}
        {data &&
          tab === "mine" &&
          (data.mine.length === 0 ? (
            <Empty>Aún no has creado preguntas. Usa el formulario de arriba (máximo {data.max}).</Empty>
          ) : (
            data.mine.map((q) => (
              <PreguntaItem key={q.id} q={q} onEdit={editar} onToggle={alternar} onDelete={borrar} />
            ))
          ))}
        {data && tab === "official" && data.official.map((q) => <PreguntaItem key={q.id} q={q} />)}
      </Card>
    </>
  );
}
