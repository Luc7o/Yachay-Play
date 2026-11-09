// ---------------- Íconos (SVG simples) ----------------
export const ICONOS = {
  mover: <path d="M4 3l7.07 16.97 2.51-7.39 7.39-2.51L4 3z" />,
  lapiz: <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />,
  marcador: (
    <>
      <path d="M9 11l-6 6v3h9l3-3" />
      <path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
    </>
  ),
  borrador: (
    <>
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </>
  ),
  texto: <path d="M4 7V4h16v3M9 20h6M12 4v16" />,
  formas: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <circle cx="17.5" cy="6.5" r="3.5" />
      <path d="M6.5 14l4 7h-8z" />
      <path d="M14 21l7-7" />
    </>
  ),
  line: <path d="M5 19L19 5" />,
  arrow: <path d="M5 19L19 5M10 5h9v9" />,
  rect: <rect x="4" y="5" width="16" height="14" rx="1" />,
  ellipse: <ellipse cx="12" cy="12" rx="9" ry="6.5" />,
  tri: <path d="M12 4l9 16H3z" />,
  deshacer: (
    <>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </>
  ),
  rehacer: (
    <>
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
    </>
  ),
  basura: <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />,
  descargar: <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />,
  pantalla: <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />,
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  fondo: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </>
  ),
  mas: <path d="M12 5v14M5 12h14" />,
  izq: <path d="M15 6l-6 6 6 6" />,
  der: <path d="M9 6l6 6-6 6" />,
};

export function Icono({ n, size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONOS[n]}
    </svg>
  );
}
