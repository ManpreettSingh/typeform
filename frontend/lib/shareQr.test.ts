import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { qrMatrix, qrSvg } from "./shareQr";

const TEXT = "https://forms.example.com/f/abc123";

describe("qrMatrix", () => {
  it("is a square grid whose size is a valid QR version (4v + 17)", () => {
    const m = qrMatrix(TEXT);
    assert.ok(m.length >= 21);
    assert.equal((m.length - 17) % 4, 0);
    for (const row of m) assert.equal(row.length, m.length);
  });

  it("draws the three finder patterns in the corners", () => {
    const m = qrMatrix(TEXT);
    const n = m.length;
    // A finder pattern is a 7x7 dark ring, a light ring, and a 3x3 dark center.
    const finder = (r0: number, c0: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3)); // 0..3 from the center
          const dark = ring !== 2;
          assert.equal(m[r0 + r][c0 + c], dark, `module ${r0 + r},${c0 + c}`);
        }
      }
    };
    finder(0, 0);
    finder(0, n - 7);
    finder(n - 7, 0);
  });

  it("is deterministic and depends on the text", () => {
    assert.deepEqual(qrMatrix(TEXT), qrMatrix(TEXT));
    assert.notDeepEqual(qrMatrix(TEXT), qrMatrix(`${TEXT}x`));
  });
});

describe("qrSvg", () => {
  it("renders a scalable SVG with the quiet zone, colors and no external references", () => {
    const n = qrMatrix(TEXT).length;
    const svg = qrSvg(TEXT, { size: 300, margin: 2, dark: "#111111", light: "#fefefe" });
    assert.match(svg, /^<svg /);
    assert.ok(svg.includes(`viewBox="0 0 ${n + 4} ${n + 4}"`));
    assert.ok(svg.includes('width="300"') && svg.includes('height="300"'));
    assert.ok(svg.includes('fill="#fefefe"') && svg.includes('fill="#111111"'));
    assert.ok(!svg.includes("http://") || svg.includes('xmlns="http://www.w3.org/2000/svg"'));
    assert.ok(!/href=|<image|<script/.test(svg));
  });

  it("draws exactly the dark modules (path area equals the dark module count)", () => {
    const m = qrMatrix(TEXT);
    const dark = m.flat().filter(Boolean).length;
    const svg = qrSvg(TEXT, { margin: 0 });
    // Path commands are "M x y h w v1 h-w z": the sum of every `h` width is the dark area.
    const widths = [...svg.matchAll(/h(\d+)v1/g)].map((x) => Number(x[1]));
    assert.equal(
      widths.reduce((a, b) => a + b, 0),
      dark,
    );
  });
});
