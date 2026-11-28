import React, { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Icono } from "../campusUi";
import { Tile, Button } from "../ui";
import type { SinTipo } from "../tipos";
import type { ErrorApi } from "../api";

// ============================================================================
// MIS CLASES — lista y detalle (diseño "Campus", ver campus.css)
// ============================================================================
// Docente: crea clases (curso + sección), comparte el código de la clase, ve a sus
// estudiantes y lanza actividades que quedan asociadas a la clase.
// Estudiante: se inscribe con el código de la clase y entra a lo que esté en vivo.
//
// Props:
//   user                       sesión actual
//   onLanzar(clase, juegoId)   el docente abre un juego para crear la partida en esa clase
//   onEntrar(actividad)        el estudiante entra a una actividad en vivo ({ kind, code })
// ============================================================================

export const TIPOS = {
  ludo: { nombre: "Ludo por equipos", icono: Icono.ludo },
  crucigrama: { nombre: "Crucigrama relámpago", icono: Icono.crucigrama },
  evaluacion: { nombre: "Evaluación rápida", icono: Icono.evaluacion },
  estudio: { nombre: "Presentaciones en vivo", icono: Icono.estudio },
  palabra: { nombre: "Palabra relámpago", icono: Icono.palabra },
};
const LANZABLES = ["ludo", "crucigrama", "palabra", "evaluacion", "estudio"];
const REFRESCO_MS = 15000; // cada cuánto se revisa qué está en vivo

