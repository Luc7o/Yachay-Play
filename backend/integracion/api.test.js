// ============================================================================
// PRUEBAS DE INTEGRACIÓN DE LA API (server.js real + PostgreSQL en memoria)
// ============================================================================
// Recorren los flujos completos como lo haría el frontend: registro, login,
// verificación de correo, recuperar contraseña, 2FA y clases (docente y estudiante).
// ============================================================================
import crypto from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { levantar } from "./entorno.js";

let env;
beforeAll(async () => {
  env = await levantar();
}, 90_000);
afterAll(async () => {
  await env?.cerrar();
});

const pedir = (...a) => env.pedir(...a);

// TOTP propio (RFC 6238) para no depender del código que se está probando.
function totp(secretoB32, paso = Math.floor(Date.now() / 30_000)) {
  const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0,
    valor = 0;
  const bytes = [];
  for (const c of secretoB32) {
    valor = (valor << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(paso));
  const h = crypto.createHmac("sha1", Buffer.from(bytes)).update(contador).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, "0");
}

let n = 0;
const correoNuevo = (pre) => `${pre}${Date.now()}${n++}@prueba.test`;
async function registrar(role, extra = {}) {
  const email = correoNuevo(role);
  const r = await pedir("POST", "/api/auth/register", {
    body: {
      name: `Cuenta ${role}`,
      email,
      password: "ClaveSegura123",
      role,
      acceptTerms: true,
      confirmAge: true,
      ...extra,
    },
  });
  expect(r.status).toBe(201);
  return { email, token: r.body.token, user: r.body.user };
}

describe("cuentas", () => {
  it("registro: crea la cuenta y entrega sesión", async () => {
    const { token, user } = await registrar("docente");
    expect(user.role).toBe("docente");
    const me = await pedir("GET", "/api/auth/me", { token });
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(user.id);
  });

  it("registro: rechaza datos inválidos y correos repetidos", async () => {
    const malo = await pedir("POST", "/api/auth/register", {
      body: { name: "A", email: "x", password: "1", role: "docente" },
    });
    expect(malo.status).toBe(400);
    const sinTerminos = await pedir("POST", "/api/auth/register", {
      body: { name: "Ana", email: correoNuevo("t"), password: "ClaveSegura123", role: "docente", confirmAge: true },
    });
    expect(sinTerminos.status).toBe(400);
    const { email } = await registrar("estudiante");
    const repetido = await pedir("POST", "/api/auth/register", {
      body: {
        name: "Otra",
        email,
        password: "ClaveSegura123",
        role: "estudiante",
        acceptTerms: true,
        confirmAge: true,
      },
    });
    expect(repetido.status).toBe(409);
  });

  it("login: acepta la clave correcta y rechaza la incorrecta sin delatar el correo", async () => {
    const { email } = await registrar("estudiante");
    const ok = await pedir("POST", "/api/auth/login", { body: { email, password: "ClaveSegura123" } });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();
    const mala = await pedir("POST", "/api/auth/login", { body: { email, password: "otra-clave" } });
    const noExiste = await pedir("POST", "/api/auth/login", { body: { email: correoNuevo("nadie"), password: "x" } });
    expect(mala.status).toBe(401);
    expect(noExiste.status).toBe(401);
    expect(mala.body.error).toBe(noExiste.body.error);
  });

  it("sin sesión o con token falso, /me responde 401", async () => {
    expect((await pedir("GET", "/api/auth/me")).status).toBe(401);
    expect((await pedir("GET", "/api/auth/me", { token: "no-es-un-token" })).status).toBe(401);
  });

  it("cuentas demo: se ofrecen en desarrollo y sirven para entrar", async () => {
    const demo = await pedir("GET", "/api/auth/demo");
    const docente = demo.body.accounts.find((a) => a.role === "docente");
    expect(docente).toBeTruthy();
    const r = await pedir("POST", "/api/auth/login", { body: { email: docente.email, password: docente.password } });
    expect(r.status).toBe(200);
  });

  it("verificación de correo: el enlace del correo verifica la cuenta y no se reutiliza", async () => {
    const { email, token } = await registrar("docente");
    expect((await pedir("GET", "/api/auth/me", { token })).body.user.emailVerified).toBeFalsy();
    const enlace = await env.tokenDelCorreo(email, "verificar");
    const r = await pedir("POST", "/api/auth/verify-email", { body: { token: enlace } });
    expect(r.status).toBe(200);
    expect((await pedir("GET", "/api/auth/me", { token })).body.user.emailVerified).toBeTruthy();
    expect((await pedir("POST", "/api/auth/verify-email", { body: { token: enlace } })).status).toBe(400);
  });

  it("recuperar contraseña: el enlace cambia la clave, cierra las sesiones y es de un solo uso", async () => {
    const { email, token: viejo } = await registrar("estudiante");
    const pedido = await pedir("POST", "/api/auth/forgot", { body: { email } });
    expect(pedido.status).toBe(200);
    // la respuesta es la misma aunque el correo no exista
    const otro = await pedir("POST", "/api/auth/forgot", { body: { email: correoNuevo("nadie") } });
    expect(otro.body).toEqual(pedido.body);

    const enlace = await env.tokenDelCorreo(email, "restablecer");
    const r = await pedir("POST", "/api/auth/reset", { body: { token: enlace, password: "NuevaClave456" } });
    expect(r.status).toBe(200);
    expect((await pedir("POST", "/api/auth/reset", { body: { token: enlace, password: "OtraClave789" } })).status).toBe(
      400,
    );
    expect((await pedir("GET", "/api/auth/me", { token: viejo })).status).toBe(401); // sesión anterior cerrada
    expect((await pedir("POST", "/api/auth/login", { body: { email, password: "ClaveSegura123" } })).status).toBe(401);
    expect((await pedir("POST", "/api/auth/login", { body: { email, password: "NuevaClave456" } })).status).toBe(200);
  });

  it("cerrar sesión en todos los dispositivos invalida los tokens anteriores", async () => {
    const { token } = await registrar("docente");
    const r = await pedir("POST", "/api/auth/logout-all", { token });
    expect(r.status).toBe(200);
    expect((await pedir("GET", "/api/auth/me", { token })).status).toBe(401);
    expect((await pedir("GET", "/api/auth/me", { token: r.body.token })).status).toBe(200);
  });
});

