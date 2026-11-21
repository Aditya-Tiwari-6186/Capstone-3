import sharp from "sharp";
export const ALGS = ["dwt", "dct"];
export const CELL = 8, ROW = 37, MIN_CELLS = 900;
export const STEP = { dwt: 12, dct: 28 };
export const sharpIn = (b) => sharp(b, { limitInputPixels: 24e6 });
const rawOpt = (i) => ({ raw: { width: i.w, height: i.h, channels: 3 } });
const toImg = (data, info) => {
    if (info.channels !== 3)
        throw new Error("unexpected channel count");
    return { w: info.width, h: info.height, rgb: new Uint8Array(data.buffer, data.byteOffset, data.length) };
};
/** Decode to 8-bit sRGB, honouring EXIF orientation, flattening transparency onto white. */
export async function decodeImage(buf) {
    const { data, info } = await sharpIn(buf).rotate().flatten({ background: "#ffffff" }).toColourspace("srgb").removeAlpha().raw().toBuffer({ resolveWithObject: true });
    return toImg(data, info);
}
export async function encodePng(img) {
    return sharp(Buffer.from(img.rgb.buffer, img.rgb.byteOffset, img.rgb.length), rawOpt(img)).png({ compressionLevel: 6 }).toBuffer();
}
/** Rotate (multiples of 90) and/or mirror; lossless. */
export async function orient(img, rot, flop) {
    let s = sharp(Buffer.from(img.rgb.buffer, img.rgb.byteOffset, img.rgb.length), rawOpt(img));
    if (rot)
        s = s.rotate(rot);
    if (flop)
        s = s.flop();
    const { data, info } = await s.raw().toBuffer({ resolveWithObject: true });
    return toImg(data, info);
}
export async function resizeTo(buf, w, h) {
    const { data, info } = await sharpIn(buf).rotate().flatten({ background: "#ffffff" }).toColourspace("srgb").removeAlpha().resize(w, h, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
    return toImg(data, info);
}
/** The 7 non-identity rotations/mirrors tried when an image comes back turned or flipped. */
export const DIHEDRAL = [[90, false], [180, false], [270, false], [0, true], [90, true], [180, true], [270, true]];
export function luma(img) {
    const n = img.w * img.h, Y = new Float32Array(n), p = img.rgb;
    for (let i = 0, j = 0; i < n; i++, j += 3)
        Y[i] = 0.299 * p[j] + 0.587 * p[j + 1] + 0.114 * p[j + 2];
    return Y;
}
const BASIS = (() => {
    const b = new Float32Array(64), a = (k) => (k ? 0.5 : Math.sqrt(1 / 8));
    for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++)
            b[y * 8 + x] = a(2) * a(3) * Math.cos(((2 * x + 1) * 2 * Math.PI) / 16) * Math.cos(((2 * y + 1) * 3 * Math.PI) / 16);
    return b;
})();
function feat(alg, Y, w, x0, y0) {
    let s = 0;
    for (let y = 0; y < 8; y++) {
        const o = (y0 + y) * w + x0;
        if (alg === "dwt")
            for (let x = 0; x < 8; x++)
                s += Y[o + x];
        else
            for (let x = 0; x < 8; x++)
                s += Y[o + x] * BASIS[y * 8 + x];
    }
    return alg === "dwt" ? s / 64 : s;
}
const qim = (f, b, st) => Math.round((f - (b * st) / 2) / st) * st + (b * st) / 2;
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
export const cellsOf = (w, h) => Math.floor(w / CELL) * Math.floor(h / CELL);
export const fitsWatermark = (w, h) => cellsOf(w, h) >= MIN_CELLS;
/** Embed `bits` (repeated over the whole image, or once when `single`). Returns the new image and PSNR (dB, RGB). */
export function embedBits(img, bits, alg, o = {}) {
    const { w, h } = img, n = bits.length, st = o.step ?? STEP[alg], out = Uint8Array.from(img.rgb), Y = luma(img);
    const cw = Math.floor(w / CELL), ch = Math.floor(h / CELL);
    for (let cy = 0; cy < ch; cy++)
        for (let cx = 0; cx < cw; cx++) {
            const k = cy * cw + cx;
            if (o.single && k >= n)
                continue;
            const idx = o.single ? k : (cx + ROW * cy) % n, x0 = cx * CELL, y0 = cy * CELL;
            const f = feat(alg, Y, w, x0, y0), d = qim(f, bits[idx], st) - f;
            let acc = 0; // error diffusion keeps the cell mean exact although every pixel moves by a whole number
            for (let y = 0; y < 8; y++)
                for (let x = 0; x < 8; x++) {
                    let s;
                    if (alg === "dwt") {
                        acc += d;
                        s = Math.round(acc);
                        acc -= s;
                    }
                    else
                        s = Math.round(d * BASIS[y * 8 + x]);
                    if (s) {
                        const p = ((y0 + y) * w + x0 + x) * 3;
                        out[p] = clamp(out[p] + s);
                        out[p + 1] = clamp(out[p + 1] + s);
                        out[p + 2] = clamp(out[p + 2] + s);
                    }
                }
        }
    let se = 0;
    for (let i = 0; i < out.length; i++) {
        const e = out[i] - img.rgb[i];
        se += e * e;
    }
    return { img: { w, h, rgb: out }, psnr: se ? 10 * Math.log10((255 * 255) / (se / out.length)) : 99 };
}
/**
 * Turn per-cell features into bit votes. With `comp` (default) the global lattice phase is estimated first: when every
 * feature should sit on a lattice point k*step/2, a global brightness shift moves them all by the same amount, which is
 * the circular mean of (feature mod step/2). Subtracting it undoes brightness changes. The phase only fixes the
 * position modulo step/2, so the decoder also tries the bit-inverted reading (see tryVotes in recover.js).
 */
