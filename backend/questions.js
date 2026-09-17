// Banco de 20 preguntas basado en el documento de preguntas del docente
// (Inventos Históricos de la Ingeniería), adaptado a formato de opción múltiple
// para la dinámica tipo Kahoot desde el celular del estudiante.

export const RAW_QUESTIONS = [
  {
    id: 1,
    topic: "Antigüedad y Mecánica",
    level: "Comprensión",
    question: "¿Qué logró principalmente la invención de la rueda y el eje en la ingeniería de transporte?",
    correct: "Reducir la fricción y facilitar el transporte de cargas pesadas",
    distractors: ["Generar electricidad para las fábricas", "Permitir la navegación transoceánica", "Sustituir el uso de los metales"],
  },
  {
    id: 2,
    topic: "Edad Media y Difusión",
    level: "Análisis",
    question: "¿Por qué la imprenta de tipos móviles de Gutenberg se considera la primera tecnología de producción en masa?",
    correct: "Porque estandarizó y permitió replicar textos de forma modular",
    distractors: ["Porque eliminó el uso del papel", "Porque digitalizó la información", "Porque creó las primeras redes de comunicación"],
  },
  {
    id: 3,
    topic: "Revolución Industrial",
    level: "Aplicación",
    question: "¿Qué logró la Máquina de Vapor de James Watt en la producción industrial?",
    correct: "Independizar la producción de la fuerza hidráulica de los ríos",
    distractors: ["Eliminar la necesidad de combustibles", "Crear la primera red eléctrica", "Sustituir el hierro por plástico"],
  },
  {
    id: 4,
    topic: "Comunicaciones Eléctricas",
    level: "Análisis",
    question: "¿Qué principio del Telégrafo Eléctrico anticipa la transmisión de datos digitales?",
    correct: "La codificación de mensajes en impulsos eléctricos discretos",
    distractors: ["El uso de fibra óptica", "La transmisión inalámbrica satelital", "El almacenamiento en la nube"],
  },
  {
    id: 5,
    topic: "Electrificación",
    level: "Pensamiento Crítico",
    question: "¿Qué ventaja tuvo la corriente alterna sobre la corriente continua para la industria?",
    correct: "Permitió transportar energía a largas distancias con menores pérdidas",
    distractors: ["Era más barata de generar en pequeña escala", "No requería cables conductores", "Funcionaba solo con baterías"],
  },
  {
    id: 6,
    topic: "Automoción y Motores",
    level: "Aplicación",
    question: "¿Cómo impactó el Motor de Combustión Interna en la logística y cadena de suministro mundial?",
    correct: "Brindó alta densidad de potencia y autonomía para el transporte de carga",
    distractors: ["Eliminó la necesidad de vehículos", "Redujo la producción de petróleo", "Sustituyó completamente las vías férreas"],
  },
  {
    id: 7,
    topic: "Era de los Semiconductores",
    level: "Análisis",
    question: "¿Por qué el Transistor (1947) es considerado un hito fundamental de la ingeniería electrónica?",
    correct: "Sustituyó los tubos de vacío permitiendo miniaturizar los circuitos",
    distractors: ["Eliminó el uso de la electricidad", "Fue el primer software funcional", "Fue el origen de internet"],
  },
  {
    id: 8,
    topic: "Ingeniería Hidráulica",
    level: "Comprensión",
    question: "¿Qué principio de ingeniería civil e hidráulica usaron los romanos en sus acueductos?",
    correct: "La pendiente por gravedad y el arco de medio punto para estabilidad",
    distractors: ["Bombas eléctricas de alta presión", "Tuberías de plástico reforzado", "Motores hidráulicos automatizados"],
  },
  {
    id: 9,
    topic: "Navegación y Comercio",
    level: "Aplicación",
    question: "¿Cómo influyó la Brújula Magnética en la ingeniería de navegación y el comercio mundial?",
    correct: "Permitió orientarse en mar abierto y abrir rutas comerciales estables",
    distractors: ["Eliminó la necesidad de barcos", "Creó los primeros mapas satelitales", "Sustituyó a los puertos marítimos"],
  },
  {
    id: 10,
    topic: "Ingeniería Biomédica",
    level: "Pensamiento Crítico",
    question: "¿Qué exigió la producción masiva de Penicilina a la ingeniería de bioprocesos?",
    correct: "Diseñar biorreactores de fermentación y esterilización industrial a escala",
    distractors: ["Crear redes de distribución eléctrica", "Automatizar líneas de ensamblaje de autos", "Desarrollar telégrafos de largo alcance"],
  },
  {
    id: 11,
    topic: "Procesos de Fabricación",
    level: "Análisis",
    question: "¿Qué cambió Henry Ford con la Línea de Ensamblaje Móvil en 1913?",
    correct: "Llevó el trabajo al operario, reduciendo tiempos de ciclo y estandarizando tareas",
    distractors: ["Eliminó la necesidad de trabajadores", "Creó el primer motor eléctrico", "Sustituyó el acero por aluminio"],
  },
  {
    id: 12,
    topic: "Era Digital",
    level: "Pensamiento Crítico",
    question: "¿Qué introdujo ARPANET (1969) en la arquitectura de la información y las redes?",
    correct: "La conmutación de paquetes distribuidos, tolerante a fallos de un nodo",
    distractors: ["La transmisión analógica de voz", "El primer disco duro", "Los primeros circuitos integrados"],
  },
  {
    id: 13,
    topic: "Computación e Informática",
    level: "Aplicación",
    question: "¿Qué impacto tuvo el Microprocesador (Intel 4004) en la automatización empresarial?",
    correct: "Integró toda la CPU en un solo circuito, habilitando cómputo en cualquier máquina",
    distractors: ["Eliminó la necesidad de electricidad", "Creó las primeras redes telefónicas", "Sustituyó los materiales de construcción"],
  },
  {
    id: 14,
    topic: "Ingeniería Aeronáutica",
    level: "Análisis",
    question: "¿Qué principio dominaron los hermanos Wright para lograr el primer vuelo controlado?",
    correct: "El control de tres ejes junto con una buena relación potencia-peso",
    distractors: ["La propulsión a chorro", "El uso de paneles solares", "La navegación satelital"],
  },
  {
    id: 15,
    topic: "Energía y Almacenamiento",
    level: "Aplicación",
    question: "¿Por qué fue crucial la Pila Voltaica de Alessandro Volta (1800)?",
    correct: "Fue la primera fuente continua y estable de corriente eléctrica",
    distractors: ["Generaba energía solar", "Sustituyó el uso del vapor", "Permitió la telefonía móvil"],
  },
  {
    id: 16,
    topic: "Ingeniería de Materiales",
    level: "Comprensión",
    question: "¿Por qué el Hormigón Armado transformó la arquitectura y la ingeniería civil moderna?",
    correct: "Combinó la resistencia a compresión del concreto con la resistencia a tracción del acero",
    distractors: ["Eliminó el uso de cimientos", "Redujo el peso de los edificios a cero", "Sustituyó la necesidad de arquitectos"],
  },
  {
    id: 17,
    topic: "Comunicaciones y Sensores",
    level: "Análisis",
    question: "¿Cómo funciona el principio del Radar y qué aplicación tiene?",
    correct: "Emite ondas electromagnéticas que rebotan en objetos para calcular distancia y velocidad",
    distractors: ["Usa luz visible para medir temperatura", "Analiza muestras químicas del aire", "Transmite señales de audio de baja frecuencia"],
  },
  {
    id: 18,
    topic: "Sostenibilidad y Energía",
    level: "Pensamiento Crítico",
    question: "¿Cómo contribuye la Célula Fotovoltaica al cambio de matriz energética en las empresas?",
    correct: "Transforma la radiación solar en electricidad sin emisiones contaminantes en sitio",
    distractors: ["Genera energía a partir de combustibles fósiles", "Almacena agua para consumo industrial", "Elimina la necesidad de baterías"],
  },
  {
    id: 19,
    topic: "Sistemas Informáticos",
    level: "Análisis",
    question: "¿Qué aportó Alan Turing con el concepto de la 'Máquina Universal'?",
    correct: "Que una sola máquina podía ejecutar cualquier algoritmo cambiando sus instrucciones",
    distractors: ["El primer circuito integrado", "La primera red eléctrica nacional", "El primer motor a vapor"],
  },
  {
    id: 20,
    topic: "Ingeniería Empresarial y Calidad",
    level: "Pensamiento Crítico",
    question: "¿Qué muestra la evolución histórica de la ingeniería sobre el rol del Ingeniero Empresarial?",
    correct: "Que integra tecnología, procesos y personas para crear valor en las organizaciones",
    distractors: ["Que solo diseña artefactos mecánicos", "Que reemplaza completamente el trabajo humano", "Que se limita a la programación de software"],
  },
];

// Shuffle determinista (mismo id -> mismo orden siempre), para no depender de Math.random al sembrar.
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildQuestions() {
  return RAW_QUESTIONS.map((q) => {
    const options = seededShuffle([q.correct, ...q.distractors], q.id);
    const answerIndex = options.indexOf(q.correct);
    return { topic: q.topic, level: q.level, question: q.question, options, answerIndex };
  });
}