describe("verificación en dos pasos (2FA)", () => {
  it("activar, entrar con código, usar un código de recuperación y desactivar", async () => {
    const { email, token } = await registrar("docente");

    // pide la contraseña para generar el secreto
    expect((await pedir("POST", "/api/auth/2fa/setup", { token, body: { password: "mala" } })).status).toBe(401);
    const setup = await pedir("POST", "/api/auth/2fa/setup", { token, body: { password: "ClaveSegura123" } });
    expect(setup.status).toBe(200);
    expect(setup.body.qr).toMatch(/^data:image/);
    const secreto = setup.body.secret;

    expect((await pedir("POST", "/api/auth/2fa/enable", { token, body: { code: "000000" } })).status).toBe(400);
    const paso = Math.floor(Date.now() / 30_000);
    const enable = await pedir("POST", "/api/auth/2fa/enable", { token, body: { code: totp(secreto, paso) } });
    expect(enable.status).toBe(200);
    expect(enable.body.recoveryCodes).toHaveLength(8);
    expect(enable.body.user.twoFactorEnabled).toBe(true);

    // ahora el login pide el 2.º paso
    const login = await pedir("POST", "/api/auth/login", { body: { email, password: "ClaveSegura123" } });
    expect(login.body.needs2FA).toBe(true);
    expect(login.body.token).toBeUndefined();
    const challenge = login.body.challenge;
    // el mismo código ya usado no vale otra vez
    expect(
      (await pedir("POST", "/api/auth/login/2fa", { body: { challenge, code: totp(secreto, paso) } })).status,
    ).toBe(401);
    const dos = await pedir("POST", "/api/auth/login/2fa", { body: { challenge, code: totp(secreto, paso + 1) } });
    expect(dos.status).toBe(200);
    expect(dos.body.token).toBeTruthy();

    // un código de recuperación sirve una sola vez
    const rec = enable.body.recoveryCodes[0];
    const l2 = await pedir("POST", "/api/auth/login", { body: { email, password: "ClaveSegura123" } });
    const conRec = await pedir("POST", "/api/auth/login/2fa", { body: { challenge: l2.body.challenge, code: rec } });
    expect(conRec.status).toBe(200);
    expect(conRec.body.recoveryLeft).toBe(7);
    const l3 = await pedir("POST", "/api/auth/login", { body: { email, password: "ClaveSegura123" } });
    expect(
      (await pedir("POST", "/api/auth/login/2fa", { body: { challenge: l3.body.challenge, code: rec } })).status,
    ).toBe(401);

    // desactivar pide contraseña y código
    const sesion = conRec.body.token;
    const otroRec = enable.body.recoveryCodes[1];
    expect(
      (await pedir("POST", "/api/auth/2fa/disable", { token: sesion, body: { password: "mala", code: otroRec } }))
        .status,
    ).toBe(401);
    const off = await pedir("POST", "/api/auth/2fa/disable", {
      token: sesion,
      body: { password: "ClaveSegura123", code: otroRec },
    });
    expect(off.status).toBe(200);
    expect(off.body.user.twoFactorEnabled).toBe(false);
    const l4 = await pedir("POST", "/api/auth/login", { body: { email, password: "ClaveSegura123" } });
    expect(l4.body.token).toBeTruthy();
  });

  it("un challenge falso no da sesión", async () => {
    const r = await pedir("POST", "/api/auth/login/2fa", { body: { challenge: "inventado", code: "123456" } });
    expect(r.status).toBe(401);
  });
});

