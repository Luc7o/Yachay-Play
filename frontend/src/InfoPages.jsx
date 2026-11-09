import React from "react";

// Páginas informativas: no dependen del backend ni de tarifas inventadas.
export function InfoPage({ page, onNavigate }) {
  if (page === "planes") return (
    <div className="ip-page"><span className="ip-kicker">PLANES Y ACCESO</span><h1>Aprende jugando con YachayPlay</h1>
      <p className="ip-lead">Conoce las opciones de acceso a los juegos y herramientas educativas.</p>
      <div className="ip-grid"><article><span>PARA EMPEZAR</span><h2>Tu cuenta YachayPlay</h2><p>Participa como estudiante o prepara actividades como docente.</p><ul><li>Juegos educativos interactivos</li><li>Acceso mediante código de partida</li><li>Herramientas y estadísticas disponibles</li></ul><button onClick={() => onNavigate("juegos")}>Explorar juegos</button></article>
      <article><span>INFORMACIÓN</span><h2>Próximas novedades</h2><p>No hay planes de pago ni precios publicados en esta versión. Cuando existan, podrán mostrarse aquí con sus condiciones verificadas.</p><button onClick={() => onNavigate("contacto")}>Ver ayuda y contacto</button></article></div>
    </div>
  );
  return <div className="ip-page"><span className="ip-kicker">AYUDA Y CONTACTO</span><h1>¿Cómo podemos ayudarte?</h1><p className="ip-lead">Resuelve tus dudas sobre las partidas y la plataforma.</p>
    <div className="ip-grid"><article><h2>Quiero jugar</h2><p>Solicita el código de seis dígitos a tu docente. Luego ingresa a la partida y selecciona tu equipo.</p><button onClick={() => onNavigate("join")}>Unirme con código</button></article>
    <article><h2>Quiero preparar una clase</h2><p>Entra al catálogo de juegos, elige una actividad y prepara la partida para tus estudiantes.</p><button onClick={() => onNavigate("juegos")}>Ver juegos</button></article>
    <article><h2>Soporte</h2><p>Aún no se ha configurado una dirección de correo de soporte oficial. Esta página está preparada para incorporar los canales verificados cuando estén disponibles.</p><button onClick={() => onNavigate("home")}>Ir al inicio</button></article></div></div>;
}
