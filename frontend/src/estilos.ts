// ============================================================================
// ORDEN FIJO DE LOS CSS
// ============================================================================
// Las pantallas grandes (Pizarra, Ruleta, Estudio, Crucigrama...) se cargan
// bajo demanda con React.lazy. Si su CSS viajara con ellas, llegaría DESPUÉS
// de gamesDark.css y aulaFinal.css, que funcionan porque se cargan al final
// ("el último gana"), y la app se vería distinta.
//
// Por eso TODOS los CSS se importan aquí, al arrancar y en el mismo orden de
// antes. Cuando una pantalla diferida vuelve a importar su CSS, ese archivo ya
// está cargado y no cambia de lugar.
//
// Si agregas un CSS nuevo, ponlo aquí, en el lugar que le corresponda.
// main.jsx importa: styles.css -> este archivo -> gamesDark.css -> aulaFinal.css -> campus.css -> campusJuegos.css
// ============================================================================
import "./authAnim.css";
import "./authExtras.css";
import "./shell.css";
import "./gate.css";
import "./cw.css";
import "./palabraRelampago.css";
import "./tools.css";
import "./herramientas.css";
import "./cronometroMini.css";
import "./pizarra.css";
import "./estudio/estudio.css";
import "./quiz/quiz.css";
