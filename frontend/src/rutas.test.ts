// Las direcciones de siempre deben seguir llevando a la misma pantalla (enlaces y QR ya repartidos).
import { describe, it, expect } from "vitest";
import { leerRuta, base } from "./rutas";

const TOKEN = "a".repeat(32);

describe("leerRuta", () => {
  it.each([
    ["/", { portada: true, enPanel: false }],
    ["/inicio", { portada: true }],
    ["/entrar", { auth: "login" }],
    ["/registro", { auth: "register" }],
    ["/olvide", { olvide: true }],
    [`/restablecer/${TOKEN}`, { restablecer: TOKEN }],
    [`/verificar/${TOKEN}`, { verificar: TOKEN }],
    ["/unirse", { unirse: true }],
    ["/ludo", { ludo: true }],
    ["/juego/ludo", { ludo: true, juego: null }],
    ["/juego/palabra", { juego: "palabra" }],
    ["/app/inicio", { enPanel: true, seccion: "inicio" }],
    ["/app/juegos", { enPanel: true, seccion: "juegos" }],
    ["/app/herramientas", { seccion: "herramientas" }],
    ["/app/stats", { pagina: "stats", seccion: null }],
    ["/app/clases", { pagina: "clases", claseId: null }],
    ["/app/clases/abc%20123", { pagina: "clases", claseId: "abc 123" }],
    ["/app/juego/evaluacion", { enPanel: true, juego: "evaluacion" }],
    ["/app/unirse", { enPanel: true, unirse: true }],
    ["/app/ludo", { enPanel: true, ludo: true }],
  ])("%s", (ruta, esperado) => {
    expect(leerRuta(ruta)).toMatchObject(esperado);
  });

  it("tolera barras de más", () => {
    expect(leerRuta("//app/stats/")).toMatchObject({ enPanel: true, pagina: "stats" });
  });

  it("un enlace de correo con token inválido no se acepta", () => {
    expect(leerRuta("/restablecer/corto").restablecer).toBeUndefined();
    expect(leerRuta("/verificar/<script>").verificar).toBeUndefined();
  });

  it("los enlaces de cuenta no existen dentro del panel", () => {
    expect(leerRuta("/app/entrar").auth).toBeUndefined();
    expect(leerRuta(`/app/restablecer/${TOKEN}`).restablecer).toBeUndefined();
  });

  it("un juego desconocido o una sección rara no rompen nada", () => {
    expect(leerRuta("/juego/inexistente")).toMatchObject({ portada: true, juego: null });
    expect(leerRuta("/app/loquesea")).toMatchObject({ seccion: "inicio", desconocida: true });
    expect(leerRuta("/app/stats/extra")).toMatchObject({ pagina: null, seccion: "inicio", desconocida: true });
  });

  it("base: prefijo con y sin sesión", () => {
    expect(base(null)).toBe("");
    expect(base({ id: 1 })).toBe("/app");
  });
});
