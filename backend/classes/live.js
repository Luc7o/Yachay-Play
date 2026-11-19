// ============================================================================
// ACTIVIDADES EN VIVO POR CLASE
// ============================================================================
// Cada juego guarda sus salas en memoria (Ludo en server.js, Crucigrama, Evaluación
// y Presentaciones en sus engine.js). Para que la clase sepa qué está abierto AHORA,
// cada juego registra aquí una "fuente": una función que devuelve sus salas abiertas
// que pertenecen a alguna clase. Así este módulo no importa a ningún juego (sin
// dependencias circulares) y agregar un juego nuevo es una línea en server.js.
//
// Cada actividad: { classId, kind, code, name, status, players }
//   kind: "ludo" | "crucigrama" | "evaluacion" | "estudio"
// ============================================================================

const fuentes = [];

export function registrarFuente(fn) {
  fuentes.push(fn);
}

// Actividades abiertas de las clases indicadas (Set o array de ids).
export function actividadesEnVivo(classIds) {
  const ids = classIds instanceof Set ? classIds : new Set(classIds);
  if (!ids.size) return [];
  const out = [];
  for (const fuente of fuentes) {
    try {
      for (const a of fuente()) if (a.classId && ids.has(a.classId)) out.push(a);
    } catch (e) {
      console.error("[clases] una fuente de actividades falló:", e.message);
    }
  }
  return out;
}
