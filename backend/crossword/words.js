// ============================================================================
// BANCO DE PALABRAS POR DEFECTO — Crucigrama Relámpago
// Tema: Inventos Históricos de la Ingeniería (igual que el Ludo, por ahora).
// ============================================================================
// "answer" va SIEMPRE en mayúsculas, sin tildes ni espacios (una sola palabra),
// porque así se acomoda en las casillas del crucigrama. La Ñ sí se conserva.
// Cuando el docente pueda subir su propio contenido, este archivo seguirá
// siendo el banco "por defecto" que se usa si no elige otro.
// ============================================================================
export const DEFAULT_WORDS = [
  { word: "RUEDA", clue: "Invento que redujo la fricción y permitió transportar cargas pesadas" },
  { word: "IMPRENTA", clue: "Máquina de Gutenberg que estandarizó la reproducción de textos" },
  { word: "VAPOR", clue: "Tipo de máquina de Watt que impulsó la Revolución Industrial" },
  { word: "TELEGRAFO", clue: "Aparato que transmitía mensajes mediante impulsos eléctricos" },
  { word: "TELEFONO", clue: "Invento de Bell para transmitir la voz a distancia" },
  { word: "DINAMO", clue: "Generador que convierte energía mecánica en eléctrica" },
  { word: "BOMBILLA", clue: "Invento de Edison que llevó luz eléctrica a los hogares" },
  { word: "MOTOR", clue: "Máquina que transforma energía en movimiento" },
  { word: "AVION", clue: "Invento de los hermanos Wright para volar" },
  { word: "RADIO", clue: "Tecnología que transmite sonido de forma inalámbrica" },
  { word: "TRANSISTOR", clue: "Componente que reemplazó a las válvulas de vacío" },
  { word: "SATELITE", clue: "Objeto puesto en órbita para las telecomunicaciones" },
  { word: "INTERNET", clue: "Red que conecta computadoras en todo el mundo" },
  { word: "COMPUTADORA", clue: "Máquina que procesa información mediante programas" },
  { word: "TREN", clue: "Transporte impulsado primero por vapor, sobre rieles" },
  { word: "PUENTE", clue: "Estructura de ingeniería civil para cruzar un obstáculo" },
  { word: "TURBINA", clue: "Máquina que convierte la energía de un fluido en movimiento" },
  { word: "ACERO", clue: "Aleación de hierro y carbono clave en la construcción moderna" },
  { word: "LASER", clue: "Luz amplificada, usada en medicina e industria" },
  { word: "ROBOT", clue: "Máquina automática capaz de realizar tareas por sí sola" },
];

// Quita tildes, deja la Ñ y pasa a mayúsculas (para comparar sin errores de acentos).
export function normalizeAnswer(text) {
  return String(text || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // tildes
    .replace(/[^A-ZÑ]/g, ""); // solo letras (sin espacios ni signos)
}
