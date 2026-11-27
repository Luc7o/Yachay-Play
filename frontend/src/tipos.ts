// ============================================================================
// TIPOS DE APOYO PARA LAS PANTALLAS
// ----------------------------------------------------------------------------
// `SinTipo` marca un dato que todavía no tiene tipo propio (estado que llega del
// servidor, gestos en curso...). Es un `any` explícito y fácil de buscar:
// cada vez que se tipa uno de verdad, se reemplaza. `grep -r SinTipo src` dice
// cuánto falta.
// ============================================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SinTipo = any;
