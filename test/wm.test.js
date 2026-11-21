import test from "node:test";
import assert from "node:assert/strict";
import "./env.js";
import { makePhoto } from "./helpers.js";
import { decodeImage, encodePng, embedBits, voteBits, evidence, contrast, luma, ssim, ALGS } from "../lib/wm.js";
import { payloadBits, openBits, NB_ECC } from "../lib/crypto.js";
const bitsOf = (v, shift = 0) => Uint8Array.from(v, (_, i) => (v[(i + shift) % v.length] > 0 ? 1 : 0));
test("embed -> PNG -> decode -> extract round-trips for both algorithms", async () => {
    const src = await decodeImage(await makePhoto(400, 320, 7));
    for (const alg of ALGS) {
        const bits = payloadBits(12, 3, 1700000000);
        const { img, psnr } = embedBits(src, bits, alg);
        const back = await decodeImage(await encodePng(img));
        const p = openBits(bitsOf(voteBits(luma(back), back.w, back.h, alg, NB_ECC).votes));
        assert.deepEqual(p && { reg: p.reg, owner: p.owner, ts: p.ts }, { reg: 12, owner: 3, ts: 1700000000 }, alg);
        assert.ok(psnr > 33, `${alg} PSNR ${psnr}`);
        assert.ok(ssim(src, back) > 0.9, `${alg} SSIM`);
    }
});
test("an unmarked image yields no valid payload and no watermark evidence", async () => {
    const img = await decodeImage(await makePhoto(400, 320, 9));
    for (const alg of ALGS) {
        const v = voteBits(luma(img), img.w, img.h, alg, NB_ECC);
        assert.equal(openBits(bitsOf(v.votes)), null);
        assert.ok(Math.abs(contrast(luma(img), img.w, img.h, alg, NB_ECC)) < 6, `${alg} contrast=${contrast(luma(img), img.w, img.h, alg, NB_ECC)}`);
        void evidence;
    }
});
test("a marked image shows overwhelming watermark evidence", async () => {
    const src = await decodeImage(await makePhoto(400, 320, 7));
    for (const alg of ALGS) {
        const { img } = embedBits(src, payloadBits(5, 1, 1700000000), alg);
        const z = evidence(voteBits(luma(img), img.w, img.h, alg, NB_ECC));
        assert.ok(z > 20, `${alg} z=${z}`);
    }
});
