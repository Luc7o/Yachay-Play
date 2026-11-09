import { CONFIG } from "./config";
import { uid, fondoDe, colorReal } from "./utils";

// ---------------- Guardado ----------------
export function paginaNueva(fondo = "blanco") {
  return { id: uid(), fondo, objs: [] };
}

export function cargar() {
  const base = { paginas: [paginaNueva()], actual: 0, color: "auto", grosor: 1, nombre: "" };
  try {
    const d = JSON.parse(localStorage.getItem(CONFIG.clave) || "null");
    if (!d || !Array.isArray(d.paginas) || !d.paginas.length) return base;
    const paginas = d.paginas
      .filter((p) => p && Array.isArray(p.objs))
      .map((p) => {
        const f = fondoDe(p.fondo);
        // los trazos "auto" de versiones anteriores se fijan al color que se veía en esa página
        return { id: p.id || uid(), fondo: f.id, objs: p.objs.map((o) => (o && o.color === "auto" ? { ...o, color: colorReal("auto", f.oscuro) } : o)) };
      });
    if (!paginas.length) return base;
    return {
      paginas,
      actual: Math.min(Math.max(0, d.actual | 0), paginas.length - 1),
      color: typeof d.color === "string" ? d.color : "auto",
      grosor: [0, 1, 2].includes(d.grosor) ? d.grosor : 1,
      nombre: typeof d.nombre === "string" ? d.nombre.slice(0, 80) : "",
    };
  } catch {
    return base;
  }
}
