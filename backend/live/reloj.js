// ============================================================================
// RELOJ ÚNICO DE LOS JUEGOS EN VIVO
// ============================================================================
// Antes cada juego tenía su propio setInterval en server.js. Ahora hay un solo
// intervalo que llama a los `tick()` registrados, cada uno con su periodo:
//
//   const reloj = crearReloj();
//   reloj.registrar("ludo", 1000, ludoTick);
//   reloj.registrar("palabra", 500, () => palabraTick(io)); // turnos más precisos
//   reloj.iniciar();
//
// El intervalo base es el máximo común divisor de los periodos (500 ms en el
// ejemplo) y cada tarea corre cuando el tiempo acumulado es múltiplo de su
// periodo. Si un tick falla (o su promesa se rechaza) se avisa en consola y los
// demás siguen corriendo.
// ============================================================================

const mcd = (a, b) => (b ? mcd(b, a % b) : a);

const avisarFallo = (nombre, e) => console.error(`[reloj] el tick "${nombre}" falló:`, e?.message || e);

export function crearReloj({ alFallar = avisarFallo } = {}) {
  const tareas = [];
  let base = 0;
  let pulsos = 0;
  let intervalo = null;

  function pulso() {
    pulsos++;
    const transcurrido = pulsos * base;
    for (const t of tareas) {
      if (transcurrido % t.periodoMs !== 0) continue;
      try {
        const r = t.fn();
        if (r && typeof r.catch === "function") r.catch((e) => alFallar(t.nombre, e));
      } catch (e) {
        alFallar(t.nombre, e);
      }
    }
  }

  return {
    registrar(nombre, periodoMs, fn) {
      if (!Number.isInteger(periodoMs) || periodoMs <= 0) throw new Error(`Periodo inválido para "${nombre}".`);
      if (intervalo) throw new Error("Registra los ticks antes de iniciar el reloj.");
      tareas.push({ nombre, periodoMs, fn });
      base = mcd(base, periodoMs);
    },
    iniciar() {
      if (intervalo || !tareas.length) return;
      intervalo = setInterval(pulso, base);
    },
    detener() {
      clearInterval(intervalo);
      intervalo = null;
    },
    // Para pruebas: avanza un pulso a mano, sin esperar al setInterval.
    pulso,
    get base() {
      return base;
    },
    get tareas() {
      return tareas.map(({ nombre, periodoMs }) => ({ nombre, periodoMs }));
    },
  };
}
