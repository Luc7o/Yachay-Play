import React from "react";

// ============================================================================
// RED DE SEGURIDAD CONTRA LA "PANTALLA EN BLANCO"
// ============================================================================
// Por defecto, si algo falla mientras React está dibujando la pantalla
// (un error de programación, un dato inesperado del servidor, etc.), React
// desmonta TODA la aplicación y no queda nada visible: pantalla en blanco,
// sin ningún mensaje. Este componente "atrapa" ese error y, en vez de dejar
// la pantalla vacía, muestra qué pasó y un botón para reiniciar.
//
// Así, si esto vuelve a pasar, en vez de una pantalla en blanco vas a ver el
// mensaje de error exacto (y puedes mandarlo como captura de pantalla).
// ============================================================================
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Queda también en la consola del navegador (F12) para quien sepa mirarla.
    console.error("Error atrapado por ErrorBoundary:", error, info);
  }

  handleReset = () => {
    // Limpiamos todo lo guardado localmente y recargamos desde cero.
    try {
      localStorage.removeItem("ludo_mode");
      localStorage.removeItem("ludo_player_id");
      localStorage.removeItem("ludo_game_code");
      localStorage.removeItem("ludo_engineer_code");
    } catch (e) {
      // si localStorage no está disponible, no pasa nada
    }
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div style={styles.wrap}>
          <div style={styles.card}>
            <span style={styles.icon}>⚠️</span>
            <h1 style={styles.h1}>Algo salió mal</h1>
            <p style={styles.p}>
              La aplicación encontró un error y no pudo seguir. Este mensaje reemplaza lo que antes
              era una pantalla en blanco, para que sepamos qué pasó.
            </p>
            <pre style={styles.pre}>{String(this.state.error?.message || this.state.error)}</pre>
            <button style={styles.btn} onClick={this.handleReset}>
              Reiniciar la aplicación
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const styles = {
  wrap: { minHeight: "100vh", display: "grid", placeItems: "center", background: "#f0faf8", padding: 20, fontFamily: "system-ui, sans-serif" },
  card: { maxWidth: 480, background: "#fff", border: "1px solid #fecaca", borderRadius: 16, padding: 28, textAlign: "center", boxShadow: "0 12px 30px #0f172a1a" },
  icon: { fontSize: 40 },
  h1: { margin: "10px 0", color: "#b91c1c" },
  p: { color: "#475569", fontSize: 13, lineHeight: 1.6 },
  pre: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 12, fontSize: 11, color: "#991b1b", textAlign: "left", overflowX: "auto", margin: "14px 0" },
  btn: { border: 0, borderRadius: 9, background: "#00796f", color: "#fff", padding: "12px 18px", fontWeight: 800, cursor: "pointer" },
};
