import { describe, it, expect, vi } from "vitest";
import { generarCodigo, codigoLibre, reservarCodigo } from "./codigos.js";

const secuencia = (...codigos) => {
  let i = 0;
  return () => codigos[i++];
};

describe("códigos de sala", () => {
  it("siempre tienen 6 dígitos sin cero inicial", () => {
    for (let i = 0; i < 500; i++) expect(generarCodigo()).toMatch(/^[1-9]\d{5}$/);
  });

  it("codigoLibre salta los que ya están en memoria (Map o función)", () => {
    const enUso = new Map([["111111", {}]]);
    expect(codigoLibre(enUso, secuencia("111111", "222222"))).toBe("222222");
    expect(codigoLibre((c) => c === "333333", secuencia("333333", "444444"))).toBe("444444");
  });

  it("reservarCodigo reintenta con otro código si la BD dice 23505", async () => {
    const guardar = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("duplicado"), { code: "23505" }))
      .mockResolvedValueOnce(undefined);
    const code = await reservarCodigo(new Map(), guardar, { generar: secuencia("111111", "222222") });
    expect(code).toBe("222222");
    expect(guardar).toHaveBeenCalledTimes(2);
    expect(guardar).toHaveBeenNthCalledWith(1, "111111");
  });

  it("reservarCodigo no reintenta otros errores y se rinde tras `intentos`", async () => {
    const otro = vi.fn().mockRejectedValue(Object.assign(new Error("caída"), { code: "57P01" }));
    await expect(reservarCodigo(new Map(), otro)).rejects.toThrow("caída");
    expect(otro).toHaveBeenCalledTimes(1);

    const siempreRepetido = vi.fn().mockRejectedValue(Object.assign(new Error("dup"), { code: "23505" }));
    await expect(reservarCodigo(new Map(), siempreRepetido, { intentos: 2 })).rejects.toThrow("dup");
    expect(siempreRepetido).toHaveBeenCalledTimes(3);
  });
});
