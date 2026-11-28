import React, { useEffect, useState } from "react";
import { api, setToken } from "./api";
import { reconnectSocket } from "./socket";
import { TwoFactorSettings } from "./TwoFactorSettings";
import { Button, Card, Chip, Empty, Field, Grid, Input, Loading, Notice, StatCard, StatGrid } from "./ui";
import "./tools.css";
import type { SinTipo } from "./tipos";
import type { ErrorApi } from "./api";
import type { ReactNode } from "react";

const fecha = (v) => {
  try {
    return new Date(v).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
};

// Mensaje { tipo: "ok" | "error", texto } -> aviso
const Mensaje = ({ msg }: { msg: SinTipo }) => <Notice tone={msg.tipo === "ok" ? "ok" : "error"}>{msg.texto}</Notice>;
const Acciones = ({ children }: { children: ReactNode }) => <div className="ui-actions">{children}</div>;

// ------------------------- editar datos -------------------------
function EditarDatos({ user, onUserUpdate }: { user: SinTipo; onUserUpdate: SinTipo }) {
  const [nombre, setNombre] = useState(user.name);
  const [msg, setMsg] = useState({ tipo: "", texto: "" });
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setMsg({ tipo: "", texto: "" });
    setGuardando(true);
    try {
      const { user: u } = await api.profileName(nombre);
      onUserUpdate(u);
      setMsg({ tipo: "ok", texto: "Nombre actualizado." });
    } catch (e) {
      setMsg({ tipo: "error", texto: (e as ErrorApi).message });
    } finally {
      setGuardando(false);
    }
  }
  return (
    <Card title="Mis datos">
      <Mensaje msg={msg} />
      <Field label="Nombre" htmlFor="pf-nombre">
        <Input id="pf-nombre" type="text" maxLength={40} value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </Field>
      <Field label="Correo" htmlFor="pf-correo" hint="El correo no se puede cambiar.">
        <Input id="pf-correo" type="text" value={user.email} disabled />
      </Field>
      <Acciones>
        <Button disabled={guardando || nombre.trim() === user.name} onClick={guardar}>
          {guardando ? "Guardando…" : "Guardar nombre"}
        </Button>
      </Acciones>
    </Card>
  );
}

