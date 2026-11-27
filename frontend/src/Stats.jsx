import React, { useEffect, useState } from "react";
import { api } from "./api";
import { PageHeader, Card, StatCard, StatGrid, Row, Bar, Dot, Chip, Empty, Loading, Notice, Grid } from "./ui";

const COLORES = {
  rojo: { nombre: "Rojo", hex: "#ef4444" },
  verde: { nombre: "Verde", hex: "#10b981" },
  amarillo: { nombre: "Amarillo", hex: "#eab308" },
  azul: { nombre: "Azul", hex: "#3b82f6" },
};

const fecha = (v) => {
  try {
    return new Date(v).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
};

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

const MOTIVOS = {
  goal: "llegó a la meta",
  time: "se acabó el tiempo",
  teacher: "lo cerró el docente",
  completed: "completó el crucigrama",
};

// Estado de una partida en la lista: en curso, con ganador o sin ganador.
const Estado = ({ enCurso, textoEnCurso = "en curso", ganador }) =>
  enCurso ? (
    <Chip tone="warn">{textoEnCurso}</Chip>
  ) : ganador ? (
    <Chip tone="win">{ganador}</Chip>
  ) : (
    <Chip>sin ganador</Chip>
  );

const detallePartida = (g) => (
  <>
    Código {g.code} · {fecha(g.created_at)} · {plural(g.players, "jugador", "jugadores")}
    {g.end_reason ? ` · ${MOTIVOS[g.end_reason]}` : ""}
  </>
);

const Equipo = ({ color }) => (
  <>
    <Dot color={COLORES[color]?.hex} />
    {COLORES[color]?.nombre}
  </>
);

// ------------------------------- DOCENTE -------------------------------
function VistaDocente({ d }) {
  const { ludo, crossword } = d;
  const maxVictorias = Math.max(1, ...Object.values(ludo.winsByColor));
  return (
    <>
      <StatGrid>
        <StatCard label="Partidas de Ludo" value={ludo.total} note={`${ludo.finished} terminadas`} />
        <StatCard label="Crucigramas" value={crossword.total} note={`${crossword.finished} terminados`} />
        <StatCard label="Jugadores en Ludo" value={ludo.players} />
        <StatCard label="Jugadores en Crucigrama" value={crossword.players} />
      </StatGrid>

      <Grid>
        <Card title="Victorias por equipo (Ludo)">
          {Object.keys(ludo.winsByColor).length === 0 ? (
            <Empty>Aún no hay partidas con ganador.</Empty>
          ) : (
            Object.entries(COLORES).map(([k, c]) => {
              const n = ludo.winsByColor[k] || 0;
              return (
                <Row
                  key={k}
                  title={<Equipo color={k} />}
                  end={<b>{n}</b>}
                  bar={<Bar value={(n / maxVictorias) * 100} color={c.hex} />}
                />
              );
            })
          )}
        </Card>

        <Card title="Preguntas que más se fallan">
          {ludo.hardQuestions.length === 0 ? (
            <Empty>Se mostrarán cuando una pregunta se haya jugado al menos 2 veces.</Empty>
          ) : (
            ludo.hardQuestions.map((q) => {
              const nivel = q.pct < 40 ? "bad" : q.pct < 70 ? "mid" : "good";
              const chip = { bad: "lose", mid: "warn", good: "win" }[nivel];
              return (
                <Row
                  key={q.id}
                  title={q.question}
                  detail={`${q.topic} · ${q.correct} de ${q.asked} ${q.asked === 1 ? "acierto" : "aciertos"}`}
                  end={<Chip tone={chip}>{q.pct}%</Chip>}
                  bar={<Bar value={q.pct} tone={nivel} />}
                />
              );
            })
          )}
        </Card>
      </Grid>

      <Grid>
        <Card title="Últimas partidas de Ludo">
          {ludo.recent.length === 0 ? (
            <Empty>Todavía no has creado partidas de Ludo.</Empty>
          ) : (
            ludo.recent.map((g) => (
              <Row
                key={g.code}
                title={g.name}
                detail={detallePartida(g)}
                end={
                  <Estado
                    enCurso={g.phase !== "finished"}
                    ganador={g.winner_team && <Equipo color={g.winner_team} />}
                  />
                }
              />
            ))
          )}
        </Card>

        <Card title="Crucigramas">
          {crossword.recent.length === 0 ? (
            <Empty>Todavía no has creado crucigramas.</Empty>
          ) : (
            crossword.recent.map((g) => (
              <Row
                key={g.code}
                title={g.name}
                detail={detallePartida(g)}
                end={
                  <Estado
                    enCurso={g.status !== "ended"}
                    textoEnCurso={g.status === "playing" ? "en juego" : "en espera"}
                    ganador={g.winner}
                  />
                }
              />
            ))
          )}
          {crossword.top.length > 0 && (
            <>
              <h3>Mejores puntajes</h3>
              {crossword.top.map((p, i) => (
                <Row
                  key={p.name}
                  title={`${i + 1}. ${p.name}`}
                  detail={`${p.games} ${p.games === 1 ? "partida" : "partidas"}`}
                  end={<Chip>{p.best} pts</Chip>}
                />
              ))}
            </>
          )}
        </Card>
      </Grid>
    </>
  );
}

// ------------------------------ ESTUDIANTE ------------------------------
const Final = ({ enCurso, gano }) =>
  enCurso ? <Chip tone="warn">en curso</Chip> : gano ? <Chip tone="win">Ganó</Chip> : <Chip>Terminó</Chip>;

function VistaEstudiante({ d }) {
  const { summary, ludo, crossword } = d;
  const total = summary.correct + summary.incorrect;
  const pct = total ? Math.round((summary.correct / total) * 100) : 0;
  return (
    <>
      <StatGrid>
        <StatCard label="Partidas jugadas" value={summary.played} />
        <StatCard label="Partidas ganadas" value={summary.won} />
        <StatCard label="Aciertos (Ludo)" value={summary.correct} note={`${summary.incorrect} fallos`} />
        <StatCard label="Precisión" value={total ? `${pct}%` : "—"} />
      </StatGrid>
      <Grid>
        <Card title="Mis partidas de Ludo">
          {ludo.length === 0 ? (
            <Empty>Aquí aparecerán las partidas que juegues con tu cuenta iniciada.</Empty>
          ) : (
            ludo.map((g) => (
              <Row
                key={g.code + g.created_at}
                title={g.name}
                detail={
                  <>
                    <Dot color={COLORES[g.team]?.hex} />
                    Equipo {COLORES[g.team]?.nombre} · {plural(g.correct, "acierto", "aciertos")},{" "}
                    {plural(g.incorrect, "fallo", "fallos")} · {fecha(g.created_at)}
                  </>
                }
                end={
                  <Final enCurso={g.phase !== "finished"} gano={g.phase === "finished" && g.winner_team === g.team} />
                }
              />
            ))
          )}
        </Card>
        <Card title="Mis crucigramas">
          {crossword.length === 0 ? (
            <Empty>Aquí aparecerán tus crucigramas jugados con tu cuenta.</Empty>
          ) : (
            crossword.map((g) => (
              <Row
                key={g.code + g.created_at}
                title={g.name}
                detail={`${plural(g.solved_count, "palabra", "palabras")} · ${g.score} pts · ${fecha(g.created_at)}`}
                end={<Final enCurso={g.status !== "ended"} gano={g.won} />}
              />
            ))
          )}
        </Card>
      </Grid>
    </>
  );
}

export function StatsPage({ user }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .stats()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const esDocente = user?.role === "docente";
  return (
    <>
      <PageHeader
        eyebrow={esDocente ? "Docente" : "Estudiante"}
        title={esDocente ? "Estadísticas de tus clases" : "Mis resultados"}
        lead={
          esDocente
            ? "Resumen de las partidas que has creado: quién ganó, cuántos jugaron y qué preguntas cuestan más."
            : "Tu historial de partidas. Solo se guardan las que juegas con tu cuenta iniciada."
        }
      />
      <Notice tone="error">{error}</Notice>
      {!data && !error && <Loading />}
      {data && (data.role === "docente" ? <VistaDocente d={data} /> : <VistaEstudiante d={data} />)}
    </>
  );
}
