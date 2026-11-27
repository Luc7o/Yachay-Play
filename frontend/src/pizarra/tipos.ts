// Tipos de la Pizarra: lo que se dibuja y se guarda en el navegador.

export type TipoObjeto =
  | "pen" // trazo de lápiz
  | "hl" // marcador (resaltado)
  | "erase" // borrador
  | "line"
  | "arrow"
  | "rect"
  | "ellipse"
  | "tri"
  | "diamond"
  | "img" // imagen pegada (src = data URL)
  | "text";

/**
 * Un objeto de la pizarra. Es una forma "plana": cada tipo usa solo una parte
 *   - trazos (pen, hl, erase): pts
 *   - formas e imágenes: x1, y1, x2, y2 (+ fill, src)
 *   - texto: x, y, text, size
 */
export interface ObjPizarra {
  id: string;
  type: TipoObjeto;
  color: string; // "auto" o un color CSS
  w: number; // grosor del trazo
  pts?: number[][];
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  fill?: boolean;
  src?: string;
  x: number;
  y: number;
  text: string;
  size: number;
}

export interface Pagina {
  id: string;
  fondo: string;
  objs: ObjPizarra[];
}

/** Lo que se guarda en localStorage. */
export interface EstadoGuardado {
  paginas: Pagina[];
  actual: number;
  color: string;
  grosor: number;
  nombre: string;
}
