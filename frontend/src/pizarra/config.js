export const CONFIG = {
  clave: "yachayplay.pizarra.v1", // dónde se guarda en este navegador
  // "auto" = negro sobre fondo claro y blanco sobre fondo oscuro
  colores: ["auto", "#E53935", "#F16503", "#FBC02D", "#2E9E5B", "#1E6FD9", "#7E57C2", "#E91E8C"],
  // trazo (px), tamaño del texto (px) y radio del borrador (px) para Fino / Medio / Grueso
  grosores: [
    { nombre: "Fino", w: 2.5, t: 24, b: 12 },
    { nombre: "Medio", w: 5, t: 40, b: 22 },
    { nombre: "Grueso", w: 10, t: 64, b: 40 },
  ],
  fondos: [
    { id: "blanco", nombre: "Blanco", color: "#FFFFFF", oscuro: false },
    { id: "cuadro", nombre: "Cuadriculado", color: "#FFFFFF", oscuro: false },
    { id: "rayas", nombre: "Rayado", color: "#FFFFFF", oscuro: false },
    { id: "plano", nombre: "Plano cartesiano", color: "#FFFFFF", oscuro: false },
    { id: "verde", nombre: "Pizarra verde", color: "#1F4D3A", oscuro: true },
    { id: "oscuro", nombre: "Pizarra negra", color: "#000000", oscuro: true },
  ],
  fuente: '"Poppins","Nunito",system-ui,sans-serif',
  maxHistorial: 100,
};

export const TAU = Math.PI * 2;

export const FORMAS = [
  { id: "line", nombre: "Línea" },
  { id: "arrow", nombre: "Flecha" },
  { id: "rect", nombre: "Rectángulo" },
  { id: "ellipse", nombre: "Óvalo" },
  { id: "tri", nombre: "Triángulo" },
];

export const ES_FORMA = new Set(["line", "arrow", "rect", "ellipse", "tri"]);

export const CON_RELLENO = new Set(["rect", "ellipse", "tri"]);

// ---------------- Textos de ayuda y medidas en vivo ----------------
export const NOMBRES_HERR = { mover: "Seleccionar", lapiz: "Lápiz", marcador: "Marcador", borrador: "Borrador", texto: "Texto", forma: "Forma" };

export const NOMBRES_OBJ = { pen: "Trazo", hl: "Resaltado", line: "Línea", arrow: "Flecha", rect: "Rectángulo", ellipse: "Óvalo", tri: "Triángulo", text: "Texto" };

export const AYUDA = {
  mover: "Toca un dibujo para seleccionarlo y arrástralo",
  lapiz: "Mantén presionado y dibuja",
  marcador: "Pasa sobre lo que quieras resaltar",
  borrador: "Mantén presionado y pasa por lo que quieras borrar",
  texto: "Haz clic donde quieras escribir",
  forma: "Arrastra para dibujar · Shift = proporcional",
};
