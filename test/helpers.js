import sharp from "sharp";
import fs from "fs";
import os from "os";
import path from "path";
/** Fresh isolated data dir for a test file (must be called BEFORE importing lib/db). */
export function tmpData() {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "securemark-test-"));
    process.env.SECUREMARK_DATA = d;
    return d;
}
/** Deterministic PRNG so failures are reproducible. */
export function prng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Photo-like synthetic image: smooth low-frequency colour fields + hard-edged shapes + sensor grain. */
export async function makePhoto(w, h, seed = 1) {
    const r = prng(seed), raw = Buffer.alloc(w * h * 3);
    const waves = Array.from({ length: 6 }, () => ({ fx: r() * 0.02 + 0.003, fy: r() * 0.02 + 0.003, px: r() * 6, py: r() * 6, a: 20 + r() * 35 }));
    const shapes = Array.from({ length: 14 }, () => ({ x: r() * w, y: r() * h, rx: 15 + r() * w * 0.15, ry: 15 + r() * h * 0.15, c: [r() * 255, r() * 255, r() * 255] }));
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
            let v = 128;
            for (const k of waves)
                v += k.a * Math.sin(x * k.fx + k.px) * Math.cos(y * k.fy + k.py);
            const px = [v + 10, v, v - 15];
            for (const s of shapes)
                if (((x - s.x) / s.rx) ** 2 + ((y - s.y) / s.ry) ** 2 < 1)
                    for (let c = 0; c < 3; c++)
                        px[c] = 0.7 * s.c[c] + 0.3 * px[c];
            const g = (r() + r() + r() - 1.5) * 8;
            for (let c = 0; c < 3; c++)
                raw[(y * w + x) * 3 + c] = Math.max(0, Math.min(255, Math.round(px[c] + g)));
        }
    return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}
export const SAMPLE_DIR = process.env.SAMPLE_DIR || "";