// ------------------------- cambiar / crear contraseña -------------------------
// Cuenta con contraseña: pide la actual. Cuenta creada con Google: se crea con un enlace que llega al correo.
function CrearClavePorCorreo({ user }: { user: SinTipo }) {
  const [msg, setMsg] = useState({ tipo: "", texto: "" });
  const [enviando, setEnviando] = useState(false);
  async function pedirEnlace() {
    setEnviando(true);
    setMsg({ tipo: "", texto: "" });
    try {
      const r = await api.passwordLink();
      setMsg({ tipo: "ok", texto: r.message });
    } catch (e) {
      setMsg({ tipo: "error", texto: (e as ErrorApi).message });
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Card title="Crear contraseña">
      <p className="ui-text">
        Tu cuenta entra con Google. Si quieres entrar también con tu correo y una contraseña, te enviamos un enlace a{" "}
        <b>{user.email}</b> para crearla.
      </p>
      <Mensaje msg={msg} />
      <Acciones>
        <Button disabled={enviando} onClick={pedirEnlace}>
          {enviando ? "Enviando…" : "Enviar enlace a mi correo"}
        </Button>
      </Acciones>
    </Card>
  );
}

function CambiarClave({ user, onUserUpdate }: { user: SinTipo; onUserUpdate: SinTipo }) {
  const sinClave = user.hasPassword === false;
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [msg, setMsg] = useState({ tipo: "", texto: "" });
  const [guardando, setGuardando] = useState(false);
  // Cuenta creada con Google (sin contraseña): se crea con un enlace al correo. Va después de los hooks.
  if (sinClave) return <CrearClavePorCorreo user={user} />;

  async function guardar() {
    setMsg({ tipo: "", texto: "" });
    if (nueva !== repetir) return setMsg({ tipo: "error", texto: "Las contraseñas nuevas no coinciden." });
    setGuardando(true);
    try {
      const r = await api.profilePassword(actual, nueva);
      if (r.token) {
        setToken(r.token);
        reconnectSocket();
      } // las demás sesiones se cierran; esta sigue activa
      if (r.user) onUserUpdate?.({ ...user, ...r.user });
      setActual("");
      setNueva("");
      setRepetir("");
      setMsg({ tipo: "ok", texto: "Contraseña cambiada." });
    } catch (e) {
      setMsg({ tipo: "error", texto: (e as ErrorApi).message });
    } finally {
      setGuardando(false);
    }
  }
  return (
    <Card title="Cambiar contraseña">
      <Mensaje msg={msg} />
      <Field label="Contraseña actual" htmlFor="pf-actual">
        <Input
          id="pf-actual"
          type="password"
          autoComplete="current-password"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
        />
      </Field>
      <Field label="Contraseña nueva" htmlFor="pf-nueva" hint="Mínimo 8 caracteres, con letras y números.">
        <Input
          id="pf-nueva"
          type="password"
          autoComplete="new-password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
        />
      </Field>
      <Field label="Repite la contraseña nueva" htmlFor="pf-repetir">
        <Input
          id="pf-repetir"
          type="password"
          autoComplete="new-password"
          value={repetir}
          onChange={(e) => setRepetir(e.target.value)}
        />
      </Field>
      <Acciones>
        <Button disabled={guardando || !actual || !nueva} onClick={guardar}>
          {guardando ? "Guardando…" : "Cambiar contraseña"}
        </Button>
      </Acciones>
    </Card>
  );
}

// ------------------------- verificar correo -------------------------
// Solo aparece si el correo aún no se confirmó (cuentas creadas con contraseña).
function VerificarCorreo({ user }: { user: SinTipo }) {
  const [msg, setMsg] = useState({ tipo: "", texto: "" });
  const [enviando, setEnviando] = useState(false);
  if (user.emailVerified !== false) return null;
  async function reenviar() {
    setEnviando(true);
    setMsg({ tipo: "", texto: "" });
    try {
      const r = await api.resendVerification();
      setMsg({ tipo: "ok", texto: r.message });
    } catch (e) {
      setMsg({ tipo: "error", texto: (e as ErrorApi).message });
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Card title="Confirma tu correo">
      <p className="ui-text">
        Enviamos un enlace a <strong>{user.email}</strong>. Confírmalo para proteger tu cuenta y poder recuperarla.
      </p>
      <Mensaje msg={msg} />
      <Acciones>
        <Button disabled={enviando} onClick={reenviar}>
          {enviando ? "Enviando…" : "Reenviar enlace"}
        </Button>
      </Acciones>
    </Card>
  );
}

// ------------------------- sesiones abiertas -------------------------
function Sesiones() {
  const [msg, setMsg] = useState({ tipo: "", texto: "" });
  const [cerrando, setCerrando] = useState(false);
  async function cerrarTodas() {
    setCerrando(true);
    setMsg({ tipo: "", texto: "" });
    try {
      const r = await api.logoutAll();
      if (r.token) {
        setToken(r.token);
        reconnectSocket();
      } // esta sesión sigue; las demás dejan de servir
      setMsg({ tipo: "ok", texto: "Se cerró la sesión en todos los demás dispositivos." });
    } catch (e) {
      setMsg({ tipo: "error", texto: (e as ErrorApi).message });
    } finally {
      setCerrando(false);
    }
  }
  return (
    <Card title="Sesiones abiertas">
      <p className="ui-text">
        ¿Entraste desde un computador compartido o sospechas que alguien usa tu cuenta? Cierra la sesión en todos los
        demás dispositivos.
      </p>
      <Mensaje msg={msg} />
      <Acciones>
        <Button variant="ghost" disabled={cerrando} onClick={cerrarTodas}>
          {cerrando ? "Cerrando…" : "Cerrar las demás sesiones"}
        </Button>
      </Acciones>
    </Card>
  );
}

// ------------------------- ranking -------------------------
function Ranking() {
  const [r, setR] = useState<SinTipo>(null);
  useEffect(() => {
    api
      .profileRanking()
      .then(setR)
      .catch(() => setR({ total: 0, top: [], me: null }));
  }, []);
  if (!r)
    return (
      <Card title="Ranking de estudiantes">
        <Loading />
      </Card>
    );
  const meFuera = r.me && !r.top.some((f) => f.me);
  const fila = (f) => (
    <tr key={f.position} className={f.me ? "pfl-me" : ""}>
      <td>
        <span className={"pfl-pos" + (f.position <= 3 ? ` p${f.position}` : "")}>{f.position}</span>
      </td>
      <td>
        <b>{f.name}</b>
        {f.me ? " (tú)" : ""}
      </td>
      <td className="num">{f.won}</td>
      <td className="num">{f.played}</td>
      <td className="num">
        <b>{f.points}</b>
      </td>
    </tr>
  );
  return (
    <Card title="Ranking de estudiantes">
      {r.top.length === 0 ? (
        <Empty>
          Todavía no hay estudiantes en el ranking. Termina una partida con tu cuenta iniciada para aparecer.
        </Empty>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="pfl-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Estudiante</th>
                <th className="num">Victorias</th>
                <th className="num">Partidas</th>
                <th className="num">Puntos</th>
              </tr>
            </thead>
            <tbody>
              {r.top.map(fila)}
              {meFuera && (
                <>
                  <tr>
                    <td colSpan={5} className="pfl-gap">
                      ⋯
                    </td>
                  </tr>
                  {fila(r.me)}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="pfl-note">
        Puntos = 10 por victoria + 2 por partida terminada. Solo cuentan partidas jugadas con tu cuenta iniciada.
      </p>
    </Card>
  );
}

// ------------------------- página -------------------------
export function ProfilePage({
  user,
  onUserUpdate,
  onOpenStats,
  onOpenQuestions,
}: {
  user?: SinTipo;
  onUserUpdate?: SinTipo;
  onOpenStats?: SinTipo;
  onOpenQuestions?: SinTipo;
}) {
  const [data, setData] = useState<SinTipo>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .profile()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const esDocente = user.role === "docente";
  const d = data?.docente;
  const e = data?.estudiante;
  const total = e ? e.correct + e.incorrect : 0;

  return (
    <>
      <Notice tone="error">{error}</Notice>

      <div className="pfl-head">
        <div className="pfl-avatar">{user.name.trim().charAt(0).toUpperCase()}</div>
        <div className="pfl-info">
          <h1>{user.name}</h1>
          <p>{user.email}</p>
          <p>
            <Chip tone={esDocente ? "accent" : "warn"}>{esDocente ? "Docente" : "Estudiante"}</Chip>
            {data?.user.created_at && <span className="pfl-desde">Miembro desde {fecha(data.user.created_at)}</span>}
          </p>
        </div>
        {e && (
          <div className="pfl-rank">
            <span>MI POSICIÓN</span>
            <strong>{e.rank ? `#${e.rank}` : "—"}</strong>
            <small>{e.rank ? `de ${e.totalRanked} estudiantes` : "juega para entrar"}</small>
          </div>
        )}
      </div>

      {!data && !error && <Loading />}

      {d && (
        <>
          <StatGrid>
            <StatCard label="Partidas de Ludo" value={d.ludoGames} />
            <StatCard label="Crucigramas" value={d.crosswordGames} />
            <StatCard label="Mis preguntas" value={d.questions} />
            <StatCard label="Estudiantes con cuenta" value={d.students} note="que jugaron en tus partidas" />
          </StatGrid>
          <Acciones>
            <Button variant="ghost" onClick={onOpenStats}>
              Ver mis estadísticas
            </Button>
            <Button variant="ghost" onClick={onOpenQuestions}>
              Mis preguntas
            </Button>
          </Acciones>
        </>
      )}

      {e && (
        <>
          <StatGrid>
            <StatCard label="Puntos" value={e.points} note="10 por victoria + 2 por partida" />
            <StatCard label="Victorias" value={e.won} />
            <StatCard label="Partidas terminadas" value={e.played} />
            <StatCard
              label="Precisión (Ludo)"
              value={total ? `${Math.round((e.correct / total) * 100)}%` : "—"}
              note={total ? `${e.correct} de ${total} respuestas` : ""}
            />
          </StatGrid>
          <Card title={`Mis logros (${e.badges.filter((b) => b.unlocked).length}/${e.badges.length})`}>
            <div className="pfl-badges">
              {e.badges.map((b) => (
                <div key={b.id} className={"pfl-badge " + (b.unlocked ? "on" : "off")}>
                  <i>{b.icon}</i>
                  <span>
                    <b>{b.name}</b>
                    <small>{b.desc}</small>
                  </span>
                </div>
              ))}
            </div>
          </Card>
          <Acciones>
            <Button variant="ghost" onClick={onOpenStats}>
              Ver mi historial de partidas
            </Button>
          </Acciones>
          <Ranking />
        </>
      )}

      <Grid className="pfl-forms">
        <EditarDatos user={user} onUserUpdate={onUserUpdate} />
        <VerificarCorreo user={user} />
        <CambiarClave user={user} onUserUpdate={onUserUpdate} />
        <TwoFactorSettings user={user} onUserUpdate={onUserUpdate} />
        <Sesiones />
      </Grid>
    </>
  );
}
