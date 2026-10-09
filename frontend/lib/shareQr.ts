import qrcode from "qrcode-generator";

/** The QR code for `text` as a square grid of modules (true = dark). Error correction M, version picked automatically. */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

export type QrSvgOptions = {
  /** Rendered width and height in px. */
  size?: number;
  /** Quiet zone, in modules (the QR spec asks for 4). */
  margin?: number;
  dark?: string;
  light?: string;
};

/** A self-contained SVG of the QR code (no network, no scripts). Dark modules are merged into horizontal runs. */
export function qrSvg(text: string, { size = 256, margin = 4, dark = "#000000", light = "#ffffff" }: QrSvgOptions = {}): string {
  const m = qrMatrix(text);
  const total = m.length + margin * 2;
  let path = "";
  for (let r = 0; r < m.length; r++) {
    let c = 0;
    while (c < m.length) {
      if (!m[r][c]) {
        c++;
        continue;
      }
      const start = c;
      while (c < m.length && m[r][c]) c++;
      path += `M${start + margin} ${r + margin}h${c - start}v1h-${c - start}z`;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="QR code">` +
    `<rect width="${total}" height="${total}" fill="${light}"/><path fill="${dark}" d="${path}"/></svg>`
  );
}

/** Paints the QR code onto a canvas (for "Download PNG"). `px` is the output width and height. */
export function drawQr(canvas: HTMLCanvasElement, text: string, px: number, margin = 4): void {
  const m = qrMatrix(text);
  const total = m.length + margin * 2;
  const cell = Math.max(1, Math.floor(px / total));
  const side = cell * total; // a whole number of pixels per module keeps the edges crisp
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, side, side);
  ctx.fillStyle = "#000000";
  for (let r = 0; r < m.length; r++) {
    for (let c = 0; c < m.length; c++) {
      if (m[r][c]) ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
    }
  }
}
