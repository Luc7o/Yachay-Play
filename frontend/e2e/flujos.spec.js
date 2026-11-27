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