function voteFeatures(F, idx, n, st, comp) {
    const half = st / 2, votes = new Int32Array(n);
    let phase = 0;
    if (comp && F.length) {
        let sx = 0, sy = 0;
        for (let k = 0; k < F.length; k++) {
            const t = (((F[k] % half) + half) % half / half) * 2 * Math.PI;
            sx += Math.cos(t);
            sy += Math.sin(t);
        }
        phase = (Math.atan2(sy, sx) / (2 * Math.PI)) * half;
    }
    for (let k = 0; k < F.length; k++) {
        const f = F[k] - phase, r = ((f % st) + st) % st, d0 = Math.min(r, st - r), d1 = Math.abs(r - half);
        votes[idx[k]] += d1 < d0 ? 1 : -1;
    }
    return { votes, cells: F.length, phase };
}
/** Majority-vote the n bits from a cell grid starting at pixel offset (ox, oy). */
export function voteBits(Y, w, h, alg, n, o = {}) {
    const ox = o.ox ?? 0, oy = o.oy ?? 0, st = o.step ?? STEP[alg], row = o.row ?? ROW;
    const cw = Math.floor((w - ox) / CELL), ch = Math.floor((h - oy) / CELL), F = new Float64Array(Math.max(0, cw * ch)), idx = new Int32Array(F.length);
    let c = 0;
    for (let cy = 0; cy < ch; cy++)
        for (let cx = 0; cx < cw; cx++) {
            const k = cy * cw + cx;
            if (o.single && k >= n)
                continue;
            F[c] = feat(alg, Y, w, ox + cx * CELL, oy + cy * CELL);
            idx[c++] = o.single ? k : (cx + row * cy) % n;
        }
    return voteFeatures(F.subarray(0, c), idx, n, st, o.comp ?? true);
}
/**
 * Watermark evidence as a z-score. For each bit, the votes of all repeated cells agree when a watermark is present and
 * look like coin flips otherwise. Sum_i |v_i - bias| is compared with its null distribution (bias-corrected, because
 * e.g. smooth image areas push every DCT feature towards one lattice and would otherwise look "consistent").
 * ~N(0,1) for an unmarked image; tens for a marked one. z > 6 is treated as "a watermark is present".
 */
