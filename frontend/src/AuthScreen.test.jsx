// Pantalla de acceso: login, 2FA, errores del servidor y registro (con la API de mentira).
import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({
  demoAccounts: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  google: vi.fn(),
}));
vi.mock("./api", () => ({ api }));
vi.mock("./GoogleButton", () => ({ GoogleButton: () => null, googleDisponible: () => false }));

import { AuthScreen } from "./AuthScreen";

function Pantalla(props) {
  const [tab, setTab] = useState(props.tab || "login");
  return <AuthScreen tab={tab} setTab={setTab} onBack={() => {}} onGuest={() => {}} onForgot={() => {}} {...props} />;
}
const escribir = (etiqueta, valor) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });

beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset();
  api.demoAccounts.mockResolvedValue({ accounts: [] });
});
afterEach(cleanup);

describe("AuthScreen · iniciar sesión", () => {
  it("el botón se habilita al escribir correo y contraseña, y entra", async () => {
    const onSuccess = vi.fn();
    api.login.mockResolvedValue({ token: "t", user: { id: "1" } });
    render(<Pantalla onSuccess={onSuccess} onNeeds2FA={vi.fn()} />);
    const entrar = screen.getByRole("button", { name: "Entrar" });
    expect(entrar.disabled).toBe(true);
    escribir("Correo electrónico", "ana@uni.edu");
    escribir("Contraseña", "Clave123");
    expect(entrar.disabled).toBe(false);
    fireEvent.click(entrar);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ token: "t", user: { id: "1" } }));
    expect(api.login).toHaveBeenCalledWith("ana@uni.edu", "Clave123");
  });

  it("si la cuenta tiene 2FA, pasa al segundo paso con el challenge", async () => {
    const onNeeds2FA = vi.fn();
    const onSuccess = vi.fn();
    api.login.mockResolvedValue({ needs2FA: true, challenge: "ch" });
    render(<Pantalla onSuccess={onSuccess} onNeeds2FA={onNeeds2FA} />);
    escribir("Correo electrónico", "ana@uni.edu");
    escribir("Contraseña", "Clave123");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(onNeeds2FA).toHaveBeenCalledWith("ch"));
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("muestra el error del servidor", async () => {
    api.login.mockRejectedValue(new Error("Correo o contraseña incorrectos."));
    render(<Pantalla onSuccess={vi.fn()} onNeeds2FA={vi.fn()} />);
    escribir("Correo electrónico", "ana@uni.edu");
    escribir("Contraseña", "mala");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Correo o contraseña incorrectos.");
  });

  it("las cuentas de prueba llenan el formulario con un toque", async () => {
    api.demoAccounts.mockResolvedValue({
      accounts: [{ name: "Docente Demo", email: "docente@demo.co", password: "Docente123", role: "docente" }],
    });
    render(<Pantalla onSuccess={vi.fn()} onNeeds2FA={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Docente/ }));
    expect(screen.getByLabelText("Correo electrónico").value).toBe("docente@demo.co");
    expect(screen.getByLabelText("Contraseña").value).toBe("Docente123");
  });
});

describe("AuthScreen · crear cuenta", () => {
  it("no deja crear la cuenta hasta tener rol, datos válidos, términos y edad", async () => {
    const onSuccess = vi.fn();
    api.register.mockResolvedValue({ token: "t", user: { id: "2" } });
    render(<Pantalla tab="register" onSuccess={onSuccess} onNeeds2FA={vi.fn()} />);
    const crear = screen.getByRole("button", { name: "Crear mi cuenta" });
    expect(crear.disabled).toBe(true);

    fireEvent.click(screen.getAllByRole("radio")[0]);
    escribir("Tu nombre", "Ana Quispe");
    escribir("Correo electrónico", "ana@uni.edu");
    escribir("Contraseña", "ClaveSegura123");
    expect(crear.disabled).toBe(true); // faltan términos y edad
    for (const c of screen.getAllByRole("checkbox")) fireEvent.click(c);
    expect(crear.disabled).toBe(false);

    fireEvent.click(crear);
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(api.register).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Ana Quispe", email: "ana@uni.edu", acceptTerms: true, confirmAge: true }),
    );
  });

  it("cambiar de pestaña limpia el error", async () => {
    api.login.mockRejectedValue(new Error("Algo falló"));
    render(<Pantalla onSuccess={vi.fn()} onNeeds2FA={vi.fn()} />);
    escribir("Correo electrónico", "ana@uni.edu");
    escribir("Contraseña", "x");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("tab", { name: "Crear cuenta" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Crea tu cuenta");
  });
});
