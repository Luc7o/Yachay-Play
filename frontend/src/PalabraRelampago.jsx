import React, { useEffect, useMemo, useRef, useState } from 'react';
import './palabraRelampago.css';

// Diccionario local inicial. Se puede reemplazar por una API/diccionario español verificado.
const WORDS = `sandalia sandía sapo salud saludo salvar salmón salsa salero salida sábana sábado saber sabiduría sabana sacapuntas sacar sacrificar saco salto saltar salvavidas salchicha sartén satélite
camino camiseta camaleón camión campana campo campeón camilla cámara camuflaje caminar cambio cambiar cama caballero cabeza cabello caballo cabina cacao cadena cafetería café caja calendario calor calabaza calcular calle callar calma
mariposa marina marino marco mármol martes marzo madera madre madrugar maquillaje máquina maqueta mapa manzana mango mano manta mandarina manifestación maravilla maravilloso
plátano planeta plaza playa plato plata pluma plural plumero plomo planta plancha plantar planificar plástico pliego plegar plácido
luna lunes luz lupa lugar luchar luciérnaga lluvia llave llevar llegada llenar llover llanta llama llamar llavero
pescado pescado pescador pesado pesadilla pesar peso persona personaje personal perfume periódico perla perro pera peligro pelícano película peluche pelo pelota peldaño
corazón coral coraje corbata correcto correr correo corriente cortina cortar corto cortés corona coronar cocina cocinar cocodrilo colegio color colina columna colaborar comida comer cometa comenzar comunidad computadora compañero compartir compañía
pintura pintar pincel pingüino pino piano pieza piedra pierna piel pie piloto pirámide piscina pista pistacho pistola
fruta frutilla frutero frasco frase frágil frambuesa frente freno fresco frescura frecuencia frijol frío fritura
estrella estación estufa estómago estante estudiar estudiante escuela escribir escritura escritor escoba escalera escapar escudo esfuerzo especial espejo esperanza espiral espacio espada
biblioteca bicicleta bicho bigote billete biología biologico bienvenida bienvenido bienestar
ventana ventilador verano verde verdura verdad vestido vestir vecino vehículo velocidad vela vencer venta vendedor venado
nube número nutrición nutria nuevo nueve nuez nuestra nudo nuclear nunca
reloj relato relámpago regalo regla regreso reunión reunir revisar revista repetir respuesta rescate resolver respeto respirar restar restaurante resultado recurso receta recordar recreo recreación
teatro teclado teléfono televisión tela telescopio temblor temprano temperatura templado tenedor tenis tener terreno tesoro texto textura
robot roca roble rodilla rodar rojo rosa rosal rostro ropa romper ronda rompecabezas romance
zapato zanahoria zancudo zorro zona zoológico zumbido zumo zafiro zambullida
árbol arco archivo arena arroz ardilla arte artista artículo artesanía ardiente aroma armar armario armonía arriba arrugar arriesgar
libro libre librería libertad limón limpio limpiar línea linterna líquido lista listo literatura lugar luna luz
sol sonido sonreír sonrisa sopa soporte sorpresa sorteo sostener sombra sombrero sombrilla sueño suelo suerte suave subir subiré submarino sumar suma superación
triángulo trigo tristeza trompeta trompo tronco trueno trucha truco transporte trabajo trabajador traer tradición traje tranquilidad transformar tratar
flor florero florecer flota flotar flauta flecha flexible fleco fluir flujo flama flamenco
brisa brincar brillo brillante brillar brindar brócoli bronce brocha brazo brasa bruja brújula
crucigrama cruzar cruz crema crear creativo creación crecer crecimiento cremallera crédito cristal criterio crimen crónica cráter
`.trim().split(/\s+/);
const PREFIXES = ['sa','ca','ma','pl','lu','pe','co','pi','fr','es','bi','ve','nu','re','te','ro','za','ar','li','so','tr','fl','br','cr'];
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
const validWords = new Set(WORDS.map(norm));

