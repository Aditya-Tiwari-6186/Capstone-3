import { ALGS, DIHEDRAL, MIN_CELLS, CELL, contrast, cellsOf, decodeImage, evidence, integral, luma, orient, resizeTo, voteBits, voteDwtIntegral } from "./wm.js";
import { NB_ECC, openBits } from "./crypto.js";
/** Contrast z-score above which an image is said to "carry a watermark-like pattern" even if it cannot be decoded. */
export const PATTERN_Z = 15;
const SEARCH_Z = 10; // an offset must show at least this much raw evidence before the 448 bit-shifts are tried there
const bitsAt = (v, shift, neg) => { const n = v.length, b = new Uint8Array(n); for (let i = 0; i < n; i++)
    b[i] = (v[(i + shift) % n] > 0) !== neg ? 1 : 0; return b; };
/** Decode a vote vector at a given cyclic shift, in both polarities (brightness compensation leaves a global bit-flip ambiguity). */
export const tryVotes = (v, shift = 0) => openBits(bitsAt(v, shift, false)) ?? openBits(bitsAt(v, shift, true));
/**
 * Find and decode the watermark in an uploaded image. Tries, cheapest first:
 *  A. as-is  B. rotated / mirrored (7 variants)  C. cropped (pixel-offset + bit-shift search)  D. rescaled to the pixel
 *  size of registered images with the same aspect ratio. Only a payload whose AES-GCM tag verifies counts as found.
 */
export async function recover(buf, db) {
    const up = await decodeImage(buf);
    if (cellsOf(up.w, up.h) < MIN_CELLS / 2)
        return { found: null, up, patternZ: 0 };
    let best = null;
    const note = (v, img, alg, ox, oy) => { const z = evidence(v); if (!best || z > best.z)
        best = { z, img, alg, ox, oy }; return z; };
    const direct = (img, align, aligned) => {
        const Y = luma(img);
        for (const alg of ALGS) {
            const v = voteBits(Y, img.w, img.h, alg, NB_ECC);
            note(v, img, alg, 0, 0);
            const p = tryVotes(v.votes);
            if (p)
                return { ...p, alg, align, aligned };
        }
        return null;
    };
    let f = direct(up, { kind: "none" }, up);
    if (f)
        return { found: f, up, patternZ: PATTERN_Z * 10 };
    for (const [rot, flop] of DIHEDRAL) {
        const im = await orient(up, rot, flop);
        if ((f = direct(im, { kind: "orient", rot, flop }, im)))
            return { found: f, up, patternZ: PATTERN_Z * 10 };
    }
    // C. crop: the cell grid may start at any pixel offset and the bit sequence is cyclically shifted
    const Y = luma(up), I = integral(Y, up.w, up.h), small = up.w * up.h <= 2e6;
    for (const alg of ALGS) {
        if (alg === "dct" && !small)
            continue; // the DCT search has no O(1) trick; keep CPU per request bounded
        const cand = [];
        for (let oy = 0; oy < CELL; oy++)
            for (let ox = 0; ox < CELL; ox++) {
                const v = alg === "dwt" ? voteDwtIntegral(I, up.w, up.h, NB_ECC, ox, oy) : voteBits(Y, up.w, up.h, alg, NB_ECC, { ox, oy });
                const z = note(v, up, alg, ox, oy);
                if (z > SEARCH_Z)
                    cand.push({ z, ox, oy, v });
            }
        cand.sort((a, b) => b.z - a.z);
        for (const c of cand.slice(0, 4))
            for (let s = 0; s < NB_ECC; s++) {
                if (!c.ox && !c.oy && !s)
                    continue; // already tried in A
                const p = tryVotes(c.v.votes, s);
                if (p)
                    return { found: { ...p, alg, align: { kind: "crop", ox: c.ox, oy: c.oy, shift: s }, aligned: null }, up, patternZ: PATTERN_Z * 10 };
            }
    }
    // D. resized: registered images tell us which pixel sizes to try (same aspect ratio within 2%)
    if (db) {
        const seen = new Set(), ar = up.w / up.h;
        for (const im of [...db.images].reverse()) {
            const { w, h } = im.record, key = `${w}x${h}`;
            if (seen.has(key) || (w === up.w && h === up.h) || Math.abs(w / h / ar - 1) > 0.02)
                continue;
            if (seen.size >= 12)
                break;
            seen.add(key);
            const rs = await resizeTo(buf, w, h);
            if ((f = direct(rs, { kind: "resized", from: [up.w, up.h], to: [w, h] }, rs)))
                return { found: f, up, patternZ: PATTERN_Z * 10 };
        }
    }
    // nothing decoded: is there still a watermark-like pattern (damaged beyond repair)?
    const b = best;
    const patternZ = b ? contrast(luma(b.img), b.img.w, b.img.h, b.alg, NB_ECC, b.ox, b.oy) : 0;
    return { found: null, up, patternZ };
}
