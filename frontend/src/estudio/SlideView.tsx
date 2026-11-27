import React, { memo } from "react";
import { W, H } from "./model";
import type { SinTipo } from "../tipos";

// Dibuja UN elemento (texto, forma o imagen) en el lienzo lógico de 960 x 540.
export function ElementoVista({ el }: { el: SinTipo }) {
  const base: React.CSSProperties = {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.w,
    height: el.h,
    boxSizing: "border-box",
  };
  if (el.type === "text") {
    return (
      <div
        style={{
          ...base,
          fontSize: el.size,
          lineHeight: 1.2,
          color: el.color,
          fontWeight: el.bold ? 800 : 500,
          fontStyle: el.italic ? "italic" : "normal",
          textDecoration: el.underline ? "underline" : "none",
          textAlign: el.align,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflow: "hidden",
          padding: "4px 6px",
        }}
      >
        {el.text}
      </div>
    );
  }
  if (el.type === "image")
    return <img src={el.src} alt="" draggable={false} style={{ ...base, objectFit: "fill", userSelect: "none" }} />;
  return <div style={{ ...base, background: el.fill, borderRadius: el.type === "ellipse" ? "50%" : 10 }} />;
}

// Diapositiva de solo lectura, escalada a un ancho dado (miniaturas, vista del docente, presentar).
export const SlideView = memo(function SlideView({ slide, width }: { slide: SinTipo; width: number }) {
  const s = width / W;
  return (
    <div className="es-sv" style={{ width, height: H * s }}>
      <div
        className="es-sv-in"
        style={{ width: W, height: H, transform: `scale(${s})`, background: slide?.bg || "#fff" }}
      >
        {slide?.elements.map((el) => (
          <ElementoVista key={el.id} el={el} />
        ))}
      </div>
    </div>
  );
});