export function PalabraRelampago({ goHome, frame }) {
  const [names, setNames] = useState('Equipo Menta, Equipo Azul');
  const [seconds, setSeconds] = useState(20);
  const [maxRounds, setMaxRounds] = useState(12);
  const [players, setPlayers] = useState([]);
  const [phase, setPhase] = useState('setup');
  const [turn, setTurn] = useState(0);
  const [round, setRound] = useState(1);
  const [remain, setRemain] = useState(20);
  const [prefix, setPrefix] = useState('sa');
  const [used, setUsed] = useState([]);
  const [answer, setAnswer] = useState('');
  const [message, setMessage] = useState('');
  const inputRef = useRef(null);
  const timeoutRef = useRef(null);
  const usedRef = useRef([]);
  const playersRef = useRef([]);
  const turnRef = useRef(0);
  const prefixRef = useRef('sa');
  const roundsRef = useRef(1);
  const active = players[turn];

  const choosePrefix = (avoid) => {
    const candidates = PREFIXES.filter(p => p !== avoid && WORDS.some(w => norm(w).startsWith(p) && !usedRef.current.includes(norm(w))));
    return candidates[Math.floor(Math.random() * candidates.length)] || 'sa';
  };
  const resetTimer = (newPrefix) => { prefixRef.current = newPrefix; setPrefix(newPrefix); setRemain(seconds); setAnswer(''); setMessage(''); setTimeout(() => inputRef.current?.focus(), 0); };
  const start = () => {
    const entries = names.split(/[,\n]/).map(x => x.trim()).filter(Boolean).slice(0, 8);
    if (entries.length < 2) return setMessage('Agrega al menos dos equipos o jugadores separados por comas.');
    const data = entries.map((name, id) => ({ id, name, score: 0, lives: 3 }));
    playersRef.current = data; usedRef.current = []; turnRef.current = 0; roundsRef.current = 1;
    setPlayers(data); setUsed([]); setTurn(0); setRound(1); setPhase('playing'); resetTimer('sa');
  };
  const finishTurn = (points, word = '', note = '') => {
    if (timeoutRef.current) return;
    timeoutRef.current = true;
    const current = turnRef.current;
    const updated = playersRef.current.map((p, i) => i !== current ? p : ({ ...p, score: p.score + points, lives: Math.max(0, p.lives - (points ? 0 : 1)) }));
    playersRef.current = updated; setPlayers(updated);
    if (word) { usedRef.current = [...usedRef.current, norm(word)]; setUsed([...usedRef.current]); }
    setMessage(note || (points ? `¡Correcto! +${points} puntos` : 'Se acabó el tiempo. Pierdes una vida.'));
    const survivors = updated.map((p, i) => ({...p,index:i})).filter(p => p.lives > 0);
    const nextRound = roundsRef.current + 1;
    window.setTimeout(() => {
      timeoutRef.current = null;
      if (survivors.length < 2 || nextRound > maxRounds) return setPhase('finished');
      roundsRef.current = nextRound; setRound(nextRound);
      const next = Array.from({length:updated.length}, (_, i) => (current + i + 1) % updated.length).find(i => updated[i].lives > 0);
      turnRef.current = next; setTurn(next); resetTimer(choosePrefix(prefixRef.current));
    }, 1100);
  };
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = window.setInterval(() => setRemain(t => Math.max(0, t - 1)), 1000);
    return () => window.clearInterval(id);
  }, [phase, round]);
  useEffect(() => { if (phase === 'playing' && remain === 0) finishTurn(0); }, [remain, phase]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = e => {
    e.preventDefault();
    if (phase !== 'playing' || timeoutRef.current) return;
    const val = norm(answer);
    if (val.length < 4 || !/^[a-zñ]+$/.test(val)) return setMessage('Escribe una palabra de al menos 4 letras.');
    if (!val.startsWith(prefixRef.current)) return setMessage(`Debe empezar con «${prefixRef.current.toUpperCase()}».`);
    if (usedRef.current.includes(val)) return setMessage('Esa palabra ya fue utilizada.');
    if (!validWords.has(val)) return setMessage('No está en el diccionario de esta versión. Intenta otra palabra.');
    finishTurn(10 + remain, answer.trim());
  };
  const sorted = useMemo(() => [...players].sort((a,b) => b.score - a.score), [players]);
  const winner = sorted[0];
  const content = <div className="pr-page">
    <header className="pr-top"><div><span className="pr-kicker">YACHAYPLAY · JUEGO DE PALABRAS</span><h1>⚡ Palabra Relámpago</h1><p>¡Piensa rápido! Convierte las letras en palabras antes de que termine el tiempo.</p></div><button type="button" className="pr-back" onClick={goHome}>← Volver a juegos</button></header>
    {phase === 'setup' && <section className="pr-panel pr-setup"><div className="pr-burst">SA <span>→</span> SANDALIA</div><h2>Prepara la partida</h2><p>Juego local por turnos, ideal para proyectar en clase. Escribe los equipos separados por comas.</p><label>Jugadores o equipos<textarea value={names} onChange={e => setNames(e.target.value)} rows={2} maxLength={200}/></label><div className="pr-config"><label>Segundos por turno<select value={seconds} onChange={e => setSeconds(Number(e.target.value))}><option value={15}>15 segundos</option><option value={20}>20 segundos</option><option value={30}>30 segundos</option></select></label><label>Turnos totales<select value={maxRounds} onChange={e => setMaxRounds(Number(e.target.value))}><option value={8}>8 turnos</option><option value={12}>12 turnos</option><option value={20}>20 turnos</option></select></label></div><p className="pr-small">Cada equipo empieza con 3 vidas. Acierto: 10 puntos + segundos restantes. Fallo: pierde una vida. Las palabras deben estar en el diccionario incluido.</p>{message && <div className="pr-alert" role="alert">{message}</div>}<button className="pr-primary" onClick={start}>Comenzar partida →</button></section>}
    {phase === 'playing' && <div className="pr-game"><section className="pr-panel pr-board"><div className="pr-gamehead"><span>Turno {round} de {maxRounds}</span><strong>{active?.name}</strong></div><div className="pr-circle"><strong>{remain}</strong><span>SEGUNDOS</span></div><p className="pr-hint">Escribe una palabra que <strong>empiece por</strong> estas letras:</p><div className="pr-letters">{prefix.toUpperCase()}</div><form onSubmit={submit} className="pr-entry"><input ref={inputRef} value={answer} onChange={e=>setAnswer(e.target.value)} autoComplete="off" placeholder={`Ej.: ${prefix === 'sa' ? 'sandalia' : 'tu palabra...'}`} aria-label="Tu palabra" maxLength={40}/><button className="pr-primary" type="submit">Enviar palabra ↗</button></form><div className="pr-alert" aria-live="polite">{message || 'Una palabra correcta suma puntos. ¡No repitas!'}</div><button className="pr-skip" onClick={()=>finishTurn(0, '', 'Turno pasado. Pierdes una vida.')}>Pasar turno (−1 vida)</button></section><aside className="pr-panel pr-scores"><h2>🏆 Clasificación</h2>{players.map((p,i)=><div className={'pr-player ' + (i===turn?'pr-current':'')} key={p.id}><span>{p.name}{i===turn?' ●':''}</span><strong>{p.score} pts</strong><small>{'♥'.repeat(p.lives)}{'♡'.repeat(3-p.lives)}</small></div>)}<h3>Palabras usadas ({used.length})</h3><div className="pr-used">{used.length ? used.slice(-12).map(w=><span key={w}>{w}</span>):'Todavía ninguna'}</div></aside></div>}
    {phase === 'finished' && <section className="pr-panel pr-finish"><div className="pr-burst">🏆</div><h2>¡Partida terminada!</h2><p>Ganador: <strong>{winner?.name}</strong> con {winner?.score} puntos</p>{sorted.map((p,i)=><div className="pr-rank" key={p.id}><span>{i+1}. {p.name}</span><strong>{p.score} puntos</strong></div>)}<button className="pr-primary" onClick={()=>{setPhase('setup');setMessage('')}}>Jugar otra vez</button></section>}
  </div>;
  return frame ? frame(content) : content;
}
