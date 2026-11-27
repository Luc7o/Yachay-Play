// ============================================================================
// SONIDO DE LAS HERRAMIENTAS (cronómetro y ruleta)
// ============================================================================
// Se genera con Web Audio: no hay archivos de sonido que cargar. El navegador
// solo deja sonar después de un clic o tecla del usuario, por eso se llama a
// prepararAudio() dentro de los botones (Iniciar, Girar, etc.).
// ============================================================================
let audio: AudioContext | null = null;
type ConWebkit = typeof window & { webkitAudioContext?: typeof AudioContext };

export function prepararAudio() {
  try {
    const AC = window.AudioContext || (window as ConWebkit).webkitAudioContext;
    if (!AC) return;
    audio = audio || new AC();
    if (audio.state === "suspended") audio.resume();
  } catch {
    /* sin sonido: la herramienta sigue funcionando */
  }
}

// Una nota: frecuencia (Hz), cuándo empieza (s desde ahora), cuánto dura (s) y volumen (0-1).
export function nota(
  frecuencia: number,
  inicio: number,
  duracion: number,
  volumen: number,
  tipo: OscillatorType = "sine",
) {
  const ctx = audio;
  if (!ctx) return;
  try {
    const t = ctx.currentTime + inicio;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tipo;
    osc.frequency.value = frecuencia;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volumen, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duracion + 0.05);
  } catch {
    /* ídem */
  }
}
