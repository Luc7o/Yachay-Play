import React from "react";
import { Button, Card, PageHeader } from "./ui";
import type { ReactNode } from "react";

// Tarjeta informativa: antetítulo opcional, título, texto y un botón.
const Info = ({
  eyebrow,
  title,
  children,
  boton,
  onClick,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  boton: ReactNode;
  onClick: () => void;
}) => (
  <Card className="ip-card">
    {eyebrow && <span className="cp-eyebrow">{eyebrow}</span>}
    <h2>{title}</h2>
    {children}
    <div className="ui-actions">
      <Button onClick={onClick}>{boton}</Button>
    </div>
  </Card>
);

// Páginas informativas: no dependen del backend ni de tarifas inventadas.
export function InfoPage({ page, onNavigate }) {
  if (page === "planes")
    return (
      <>
        <PageHeader
          eyebrow="Planes y acceso"
          title="Aprende jugando con YachayPlay"
          lead="Conoce las opciones de acceso a los juegos y herramientas educativas."
        />
        <div className="ip-cards">
          <Info
            eyebrow="Para empezar"
            title="Tu cuenta YachayPlay"
            boton="Explorar juegos"
            onClick={() => onNavigate("juegos")}
          >
            <p className="ui-text">Participa como estudiante o prepara actividades como docente.</p>
            <ul className="ip-list">
              <li>Juegos educativos interactivos</li>
              <li>Acceso mediante código de partida</li>
              <li>Herramientas y estadísticas disponibles</li>
            </ul>
          </Info>
          <Info
            eyebrow="Información"
            title="Próximas novedades"
            boton="Ver ayuda y contacto"
            onClick={() => onNavigate("contacto")}
          >
            <p className="ui-text">
              No hay planes de pago ni precios publicados en esta versión. Cuando existan, podrán mostrarse aquí con sus
              condiciones verificadas.
            </p>
          </Info>
        </div>
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow="Ayuda y contacto"
        title="¿Cómo podemos ayudarte?"
        lead="Resuelve tus dudas sobre las partidas y la plataforma."
      />
      <div className="ip-cards">
        <Info title="Quiero jugar" boton="Unirme con código" onClick={() => onNavigate("join")}>
          <p className="ui-text">
            Solicita el código de seis dígitos a tu docente. Luego ingresa a la partida y selecciona tu equipo.
          </p>
        </Info>
        <Info title="Quiero preparar una clase" boton="Ver juegos" onClick={() => onNavigate("juegos")}>
          <p className="ui-text">
            Entra al catálogo de juegos, elige una actividad y prepara la partida para tus estudiantes.
          </p>
        </Info>
        <Info title="Soporte" boton="Ir al inicio" onClick={() => onNavigate("home")}>
          <p className="ui-text">
            Aún no se ha configurado una dirección de correo de soporte oficial. Esta página está preparada para
            incorporar los canales verificados cuando estén disponibles.
          </p>
        </Info>
      </div>
    </>
  );
}
