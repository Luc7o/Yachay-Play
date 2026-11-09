// Diccionario local offline: vocabulario base del juego + extensiones verificadas por el docente.
// La lista base es deliberadamente limitada; no sustituye un lexicón integral del español.
const BASE = `paisaje paisajes pasado pasados pasajero pasajeros mensaje mensajes ensalada ensaladas bocado bocados bocadillo bocadillos casa casas casado casada pasarela pasar pasillo casilla cascabel cascabeles

sandalia sandalias sandía sandías sapo sapos salud saludable saludo saludos salvar salvación salmón salmones salsa salsas salero salida salidas sábana sábanas sábado sábados saber sabiduría sacapuntas sacar sacrificio saco sacos salto saltar salvavidas salchicha salchichas sartén sartenes satélite satélites
camino caminos camiseta camisetas camaleón camaleones camión camiones campana campanas campo campos campeón campeones camilla cámara cámaras camuflaje caminar cambio cambiar cama camas caballero cabeza cabezas cabello caballo caballos cabina cacao cadena cadenas cafetería café caja cajas calendario calendarios calor calabaza calabazas calcular calle calles callar calma
mariposa mariposas marina marino marco mármol martes marzo madera madre madres madrugar maquillaje máquina máquinas maqueta maquetas mapa mapas manzana manzanas mango mangos mano manos manta mandarina maravilloso maravilla matemáticas materia maestro maestra maestros maestras
plátano plátanos planeta planetas plaza plazas playa playas plato platos plata pluma plumas plural planta plantas plancha plantar planificar plástico plásticos plegar plácido pliego plumero
luna lunas lunes luz lupa lupas lugar lugares luchar luciérnaga luciérnagas lluvia lluvias llave llaves llevar llegada llenar llover llanta llantas llama llamas llamar llavero llaveros
pescado pescador pescadores pesado pesadilla pesar peso persona personas personaje personajes personal perfume perfumes periódico periódicos perla perlas perro perros pera peras peligro película películas peluche peluches pelo pelos pelota pelotas
corazón corazones coral corales coraje corbata correcto correr correo correos corriente cortina cortinas cortar corto corona cocina cocinar cocodrilo colegio colegios color colores colina columna colaborar comida comidas comer cometa cometas comenzar comunidad computadora computadoras compañero compañeros compartir compañía
pintura pinturas pintar pincel pinceles pingüino pingüinos pino pinos piano pianos pieza piezas piedra piedras pierna piernas piel piloto pilotos pirámide pirámides piscina piscinas pista pistas
fruta frutas frutero frasco frascos frase frases frágil frambuesa frente freno fresco frescura frecuencia frijol frijoles frío fritura fresa fresas
estrella estrellas estación estaciones estufa estómago estante estudiar estudiante estudiantes escuela escuelas escribir escritura escritor escritores escoba escobas escalera escaleras escapar escudo esfuerzo especial espejo espejos esperanza espiral espacio espada espadas
biblioteca bibliotecas bicicleta bicicletas bicho bichos bigote billete billetes biología bienvenida bienvenido bienestar
ventana ventanas ventilador ventiladores verano veranos verde verdes verdura verduras verdad vestido vestidos vestir vecino vecinos vehículo vehículos velocidad vela velas vencer venta vendedor vendedores venado venados
nube nubes número números nutrición nutria nutrias nuevo nueva nuevos nuevas nueve nuez nueces nudo nuclear nunca noticia noticias
reloj relojes relato relatos relámpago relámpagos regalo regalos regla reglas regreso reunión reuniones reunir revisar revista revistas repetir respuesta respuestas rescate resolver respeto respirar restar restaurante restaurantes resultado resultados recurso recursos receta recetas recordar recreo recreación
teatro teatros teclado teclados teléfono teléfonos televisión televisiones tela telas telescopio telescopios temblor temprano temperatura temperaturas tenedor tenedores tenis tener terreno terrenos tesoro tesoros texto textos textura texturas
robot robots roca rocas roble rodilla rodillas rodar rojo roja rosas rosa rosal rostro rostros ropa ropas romper ronda rondas rompecabezas
zapato zapatos zanahoria zanahorias zancudo zancudos zorro zorros zona zonas zoológico zoológicos zumbido zumo zafiro
árbol árboles arco arcos archivo archivos arena arenas arroz ardilla ardillas arte artes artista artistas artículo artículos artesanía aroma armar armario armarios armonía arriba
libro libros libre librería librerías libertad limón limones limpio limpiar línea líneas linterna linternas líquido líquidos lista listas literatura
sol soles sonido sonidos sonreír sonrisa sonrisas sopa sopas soporte sorpresa sorpresas sorteo sostener sombra sombras sombrero sombreros sombrilla sombrillas sueño sueños suelo suelos suerte suave subir submarino submarinos sumar suma
triángulo triángulos trigo tristeza trompeta trompetas trompo trompos tronco troncos trueno truenos trucha truchas truco trucos transporte trabajo trabajos trabajador trabajadores traje trajes tradición transformar tratar
flor flores florero floreros florecer flota flotar flauta flautas flecha flechas flexible fleco fluir flujo flamenco flamencos
brisa brisas brincar brillo brillante brillar brindar brócoli bronce brocha brochas brazo brazos brasa bruja brujas brújula brújulas
crucigrama crucigramas cruzar cruz crema cremas crear creativo creativa creación crecer crecimiento cremallera crédito cristal cristales criterio criterios crónica cráter cráteres
agua aguas aguacate aguacates abeja abejas abrazo abrazos abuela abuelo abuelos aceite aceites aceituna aceitunas azúcar azúcarero alimento alimentos alumno alumnos amiga amigo amigos amistad animal animales anillo anillos aniversario antiguo antiguos antena antenas apartamento apartamentos apellido apellidos aprender aprendizaje aprendizajes araña arañas avión aviones aventura aventuras
barco barcos barra barras barrera barreras barriga barrigas batería baterías bebé bebés bebida bebidas beso besos blanco blanca blancos blancas boca bocas bolígrafo bolígrafos bolsa bolsas bombilla bombillas bonito bonita bosque bosques botella botellas botón botones bufanda bufandas burbuja burbujas burro burros
canción canciones cantante cantantes cantar cantidad cantidades cara caras carbón carbonero caricia caricias carne carnes carpeta carpetas carta cartas casa casas cascada cascadas castillo castillos cebolla cebollas cena cenas centro centros cerebro cerebros cerdo cerdos cereza cerezas cereal cereales cesta cestas ciencia ciencias cielo cielos ciudad ciudades clase clases clima climas nube nubes coche coches código códigos computadora computadoras conferencia conferencias conejo conejos conocimiento conocimientos construcción construcciones cuento cuentos cultura culturas curso cursos
Dado dados dama damas danza danzas dedo dedos defensa defensas deporte deportes desafío desafíos día días dibujo dibujos diccionario diccionarios diente dientes dinero dinosaurio dinosaurios dirección direcciones disco discos distancia distancias doctora doctor doctores documento documentos domingo domingos dragón dragones dulce dulces durazno duraznos
edificio edificios educación educador educadora elefante elefantes elemento elementos energía energías enemigo enemigos enero entrada entradas equipo equipos error errores espacio espacios examen exámenes ejemplo ejemplos ejercicio ejercicios éxito éxitos experiencia experiencias explicación explicaciones
familia familias fantasma fantasmas farmacia farmacias febrero felicidad festival festivales figura figuras finca fincas firma firmas fuego fuegos fuente fuentes fútbol futuro futuros
 gallina gallinas gato gatos galleta galletas gente gigantes girasol girasoles globo globos gol goles gorra gorras gota gotas gobierno gobiernos gracias granja granjas grupo grupos guitarra guitarras gusano gusanos
habitación habitaciones habilidad habilidades hambre hamburguesa hamburguesas harina helado helados hermana hermano hermanos herramienta herramientas hierba hierbas hielo hielos historia historias hogar hogares hoja hojas hombre hombres hormiga hormigas hospital hospitales huevo huevos huerto huertos humo
idea ideas idioma idiomas iglesia iglesias imagen imágenes imaginación imágenes importante informática información ingrediente ingredientes insecto insectos instituto institutos invierno inviernos isla islas
jardín jardines jarra jarras jirafa jirafas joven jóvenes joya joyas jueves juez jueces juego juegos jugador jugadores jugo jugos julio junio justicia
kilómetro kilómetros kilogramo kilogramos kiwi kiwis
laboratorio laboratorios lago lagos lápiz lápices largo larga leche lechuga lechugas lectura lecturas lengua lenguas león leones letra letras letrina letrero letreros ley leyes leña lecciones lección lente lentes leopardo leopardos
madrugada magia mago magos maleta maletas mamífero mamíferos mañana mañanas montaña montañas moneda monedas molino molinos motocicleta motocicletas movimiento movimientos música músicos museo museos
naranja naranjas nariz narices naturaleza naturales navidad necesidad necesidades negro negra nieve noche noches nombre nombres norte nota notas novela novelas
objetivo objetivos objeto objetos océano océanos octubre oficina oficinas ojo ojos oliva olivas ola olas operación operaciones oportunidad oportunidades ordenador ordenadores oreja orejas oro oscuro oscuros oso osos otoño oveja ovejas
página páginas país países palabra palabras palacio palacios palo palos pantalla pantallas pantalón pantalones papel papeles parque parques parte partes partido partidos pájaro pájaros paz pelota pelotas pensamiento pensamientos pequeño pequeña pequeños pequeñas pregunta preguntas primavera profesor profesora profesores profesoras programa programas proyecto proyectos puerta puertas pueblo pueblos punto puntos
queso quesos querer querido querida química químicas quince quitar
radio radios raíz raíces ratón ratones rayo rayos realidad realidades recreación receta recetas rectángulo rectángulos red redes reina reinas reino reinos riqueza riquezas río ríos rueda ruedas ruido ruidos
semana semanas semilla semillas sendero senderos sentido sentidos señor señora señores señoras señal señales septiembre serpiente serpientes servicio servicios silla sillas silencio silbato silbatos sistema sistemas sitio sitios sociedad sociedades solución soluciones sombrero sombreros supermercado supermercados
tabla tablas tablero tableros tarea tareas taza tazas techo techos tecnología tecnologías tema temas tiempo tiempos tienda tiendas tigre tigres tierra tierras tijera tijeras tomate tomates torre torres tortuga tortugas transporte tren trenes tristeza truco trucos turno turnos
universidad universidades universo universos uno una uña uñas urgente usuario usuarios utensilio utensilios uva uvas
vacaciones vacuna vacunas valle valles vapor valores valor vaso vasos viento vientos viernes viaje viajes vida vidas video videos vidrio vidrios villano villanos violín violines vista vistas vitamina vitaminas vocabulario vocal vocales voz voces vuelo vuelos
web yate yates yema yemas yeso yoga yogur yogures yoyo
`.trim().split(/\s+/u);
export const normalizeWord = (input) => String(input || '').toLocaleLowerCase('es').replace(/ñ/g, '__enie__').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/__enie__/g, 'ñ').trim();
const safeWord = (value) => /^[a-zñü]{4,35}$/u.test(normalizeWord(value));
const baseWords = new Set(BASE.filter(safeWord).map(normalizeWord));
export const BASE_COUNT = baseWords.size;
export const EXTRA_KEY = 'yachay-palabra-relampago-vocabulary-v1';
export function loadExtraWords() {
  try { const stored = JSON.parse(localStorage.getItem(EXTRA_KEY) || '[]'); return Array.isArray(stored) ? stored.filter(safeWord).map(normalizeWord).slice(0,50000) : []; } catch { return []; }
}
export function saveExtraWords(words) { localStorage.setItem(EXTRA_KEY, JSON.stringify([...new Set(words.filter(safeWord).map(normalizeWord))].slice(0,50000))); }
export function checkWord(value, fragment, used, extraWords) {
  const w = normalizeWord(value);
  if (!safeWord(w)) return 'Escribe una palabra de 4 a 35 letras.';
  if (!w.includes(normalizeWord(fragment))) return `La palabra debe contener «${fragment.toUpperCase()}» en cualquier posición.`;
  if (used.includes(w)) return 'Esa palabra ya fue utilizada en esta partida.';
  if (!baseWords.has(w) && !extraWords.has(w)) return 'No aparece en el diccionario disponible. Puedes agregarla desde Configurar partida.';
  return '';
}
export const FRAGMENTS = ['sa','ca','ma','pl','lu','pe','co','pi','fr','es','bi','ve','nu','re','te','ro','za','ar','li','so','tr','fl','br','cr','an','en','al','ra','ta','le','na','pa','la','io','or','er'];
export function candidateFragments(used, extraWords) {
  const all = new Set([...baseWords,...extraWords]);
  return FRAGMENTS.filter(fragment => {let count=0; for (const w of all) {if (!used.includes(w) && w.includes(fragment) && ++count>=4) return true;} return false;});
}
