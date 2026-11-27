// Cliente de la API: token, mensajes de error y servidor caído (fetch de mentira).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, getToken, setToken, type ErrorApi } from "./api";

const respuesta = (status: number, body: unknown) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status });

let fetchFalso: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchFalso = vi.fn();
  vi.stubGlobal("fetch", fetchFalso);
  setToken(null);
});
afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("guarda y borra el token de la sesión", () => {
    setToken("abc");
    expect(getToken()).toBe("abc");
    setToken(null);
    expect(getToken()).toBeNull();
  });

  it("manda el token y el cuerpo en JSON", async () => {
    setToken("tok123");
    fetchFalso.mockResolvedValue(respuesta(200, { token: "t", user: { id: "1" } }));
    await api.login("a@b.co", "clave");
    const [url, opciones] = fetchFalso.mock.calls[0];
    expect(url).toMatch(/\/api\/auth\/login$/);
    expect(opciones.method).toBe("POST");
    expect(JSON.parse(opciones.body)).toEqual({ email: "a@b.co", password: "clave" });
    expect(opciones.headers.Authorization).toBe("Bearer tok123");
  });

  it("sin sesión no manda Authorization", async () => {
    fetchFalso.mockResolvedValue(respuesta(200, { user: {} }));
    await api.me();
    expect(fetchFalso.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("muestra el mensaje del servidor y conserva el código HTTP", async () => {
    fetchFalso.mockResolvedValue(respuesta(401, { error: "Correo o contraseña incorrectos." }));
    const e = (await api.login("a@b.co", "x").catch((x) => x)) as ErrorApi;
    expect(e.message).toBe("Correo o contraseña incorrectos.");
    expect(e.status).toBe(401);
  });

  it("si el servidor no explica el error, lo deduce del código", async () => {
    fetchFalso.mockResolvedValue(respuesta(404, "<html>no</html>"));
    await expect(api.me()).rejects.toThrow(/versión anterior/);
    fetchFalso.mockResolvedValue(respuesta(502, ""));
    await expect(api.me()).rejects.toThrow(/problema interno/);
  });

  it("servidor caído: mensaje claro", async () => {
    fetchFalso.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api.me()).rejects.toThrow(/No se pudo conectar con el servidor/);
  });
});
