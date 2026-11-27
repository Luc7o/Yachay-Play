// Flujos completos con dos navegadores: el docente proyecta y el estudiante juega.
import { test, expect } from "@playwright/test";

// Inicia sesión con la cuenta demo de docente (botón "Cuentas de prueba", solo en desarrollo).
async function entrarComoDocente(page) {
  await page.goto("/#/entrar");
  await page.getByRole("button", { name: "Docente", exact: true }).click();
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/#\/app\/inicio$/);
}

test("navegación del panel con atrás y adelante del navegador", async ({ page }) => {
  await entrarComoDocente(page);
  const menu = page.locator(".cp-side-nav");
  await menu.getByRole("button", { name: "Mis clases" }).click();
  await expect(page).toHaveURL(/#\/app\/clases$/);
  await menu.getByRole("button", { name: "Estadísticas" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Estadísticas de tus clases");
  await page.goBack();
  await expect(page).toHaveURL(/#\/app\/clases$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mis clases");
  await page.goForward();
  await expect(page).toHaveURL(/#\/app\/stats$/);
  // Recargar conserva la pantalla
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Estadísticas de tus clases");
});

test("evaluación rápida: el docente crea, el estudiante responde y aparece en los resultados", async ({
  page,
  browser,
}) => {
  await entrarComoDocente(page);
  await page.goto("/#/app/juego/evaluacion");
  await page.getByLabel("Texto de la pregunta 1").fill("¿Cuánto es 2 + 2?");
  await page.getByLabel("Opción A de la pregunta 1").fill("4");
  await page.getByLabel("Opción B de la pregunta 1").fill("5");
  await page.getByLabel("Marcar la opción A como correcta").click();
  await page.getByRole("button", { name: /Crear sala \(1 pregunta\)/ }).click();
  const codigo = (await page.locator(".qz-codigo").getAttribute("aria-label")).replace(/\D/g, "");
  expect(codigo).toMatch(/^\d{6}$/);

  // El estudiante, en otro navegador y sin cuenta
  const alumno = await (await browser.newContext()).newPage();
  await alumno.goto("/#/juego/evaluacion");
  await alumno.getByPlaceholder("000000").fill(codigo);
  await alumno.getByPlaceholder("Nombre y apellido").fill("Ana Quispe");
  await alumno.getByRole("button", { name: "Entrar", exact: true }).click();

  await expect(page.getByText("Ana Quispe")).toBeVisible();
  await page.getByRole("button", { name: /Iniciar/ }).click();
  await alumno.getByRole("button", { name: /^4$/ }).click();
  // Con todos ya respondidos, la pregunta se cierra sola y se muestra la respuesta.
  await page.getByRole("button", { name: "Ver resultados" }).click();
  const resultados = page.getByRole("table");
  await expect(resultados).toContainText("Ana Quispe");
  await expect(alumno.getByText("¡Evaluación terminada!")).toBeVisible();
});

test("Ludo: el estudiante entra con el enlace y aparece en la sala del docente", async ({ page, browser }) => {
  await entrarComoDocente(page);
  await page.locator(".cp-side-nav").getByRole("button", { name: "Juegos" }).click();
  await page.locator(".cp-tile", { hasText: "Ludo por equipos" }).click();
  await expect(page).toHaveURL(/#\/app\/ludo$/);
  await page.getByRole("button", { name: "Crear partida", exact: true }).click();
  await expect(page.locator(".cp-proj")).toBeVisible();
  const codigo = await page.evaluate(() => localStorage.getItem("ludo_engineer_code"));

  const alumno = await (await browser.newContext()).newPage();
  await alumno.goto(`/?role=student&code=${codigo}`);
  await expect(alumno).toHaveURL(/#\/ludo$/);
  await alumno.getByPlaceholder("Ej. Andrea").fill("Luis");
  await alumno.getByRole("button", { name: "Entrar a la partida" }).click();
  await expect(alumno.getByText("Ya estás dentro")).toBeVisible();

  await expect(page.getByText("Luis")).toBeVisible();
  // Recargar el proyector no pierde la partida
  await page.reload();
  await expect(page.locator(".cp-proj")).toBeVisible();
  await expect(page.getByText("Luis")).toBeVisible();
});

test("reconexión: si el estudiante pierde la red, vuelve a la sala y sigue jugando", async ({ page, browser }) => {
  await entrarComoDocente(page);
  await page.goto("/#/app/juego/evaluacion");
  await page.getByLabel("Texto de la pregunta 1").fill("¿Capital del Perú?");
  await page.getByLabel("Opción A de la pregunta 1").fill("Lima");
  await page.getByLabel("Opción B de la pregunta 1").fill("Cusco");
  await page.getByLabel("Marcar la opción A como correcta").click();
  await page.getByRole("button", { name: /Crear sala \(1 pregunta\)/ }).click();
  const codigo = (await page.locator(".qz-codigo").getAttribute("aria-label")).replace(/\D/g, "");

  const contexto = await browser.newContext();
  const alumno = await contexto.newPage();
  await alumno.goto("/#/juego/evaluacion");
  await alumno.getByPlaceholder("000000").fill(codigo);
  await alumno.getByPlaceholder("Nombre y apellido").fill("Rosa Mamani");
  await alumno.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("Rosa Mamani")).toBeVisible();

  // Se corta la red del estudiante; mientras tanto el docente inicia la evaluación
  await contexto.setOffline(true);
  await alumno.waitForTimeout(1500);
  await page.getByRole("button", { name: /Iniciar/ }).click();
  await contexto.setOffline(false);

  // Al volver la red, el socket se reconecta, re-entra a la sala y recibe la pregunta en curso
  await alumno.getByRole("button", { name: /^Lima$/ }).click({ timeout: 20_000 });
  await page.getByRole("button", { name: "Ver resultados" }).click();
  await expect(page.getByRole("table")).toContainText("Rosa Mamani");
});

test("Palabra en línea: dos estudiantes juegan en la sala que crea el docente", async ({ page, browser }) => {
  await entrarComoDocente(page);
  await page.goto("/#/app/juego/palabra");
  await page.getByRole("button", { name: /En línea/ }).click();
  await page.getByRole("button", { name: "Crear partida →" }).click();
  const codigo = (await page.locator(".pf-bigcode").getAttribute("aria-label")).replace(/\D/g, "");
  expect(codigo).toMatch(/^\d{6}$/);

  // Dos estudiantes sin cuenta, cada uno en su navegador
  const alumnos = [];
  for (const nombre of ["Ana", "Beto"]) {
    const alumno = await (await browser.newContext()).newPage();
    await alumno.goto("/#/juego/palabra");
    await alumno.getByRole("button", { name: /En línea/ }).click();
    await alumno.getByPlaceholder("000000").fill(codigo);
    await alumno.getByPlaceholder("Ej. Andrea").fill(nombre);
    await alumno.getByRole("button", { name: /Unirme/ }).click();
    await expect(alumno.getByText("SALA DE ESPERA")).toBeVisible();
    alumnos.push(alumno);
  }
  await expect(page.locator(".pf-people")).toContainText("Ana");
  await expect(page.locator(".pf-people")).toContainText("Beto");

  await page.getByRole("button", { name: "Empezar partida" }).click();
  // Los dos ven las mismas letras
  const letras = await alumnos[0].locator(".pf-fragment").getAttribute("aria-label");
  await expect(alumnos[1].locator(".pf-fragment")).toHaveAttribute("aria-label", letras);
  // A quien le toca escribe; el servidor responde (acierto o motivo del rechazo)
  const enTurno = (await alumnos[0]
    .getByLabel(/Escribe una palabra/)
    .isEnabled()
    .catch(() => false))
    ? alumnos[0]
    : alumnos[1];
  const campo = enTurno.getByLabel(/Escribe una palabra/);
  await campo.fill("zzzz");
  await campo.press("Enter");
  await expect(enTurno.locator(".pf-msg")).not.toBeEmpty();
});

test("Presentaciones: el estudiante entra con el código y el docente ve su presentación", async ({ page, browser }) => {
  await entrarComoDocente(page);
  await page.goto("/#/app/juego/estudio");
  await page.getByPlaceholder(/Exposición: modelos de regresión/).fill("Exposición de prueba");
  await page.getByRole("button", { name: "Crear sala" }).click();
  const codigo = (await page.locator(".es-code").getAttribute("aria-label")).replace(/\D/g, "");
  expect(codigo).toMatch(/^\d{6}$/);

  const alumno = await (await browser.newContext()).newPage();
  await alumno.goto("/#/juego/estudio");
  await alumno.getByPlaceholder("000000").fill(codigo);
  await alumno.getByPlaceholder("Ej. Andrea").fill("Carla Huamán");
  await alumno.getByRole("button", { name: "Entrar a crear" }).click();
  await expect(alumno.getByText(/Carla Huamán|diapositiva/i).first()).toBeVisible();

  await expect(page.locator("strong", { hasText: "Carla Huamán" })).toBeVisible();
});