const fecha = (v) => {
  try {
    return new Date(v).toLocaleDateString("es", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
};
const codigoBonito = (c) => (c && c.length === 6 ? `${c.slice(0, 3)} ${c.slice(3)}` : c);

// Vuelve a pedir los datos cada cierto tiempo, solo con la pestaña visible.
function useRefresco(cargar: (silencioso?: boolean | undefined) => Promise<false | void>, deps) {
  useEffect(() => {
    cargar();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") cargar(true);
    }, REFRESCO_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function Aviso({ msg }: { msg: SinTipo }) {
  if (!msg?.texto) return null;
  return (
    <p className={msg.tipo === "ok" ? "cp-msg ok" : "cp-msg error"} role={msg.tipo === "ok" ? "status" : "alert"}>
      {msg.texto}
    </p>
  );
}

function EnVivo({ actividades, esDocente, onEntrar }: { actividades: SinTipo; esDocente: boolean; onEntrar: SinTipo }) {
  if (!actividades?.length) return null;
  return (
    <div className="cp-livelist">
      {actividades.map((a) => {
        const t = TIPOS[a.kind] || { nombre: a.kind };
        return (
          <div className="cp-band cp-band-live" key={a.kind + a.code}>
            <div>
              <span className="cp-live">En vivo</span>
              <h3>
                {t.nombre} · {a.name}
              </h3>
              <p>
                {a.clase ? `${a.clase} · ` : ""}Código <b className="cp-code-inline">{codigoBonito(a.code)}</b> ·{" "}
                {a.players} {a.players === 1 ? "conectado" : "conectados"}
                {a.status === "lobby" ? " · en sala de espera" : ""}
              </p>
            </div>
            {!esDocente && <Button onClick={() => onEntrar(a)}>Entrar</Button>}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// LISTA
// ============================================================================
function Lista({ user, onAbrir, onEntrar }: { user: SinTipo; onAbrir: SinTipo; onEntrar: SinTipo }) {
  const esDocente = user.role === "docente";
  const [clases, setClases] = useState<SinTipo>(null);
  const [msg, setMsg] = useState<SinTipo>({});
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [seccion, setSeccion] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(
    (silencioso?: boolean) =>
      api
        .classes()
        .then((r) => setClases(r.classes))
        .catch((e) => !silencioso && setMsg({ tipo: "error", texto: e.message })),
    [],
  );
  useRefresco(cargar, []);

  async function crear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOcupado(true);
    setMsg({});
    try {
      const r = await api.classCreate(nombre, seccion);
      setNombre("");
      setSeccion("");
      setCreando(false);
      await cargar();
      onAbrir(r.class.id);
    } catch (err) {
      setMsg({ tipo: "error", texto: (err as ErrorApi).message });
    } finally {
      setOcupado(false);
    }
  }

  async function unirse(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOcupado(true);
    setMsg({});
    try {
      const r = await api.classJoin(codigo);
      setCodigo("");
      setMsg({ tipo: "ok", texto: `Te uniste a ${r.class.name}.` });
      await cargar();
    } catch (err) {
      setMsg({ tipo: "error", texto: (err as ErrorApi).message });
    } finally {
      setOcupado(false);
    }
  }

  // "Eliminar" archiva la clase en el servidor: deja de listarse y su código deja de servir,
  // pero las partidas ya jugadas se conservan en las estadísticas del docente.
  async function eliminar(c) {
    if (
      !window.confirm(
        `¿Eliminar «${c.name}»? Dejará de aparecer en tus clases y su código ya no servirá. Las partidas jugadas se conservan en tus estadísticas.`,
      )
    )
      return;
    setMsg({});
    try {
      await api.classArchive(c.id);
      setMsg({ tipo: "ok", texto: `La clase «${c.name}» se eliminó.` });
      await cargar();
    } catch (err) {
      setMsg({ tipo: "error", texto: (err as ErrorApi).message });
    }
  }

  const enVivo = (clases || []).flatMap((c) => c.live.map((a) => ({ ...a, clase: c.name })));

  return (
    <div className="cp cp-home">
      <div className="cp-pagehead">
        <div>
          <span className="cp-eyebrow">{esDocente ? "Docente" : "Estudiante"}</span>
          <h1>Mis clases</h1>
          <p>
            {esDocente
              ? "Cada clase agrupa a tus estudiantes y guarda las actividades que lanzas en ella."
              : "Las clases en las que estás inscrito. Cuando tu docente abre una actividad, aparece aquí."}
          </p>
        </div>
        {esDocente && !creando && <Button onClick={() => setCreando(true)}>+ Nueva clase</Button>}
      </div>

      <Aviso msg={msg} />

      {esDocente && creando && (
        <form className="cp-card cp-panel cp-form" onSubmit={crear}>
          <h2>Nueva clase</h2>
          <div className="cp-form-row">
            <label>
              Nombre del curso
              <input
                className="cp-input"
                value={nombre}
                maxLength={80}
                required
                placeholder="Ej. Cálculo Diferencial"
                onChange={(e) => setNombre(e.target.value)}
              />
            </label>
            <label>
              Sección (opcional)
              <input
                className="cp-input"
                value={seccion}
                maxLength={40}
                placeholder="Ej. Sección B"
                onChange={(e) => setSeccion(e.target.value)}
              />
            </label>
          </div>
          <div className="cp-join">
            <Button type="submit" disabled={ocupado || !nombre.trim()}>
              {ocupado ? "Creando…" : "Crear clase"}
            </Button>
            <Button variant="quiet" onClick={() => setCreando(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {!esDocente && (
        <form className="cp-card cp-panel cp-form" onSubmit={unirse}>
          <h2>Unirme a una clase</h2>
          <p>Pide a tu docente el código de la clase (6 letras y números). Es distinto del código de cada partida.</p>
          <label htmlFor="cp-class-code" className="cp-sr">
            Código de la clase
          </label>
          <div className="cp-join">
            <input
              id="cp-class-code"
              className="cp-input code"
              value={codigo}
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="ABC123"
              onChange={(e) =>
                setCodigo(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 6),
                )
              }
            />
            <Button type="submit" disabled={ocupado || codigo.length !== 6}>
              {ocupado ? "Uniendo…" : "Unirme"}
            </Button>
          </div>
        </form>
      )}

      {!esDocente && enVivo.length > 0 && (
        <section aria-labelledby="cp-vivo-t">
          <h2 id="cp-vivo-t" className="cp-sec-title">
            Ahora en tus clases
          </h2>
          <EnVivo actividades={enVivo} esDocente={false} onEntrar={onEntrar} />
        </section>
      )}

      <section aria-labelledby="cp-lista-t">
        <h2 id="cp-lista-t" className="cp-sec-title">
          {esDocente ? "Clases activas" : "Inscrito en"}
        </h2>
        {clases === null ? (
          <p className="cp-muted">Cargando…</p>
        ) : clases.length === 0 ? (
          <div className="cp-card cp-panel cp-empty con-condor">
            <img className="cp-condor" src="/condor-256.png" alt="" aria-hidden="true" width="256" height="256" />
            <p>
              {esDocente
                ? "Todavía no tienes clases. Crea la primera para compartir su código con tus estudiantes."
                : "Aún no estás inscrito en ninguna clase."}
            </p>
          </div>
        ) : (
          <div className="cp-tiles">
            {clases.map((c) => (
              <div className="cp-tile-wrap" key={c.id}>
                <button
                  type="button"
                  className={"cp-tile" + (c.live.length ? " is-live" : "")}
                  onClick={() => onAbrir(c.id)}
                >
                  <span className="cp-tile-top">
                    <span className="cp-chip accent">{esDocente ? codigoBonito(c.code) : c.section || "Clase"}</span>
                    {c.live.length > 0 && <span className="cp-live">En vivo</span>}
                  </span>
                  <strong>{c.name}</strong>
                  <p>
                    {esDocente ? c.section || "Sin sección" : `Prof. ${c.teacher}${c.section ? ` · ${c.section}` : ""}`}
                  </p>
                  {esDocente && (
                    <span className="cp-tile-meta">
                      <span>
                        {c.members} {c.members === 1 ? "estudiante" : "estudiantes"}
                      </span>
                      <span>
                        {c.activities} {c.activities === 1 ? "actividad" : "actividades"}
                      </span>
                    </span>
                  )}
                </button>
                {esDocente && (
                  <button
                    type="button"
                    className="cp-btn quiet sm danger cp-tile-delete"
                    onClick={() => eliminar(c)}
                    aria-label={`Eliminar la clase ${c.name}`}
                  >
                    Eliminar clase
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ============================================================================
// DETALLE
// ============================================================================
function Detalle({
  user,
  id,
  onVolver,
  onLanzar,
  onEntrar,
}: {
  user: SinTipo;
  id: SinTipo;
  onVolver: SinTipo;
  onLanzar: SinTipo;
  onEntrar: SinTipo;
}) {
  const esDocente = user.role === "docente";
  const [clase, setClase] = useState<SinTipo>(null);
  const [msg, setMsg] = useState<SinTipo>({});
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [seccion, setSeccion] = useState("");

  const cargar = useCallback(
    (silencioso?: boolean) =>
      api
        .classGet(id)
        .then((r) => setClase(r.class))
        .catch((e) => !silencioso && setMsg({ tipo: "error", texto: e.message })),
    [id],
  );
  useRefresco(cargar, [id]);

  // Devuelve true si salió bien (así "Archivar" o "Salir" solo vuelven a la lista si funcionó).
  const accion = async (fn, ok: string | null, { recargar = true } = {}) => {
    setMsg({});
    try {
      await fn();
      if (ok) setMsg({ tipo: "ok", texto: ok });
      if (recargar) await cargar(true);
      return true;
    } catch (e) {
      setMsg({ tipo: "error", texto: (e as ErrorApi).message });
      return false;
    }
  };

  if (!clase) {
    return (
      <div className="cp cp-home">
        <button type="button" className="cp-back" onClick={onVolver}>
          ← Mis clases
        </button>
        <Aviso msg={msg} />
        {!msg.texto && <p className="cp-muted">Cargando…</p>}
      </div>
    );
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(clase.code);
      setMsg({ tipo: "ok", texto: "Código copiado." });
    } catch {
      setMsg({ tipo: "error", texto: "No se pudo copiar; escríbelo a mano." });
    }
  };

  return (
    <div className="cp cp-home">
      <button type="button" className="cp-back" onClick={onVolver}>
        ← Mis clases
      </button>

      <div className="cp-pagehead">
        <div>
          <span className="cp-eyebrow">
            {clase.section || "Clase"}
            {!esDocente ? ` · Prof. ${clase.teacher}` : ""}
          </span>
          {editando ? (
            <form
              className="cp-form-row"
              onSubmit={(e) => {
                e.preventDefault();
                accion(() => api.classUpdate(clase.id, { name: nombre, section: seccion }), "Clase actualizada.").then(
                  (bien) => bien && setEditando(false),
                );
              }}
            >
              <label>
                Nombre
                <input
                  className="cp-input"
                  value={nombre}
                  maxLength={80}
                  required
                  onChange={(e) => setNombre(e.target.value)}
                />
              </label>
              <label>
                Sección
                <input
                  className="cp-input"
                  value={seccion}
                  maxLength={40}
                  onChange={(e) => setSeccion(e.target.value)}
                />
              </label>
              <div className="cp-join" style={{ alignSelf: "flex-end" }}>
                <Button type="submit">Guardar</Button>
                <Button variant="quiet" onClick={() => setEditando(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <h1>{clase.name}</h1>
          )}
        </div>
        {esDocente && !editando && (
          <Button
            variant="ghost"

            onClick={() => {
              setNombre(clase.name);
              setSeccion(clase.section);
              setEditando(true);
            }}
          >
            Editar
          </Button>
        )}
      </div>

      <Aviso msg={msg} />

      {esDocente && (
        <section className="cp-card cp-panel cp-classcode" aria-labelledby="cp-cc-t">
          <div>
            <h2 id="cp-cc-t">Código de la clase</h2>
            <p>
              Compártelo con tus estudiantes: lo escriben en <b>Mis clases → Unirme a una clase</b>.
            </p>
          </div>
          <strong className="cp-code-big">{codigoBonito(clase.code)}</strong>
          <div className="cp-join">
            <Button variant="ghost" onClick={copiar}>
              Copiar
            </Button>
            <Button
              variant="quiet"

              onClick={() =>
                window.confirm(
                  "¿Generar un código nuevo? El anterior dejará de servir para inscribirse (los estudiantes ya inscritos siguen en la clase).",
                ) && accion(() => api.classNewCode(clase.id), "Código nuevo generado.")
              }
            >
              Generar otro
            </Button>
          </div>
        </section>
      )}

      {clase.live.length > 0 && (
        <section aria-labelledby="cp-dv-t">
          <h2 id="cp-dv-t" className="cp-sec-title">
            En vivo ahora
          </h2>
          <EnVivo actividades={clase.live} esDocente={esDocente} onEntrar={onEntrar} />
        </section>
      )}

      {esDocente && (
        <section aria-labelledby="cp-lz-t">
          <h2 id="cp-lz-t" className="cp-sec-title">
            Lanzar una actividad en esta clase
          </h2>
          <div className="cp-tiles">
            {LANZABLES.map((k) => {
              const t = TIPOS[k];
              const Ico = t.icono;
              return (
                <Tile
                  key={k}
                  tono={k}
                  icon={Ico}
                  title={t.nombre}
                  cta={`Crear en ${clase.name}`}
                  onClick={() => onLanzar(clase, k)}
                />
              );
            })}
          </div>
        </section>
      )}

      {!esDocente && clase.live.length === 0 && (
        <div className="cp-card cp-panel cp-empty">
          <p>No hay ninguna actividad abierta en esta clase ahora mismo. Esta página se actualiza sola.</p>
        </div>
      )}

      <div className="cp-split">
        {esDocente && (
          <section className="cp-card cp-panel" aria-labelledby="cp-est-t">
            <h2 id="cp-est-t">Estudiantes ({clase.members.length})</h2>
            {clase.members.length === 0 ? (
              <p>Aún no se inscribe nadie. Comparte el código de la clase.</p>
            ) : (
              <ul className="cp-rows">
                {clase.members.map((m) => (
                  <li key={m.id}>
                    <span className="cp-avatar" aria-hidden="true">
                      {m.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="cp-rows-main">
                      <strong>{m.name}</strong>
                      <small>Desde el {fecha(m.joinedAt)}</small>
                    </span>
                    <Button
                      variant="quiet"
                      size="sm"

                      onClick={() =>
                        window.confirm(`¿Quitar a ${m.name} de la clase?`) &&
                        accion(() => api.classRemoveMember(clase.id, m.id), `${m.name} ya no está en la clase.`)
                      }
                    >
                      Quitar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="cp-card cp-panel" aria-labelledby="cp-hist-t">
          <h2 id="cp-hist-t">Actividades de la clase</h2>
          {clase.history.length === 0 ? (
            <p>
              {esDocente
                ? "Las partidas de Ludo y Crucigrama que lances desde aquí aparecerán en esta lista."
                : "Todavía no hay actividades guardadas en esta clase."}
            </p>
          ) : (
            <ul className="cp-rows">
              {clase.history.map((h, i) => {
                const t = TIPOS[h.kind] || { nombre: h.kind, icono: Icono.juegos };
                const Ico = t.icono;
                return (
                  <li key={i}>
                    <span className={`cp-ico sm tono-${h.kind}`}>
                      <Ico />
                    </span>
                    <span className="cp-rows-main">
                      <strong>{h.name}</strong>
                      <small>
                        {t.nombre} · {fecha(h.createdAt)}
                      </small>
                    </span>
                    <span className="cp-rows-end">
                      {h.players} {h.players === 1 ? "jugador" : "jugadores"}
                      {h.status === "open" ? " · abierta" : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="cp-danger-zone">
        {esDocente ? (
          <button
            type="button"
            className="cp-btn ghost danger"
            onClick={() =>
              window.confirm(
                `¿Eliminar «${clase.name}»? Dejará de aparecer en tus clases y su código ya no servirá. Las partidas jugadas se conservan en tus estadísticas.`,
              ) &&
              accion(() => api.classArchive(clase.id), null, { recargar: false }).then((bien) => bien && onVolver())
            }
          >
            Eliminar clase
          </button>
        ) : (
          <button
            type="button"
            className="cp-btn ghost danger"
            onClick={() =>
              window.confirm(`¿Salir de «${clase.name}»? Podrás volver con el código de la clase.`) &&
              accion(() => api.classRemoveMember(clase.id, "me"), null, { recargar: false }).then(
                (bien) => bien && onVolver(),
              )
            }
          >
            Salir de la clase
          </button>
        )}
      </div>
    </div>
  );
}

// Con onCambiar, la clase abierta la controla App (así queda en el historial del navegador).
export function ClasesPage({
  user,
  onLanzar,
  onEntrar,
  initialId = null,
  onCambiar,
}: {
  user?: SinTipo;
  onLanzar?: SinTipo;
  onEntrar?: SinTipo;
  initialId?: SinTipo;
  onCambiar?: SinTipo;
}) {
  const [local, setLocal] = useState(initialId);
  useEffect(() => setLocal(initialId), [initialId]);
  const controlado = typeof onCambiar === "function";
  const abierta = controlado ? initialId : local;
  const setAbierta = controlado ? onCambiar : setLocal;
  return abierta ? (
    <Detalle user={user} id={abierta} onVolver={() => setAbierta(null)} onLanzar={onLanzar} onEntrar={onEntrar} />
  ) : (
    <Lista user={user} onAbrir={setAbierta} onEntrar={onEntrar} />
  );
}
