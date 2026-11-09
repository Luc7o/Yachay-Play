import { dibujarEscena } from "./dibujo";

export function renderPagina(p, W, H, esc = 2) {
  const off = document.createElement("canvas");
  off.width = Math.max(1, Math.round(W * esc));
  off.height = Math.max(1, Math.round(H * esc));
  const ctx = off.getContext("2d");
  ctx.scale(esc, esc);
  dibujarEscena(ctx, W, H, p, null, null);
  return off;
}

export const aBlob = (cv, tipo, calidad) => new Promise((ok) => cv.toBlob(ok, tipo, calidad));

export function bajar(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// PDF mínimo hecho a mano: una imagen JPEG por página (sin librerías externas)
export function crearPDF(imgs, pw, ph, titulo) {
  const enc = new TextEncoder();
  const partes = [];
  const offs = [];
  let largo = 0;
  const push = (d) => {
    const b = typeof d === "string" ? enc.encode(d) : d;
    partes.push(b);
    largo += b.length;
  };
  const n = imgs.length;
  const num = (v) => (Math.round(v * 100) / 100).toString();
  const hexTitulo = "FEFF" + Array.from(String(titulo || "")).map((ch) => ch.codePointAt(0)).flatMap((cp) => {
    if (cp > 0xffff) { const c = cp - 0x10000; return [0xd800 + (c >> 10), 0xdc00 + (c & 0x3ff)]; }
    return [cp];
  }).map((u) => u.toString(16).padStart(4, "0")).join("").toUpperCase();

  push("%PDF-1.4\n");
  offs[1] = largo;
  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  offs[2] = largo;
  push(`2 0 obj\n<< /Type /Pages /Count ${n} /Kids [${imgs.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] >>\nendobj\n`);
  imgs.forEach((im, i) => {
    const pg = 3 + i * 3;
    const ct = pg + 1;
    const ig = pg + 2;
    offs[pg] = largo;
    push(`${pg} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(pw)} ${num(ph)}] /Resources << /XObject << /Im0 ${ig} 0 R >> >> /Contents ${ct} 0 R >>\nendobj\n`);
    const cont = `q ${num(pw)} 0 0 ${num(ph)} 0 0 cm /Im0 Do Q`;
    offs[ct] = largo;
    push(`${ct} 0 obj\n<< /Length ${cont.length} >>\nstream\n${cont}\nendstream\nendobj\n`);
    offs[ig] = largo;
    push(`${ig} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`);
    push(im.bytes);
    push("\nendstream\nendobj\n");
  });
  const info = 3 + n * 3;
  offs[info] = largo;
  push(`${info} 0 obj\n<< /Title <${hexTitulo}> /Producer (YachayPlay Pizarra) >>\nendobj\n`);
  const xref = largo;
  push(`xref\n0 ${info + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= info; i++) push(`${String(offs[i]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${info + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(partes, { type: "application/pdf" });
}
