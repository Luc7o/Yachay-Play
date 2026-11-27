// Componentes compartidos: las clases que esperan los estilos y el comportamiento básico.
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Button, Card, PageHeader, Field, Input, Tile, StatCard, StatGrid, Chip, Row } from "./index";

afterEach(cleanup);

describe("Button", () => {
  it("es type=button por defecto (no envía formularios sin querer)", () => {
    render(<Button>Guardar</Button>);
    const b = screen.getByRole("button", { name: "Guardar" });
    expect(b.getAttribute("type")).toBe("button");
    expect(b.className).toBe("cp-btn primary");
  });

  it("variante, tamaño, clase extra y submit", () => {
    render(
      <Button variant="danger" size="sm" className="x" type="submit">
        Borrar
      </Button>,
    );
    const b = screen.getByRole("button");
    expect(b.className).toBe("cp-btn danger sm x");
    expect(b.getAttribute("type")).toBe("submit");
  });

  it("llama a onClick y respeta disabled", () => {
    const f = vi.fn();
    const { rerender } = render(<Button onClick={f}>Ir</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(f).toHaveBeenCalledTimes(1);
    rerender(
      <Button onClick={f} disabled>
        Ir
      </Button>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe("Card y PageHeader", () => {
  it("Card: encabezado solo si hay título o acciones; etiqueta configurable", () => {
    const { container, rerender } = render(<Card>contenido</Card>);
    expect(container.querySelector("section.cp-card.ui-card")).toBeTruthy();
    expect(container.querySelector("header")).toBeNull();
    rerender(
      <Card as="article" title="Resumen" actions={<button>Más</button>}>
        x
      </Card>,
    );
    expect(container.querySelector("article h2")?.textContent).toBe("Resumen");
    expect(screen.getByRole("button", { name: "Más" })).toBeTruthy();
  });

  it("PageHeader: título como h1 y partes opcionales", () => {
    const { container } = render(<PageHeader eyebrow="Docente" title="Mis clases" lead="Todas tus clases" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Mis clases");
    expect(container.querySelector(".cp-eyebrow")?.textContent).toBe("Docente");
    expect(container.querySelector(".ui-pagehead-actions")).toBeNull();
  });
});

describe("Field e Input", () => {
  it("la etiqueta queda unida al campo", () => {
    render(
      <Field label="Correo" htmlFor="correo" hint="El de la universidad">
        <Input id="correo" />
      </Field>,
    );
    const campo = screen.getByLabelText("Correo");
    expect(campo.className).toBe("cp-input");
    expect(screen.getByText("El de la universidad").className).toBe("ui-hint");
  });

  it("Input reenvía la ref", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} defaultValue="hola" />);
    expect(ref.current?.value).toBe("hola");
  });
});

describe("Tile, estadísticas, chips y filas", () => {
  it("Tile lleva el color de su actividad y es un botón", () => {
    const f = vi.fn();
    render(<Tile title="Ludo" desc="Por equipos" tono="ludo" cta="Abrir" onClick={f} />);
    const b = screen.getByRole("button");
    expect(b.className).toBe("cp-tile tono-ludo");
    fireEvent.click(b);
    expect(f).toHaveBeenCalled();
    expect(screen.getByText("Abrir").className).toBe("cp-tile-cta");
  });

  it("StatGrid, StatCard, Chip y Row", () => {
    const { container } = render(
      <StatGrid>
        <StatCard label="Partidas" value={3} note="0 terminadas" />
        <Chip tone="live">En vivo</Chip>
        <Row title="Física" detail="Sección A" end={<span>12</span>} />
      </StatGrid>,
    );
    expect(container.querySelector(".ui-stats .ui-stat strong")?.textContent).toBe("3");
    expect(screen.getByText("En vivo").className).toBe("cp-chip live");
    expect(container.querySelector(".ui-row-main b")?.textContent).toBe("Física");
  });
});
