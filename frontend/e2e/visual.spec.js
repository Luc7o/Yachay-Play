// ============================================================================
// COMPARACIÓN VISUAL de todas las pantallas (antes / después de tocar el CSS).
// ----------------------------------------------------------------------------
//   npm run e2e:visual -- --update-snapshots   -> guarda las capturas de referencia
//   npm run e2e:visual                          -> compara contra ellas
// Las capturas dependen del sistema y de las fuentes, por eso NO corre en CI: es una
// herramienta local para refactorizar CSS sin cambios visuales inadvertidos.
// Usa el build de PRODUCCIÓN (vite preview): ahí todo el CSS va en un solo archivo,
// que es donde aparecen los errores que en desarrollo pasan inadvertidos.
// ============================================================================
import { test, expect } from "@playwright/test";

test.skip(!process.env.VISUAL, "Comparación visual: solo con VISUAL=1 (npm run e2e:visual)");

const TAMANOS = {
  escritorio: { width: 1366, height: 860 },
  celular: { width: 390, height: 844 },
};
const TEMAS = ["light", "dark"];

// Lo que cambia solo (códigos, fechas) se tapa en la comparación.
const TAPAR = [".proj-code", ".qz-codigo", ".pf-bigcode", ".es-code", ".cp-code-big", ".cp-code-inline", ".build-mark"];

const PUBLICAS = [
  ["portada", "/#/"],
  ["entrar", "/#/entrar"],
  ["registro", "/#/registro"],
  ["unirse", "/#/unirse"],
  ["ludo-elegir", "/#/ludo"],
  ["evaluacion-unirse", "/#/juego/evaluacion"],
  ["palabra-invitado", "/#/juego/palabra"],
  ["crucigrama-invitado", "/#/juego/crucigrama"],
  ["estudio-unirse", "/#/juego/estudio"],
];
const PANEL = [
  ["inicio", "/#/app/inicio"],
  ["juegos", "/#/app/juegos"],
  ["herramientas", "/#/app/herramientas"],
  ["clases", "/#/app/clases"],
  ["estadisticas", "/#/app/stats"],
  ["perfil", "/#/app/profile"],
  ["preguntas", "/#/app/questions"],
  ["planes", "/#/app/planes"],
  ["ayuda", "/#/app/contacto"],
  ["palabra", "/#/app/juego/palabra"],
  ["crucigrama-crear", "/#/app/juego/crucigrama"],
  ["ludo-crear", "/#/app/ludo"],
  ["ruleta", "/#/app/juego/ruleta"],
  ["cronometro", "/#/app/juego/cronometro"],
  ["pizarra", "/#/app/juego/pizarra"],
  ["evaluacion-crear", "/#/app/juego/evaluacion"],
  ["estudio-crear", "/#/app/juego/estudio"],
];

async function preparar(page, tema) {
  await page.addInitScript((t) => localStorage.setItem("yp_theme", t), tema);
}
async function entrar(page) {
  await page.goto("/#/entrar");
  await page.getByRole("button", { name: "Docente", exact: true }).click();
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/#\/app\/inicio$/);
}
async function capturar(page, nombre) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  // Los códigos de sala cambian en cada corrida y sus dígitos tienen distinto ancho
  // (mueven el texto de alrededor): se dejan todos en ceros antes de capturar.
  await page.evaluate(() => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode())
      n.nodeValue = n.nodeValue.replace(/\b\d{3} ?\d{3}\b/g, (m) => m.replace(/\d/g, "0"));
    // también dentro de los campos (el código ya escrito en "Únete a la partida")
    for (const i of document.querySelectorAll("input"))
      i.value = i.value.replace(/\b\d{3} ?\d{3}\b/g, (m) => m.replace(/\d/g, "0"));
  });
  await expect(page).toHaveScreenshot(`${nombre}.png`, {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    mask: TAPAR.map((s) => page.locator(s)),
    maxDiffPixels: 0,
  });
}

for (const [tamano, viewport] of Object.entries(TAMANOS)) {
  for (const tema of TEMAS) {
    test.describe(`${tamano} · ${tema}`, () => {
      test.use({ viewport });

      test("pantallas públicas", async ({ page }) => {
        await preparar(page, tema);
        for (const [nombre, ruta] of PUBLICAS) {
          await page.goto(ruta);
          await capturar(page, `${tamano}-${tema}-${nombre}`);
        }
      });

      test("panel del docente", async ({ page }) => {
        await preparar(page, tema);
        await entrar(page);
        for (const [nombre, ruta] of PANEL) {
          await page.goto(ruta);
          await capturar(page, `${tamano}-${tema}-${nombre}`);
          // Ludo deja el modo docente guardado: se suelta para la pantalla siguiente
          await page.evaluate(() =>
            Object.keys(localStorage)
              .filter((k) => k.startsWith("ludo_"))
              .forEach((k) => localStorage.removeItem(k)),
          );
        }
      });

      test("salas en vivo (proyector) y estudiante", async ({ page, browser }) => {
        await preparar(page, tema);
        await entrar(page);
        await page.goto("/#/app/ludo");
        await page.getByRole("button", { name: "Crear partida", exact: true }).click();
        await expect(page.locator(".cp-proj")).toBeVisible();
        await capturar(page, `${tamano}-${tema}-ludo-sala`);
        const codigo = await page.evaluate(() => localStorage.getItem("ludo_engineer_code"));

        const ctx = await browser.newContext({ viewport });
        const alumno = await ctx.newPage();
        await preparar(alumno, tema);
        await alumno.goto(`/?role=student&code=${codigo}`);
        await expect(alumno.getByText("Únete a la partida")).toBeVisible();
        await capturar(alumno, `${tamano}-${tema}-ludo-estudiante`);
        await ctx.close();

        await page.getByRole("button", { name: "Salir al inicio" }).click();
        await page.goto("/#/app/juego/crucigrama");
        await page.getByRole("button", { name: "Crear crucigrama" }).click();
        await expect(page.locator(".cp-proj")).toBeVisible();
        await capturar(page, `${tamano}-${tema}-crucigrama-sala`);
      });
    });
  }
}