export function evidence(v) {
    const n = v.votes.length, R = v.cells / n;
    if (R < 1.5)
        return 0;
    let tot = 0;
    for (let i = 0; i < n; i++)
        tot += v.votes[i];
    const beta = tot / v.cells, varR = R * (1 - beta * beta);
    if (varR < 0.25)
        return 0; // every cell voted the same way: no information
    let s = 0;
    for (let i = 0; i < n; i++)
        s += Math.abs(v.votes[i] - beta * R);
    const mu = n * Math.sqrt((2 * varR) / Math.PI), sd = Math.sqrt(n * varR * (1 - 2 / Math.PI));
    return (s - mu) / sd;
}
/**
 * Evidence relative to an empirical null: the same cells are re-voted with two other (equally valid) bit layouts. A real
 * watermark only "lines up" under the true layout; natural spatial correlation inflates all layouts equally.
 */
export function contrast(Y, w, h, alg, n, ox = 0, oy = 0) {
    const z = (row) => evidence(voteBits(Y, w, h, alg, n, { ox, oy, row }));
    return z(ROW) - Math.max(z(41), z(43));
}
/** Summed-area table of the luma, so the DWT cell mean at ANY pixel offset costs O(1) (used by the crop search). */
export function integral(Y, w, h) {
    const W = w + 1, I = new Float64Array(W * (h + 1));
    for (let y = 0; y < h; y++) {
        let row = 0;
        for (let x = 0; x < w; x++) {
            row += Y[y * w + x];
            I[(y + 1) * W + x + 1] = I[y * W + x + 1] + row;
        }
    }
    return I;
}
export function voteDwtIntegral(I, w, h, n, ox, oy, step = STEP.dwt, row = ROW) {
    const W = w + 1, cw = Math.floor((w - ox) / CELL), ch = Math.floor((h - oy) / CELL), F = new Float64Array(Math.max(0, cw * ch)), idx = new Int32Array(F.length);
    for (let cy = 0; cy < ch; cy++)
        for (let cx = 0; cx < cw; cx++) {
            const x0 = ox + cx * CELL, y0 = oy + cy * CELL, x1 = x0 + CELL, y1 = y0 + CELL, k = cy * cw + cx;
            F[k] = (I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0]) / 64;
            idx[k] = (cx + row * cy) % n;
        }
    return voteFeatures(F, idx, n, step, true);
}
/** SSIM on luma: 8x8 uniform windows, stride 4, standard constants (K1=0.01, K2=0.03, L=255), sample covariance. */
export function ssim(a, b) {
    if (a.w !== b.w || a.h !== b.h)
        throw new Error("size mismatch");
    const Ya = luma(a), Yb = luma(b), w = a.w, C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2, N = 64;
    let acc = 0, cnt = 0;
    for (let y0 = 0; y0 + 8 <= a.h; y0 += 4)
        for (let x0 = 0; x0 + 8 <= w; x0 += 4) {
            let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
            for (let y = 0; y < 8; y++) {
                const o = (y0 + y) * w + x0;
                for (let x = 0; x < 8; x++) {
                    const p = Ya[o + x], q = Yb[o + x];
                    sa += p;
                    sb += q;
                    saa += p * p;
                    sbb += q * q;
                    sab += p * q;
                }
            }
            const ma = sa / N, mb = sb / N, va = (saa - N * ma * ma) / (N - 1), vb = (sbb - N * mb * mb) / (N - 1), cov = (sab - N * ma * mb) / (N - 1);
            acc += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
            cnt++;
        }
    return cnt ? acc / cnt : 1;
}