describe("clases", () => {
  it("el docente crea una clase y el estudiante se inscribe con el código", async () => {
    const docente = await registrar("docente");
    const estudiante = await registrar("estudiante");

    expect((await pedir("POST", "/api/classes", { token: docente.token, body: { name: "" } })).status).toBe(400);
    const creada = await pedir("POST", "/api/classes", {
      token: docente.token,
      body: { name: "Física I", section: "A" },
    });
    expect(creada.status).toBe(201);
    const { id, code } = creada.body.class;
    expect(code).toBeTruthy();

    // un estudiante no crea clases; un docente no se inscribe
    expect((await pedir("POST", "/api/classes", { token: estudiante.token, body: { name: "X" } })).status).toBe(403);
    expect((await pedir("POST", "/api/classes/join", { token: docente.token, body: { code } })).status).toBe(403);

    expect(
      (await pedir("POST", "/api/classes/join", { token: estudiante.token, body: { code: "ZZZZZZ" } })).status,
    ).toBe(404);
    const join = await pedir("POST", "/api/classes/join", { token: estudiante.token, body: { code } });
    expect(join.status).toBe(200);
    expect(join.body.class.id).toBe(id);

    const mias = await pedir("GET", "/api/classes", { token: estudiante.token });
    expect(mias.body.classes.map((c) => c.id)).toContain(id);

    // el dueño ve el código y los miembros; el estudiante no ve el código
    const det = await pedir("GET", `/api/classes/${id}`, { token: docente.token });
    expect(det.body.class.code).toBe(code);
    expect(det.body.class.members.map((m) => m.id)).toContain(estudiante.user.id);
    const detEst = await pedir("GET", `/api/classes/${id}`, { token: estudiante.token });
    expect(detEst.status).toBe(200);
    expect(detEst.body.class.code).toBeUndefined();
    expect(detEst.body.class.members).toBeUndefined();

    const listaDoc = await pedir("GET", "/api/classes", { token: docente.token });
    expect(listaDoc.body.classes.find((c) => c.id === id).members).toBe(1);
  });

  it("solo el dueño edita, cambia el código y archiva", async () => {
    const docente = await registrar("docente");
    const intruso = await registrar("docente");
    const { id, code } = (await pedir("POST", "/api/classes", { token: docente.token, body: { name: "Álgebra" } })).body
      .class;

    expect((await pedir("PATCH", `/api/classes/${id}`, { token: intruso.token, body: { name: "Hack" } })).status).toBe(
      404,
    );
    expect((await pedir("GET", `/api/classes/${id}`, { token: intruso.token })).status).toBe(404);

    const edit = await pedir("PATCH", `/api/classes/${id}`, { token: docente.token, body: { name: "Álgebra II" } });
    expect(edit.body.name).toBe("Álgebra II");

    const nuevo = await pedir("POST", `/api/classes/${id}/code`, { token: docente.token });
    expect(nuevo.body.code).toBeTruthy();
    expect(nuevo.body.code).not.toBe(code);
    const est = await registrar("estudiante");
    expect((await pedir("POST", "/api/classes/join", { token: est.token, body: { code } })).status).toBe(404); // el viejo ya no sirve

    expect((await pedir("DELETE", `/api/classes/${id}`, { token: docente.token })).status).toBe(200);
    const lista = await pedir("GET", "/api/classes", { token: docente.token });
    expect(lista.body.classes.map((c) => c.id)).not.toContain(id);
  });

  it("el estudiante puede salirse; el dueño puede quitarlo; otro estudiante no", async () => {
    const docente = await registrar("docente");
    const a = await registrar("estudiante");
    const b = await registrar("estudiante");
    const { id, code } = (await pedir("POST", "/api/classes", { token: docente.token, body: { name: "Química" } })).body
      .class;
    await pedir("POST", "/api/classes/join", { token: a.token, body: { code } });
    await pedir("POST", "/api/classes/join", { token: b.token, body: { code } });

    expect((await pedir("DELETE", `/api/classes/${id}/members/${b.user.id}`, { token: a.token })).status).toBe(403);
    expect((await pedir("DELETE", `/api/classes/${id}/members/me`, { token: a.token })).status).toBe(200);
    expect((await pedir("DELETE", `/api/classes/${id}/members/${b.user.id}`, { token: docente.token })).status).toBe(
      200,
    );
    const det = await pedir("GET", `/api/classes/${id}`, { token: docente.token });
    expect(det.body.class.members).toHaveLength(0);
  });

  it("sin sesión no hay acceso a clases", async () => {
    expect((await pedir("GET", "/api/classes")).status).toBe(401);
  });
});
