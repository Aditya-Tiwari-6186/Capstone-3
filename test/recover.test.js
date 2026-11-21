import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import "./env.js";
import { makePhoto } from "./helpers.js";
import { decodeImage, embedBits, encodePng } from "../lib/wm.js";
import { payloadBits } from "../lib/crypto.js";
import { recover, PATTERN_Z } from "../lib/recover.js";
import * as A from "../scripts/attacks.js";
const REG = 42, OWNER = 7, TS = 1700000000;
const W = 480, H = 360;
let cache = {};
async function marked(alg, seed = 3) {
    const k = alg + seed;
    if (!cache[k])
        cache[k] = await encodePng(embedBits(await decodeImage(await makePhoto(W, H, seed)), payloadBits(REG, OWNER, TS), alg).img);
    return cache[k];
}
const ok = (r, alg) => { assert.ok(r.found, "watermark not recovered"); assert.equal(r.found.reg, REG); assert.equal(r.found.owner, OWNER); assert.equal(r.found.ts, TS); if (alg)
    assert.equal(r.found.alg, alg); return r.found; };
test("clean image: both algorithms recovered, algorithm identified", async () => {
    for (const alg of ["dwt", "dct"])
        ok(await recover(await marked(alg)), alg);
});
test("JPEG q60 and brightness +25 are survived (DWT)", async () => {
    const b = await marked("dwt");
    ok(await recover(await A.jpeg(60)(b)), "dwt");
    ok(await recover(await A.brightness(25)(b)), "dwt");
});
test("moderate Gaussian noise and blur are survived (DWT)", async () => {
    const b = await marked("dwt");
    ok(await recover(await A.noise(8)(b)), "dwt");
    ok(await recover(await A.blur(1)(b)), "dwt");
});
test("cropping at an arbitrary pixel offset is re-synchronised (DWT)", async () => {
    const b = await marked("dwt");
    for (const [f, fx, fy] of [[0.6, 0.3, 0.2], [0.5, 0.77, 0.41], [0.75, 0.05, 0.9]]) {
        const f1 = ok(await recover(await A.cropFrac(f, fx, fy)(b)), "dwt");
        assert.equal(f1.align.kind, "crop");
    }
});
test("rotation by 90/180/270 degrees and mirroring are undone (DWT and DCT)", async () => {
    for (const alg of ["dwt", "dct"]) {
        const b = await marked(alg);
        for (const deg of [90, 180, 270]) {
            const f = ok(await recover(await A.rotate(deg)(b)), alg);
            assert.equal(f.align.kind, "orient");
        }
        ok(await recover(await A.flop(b)), alg);
    }
});
test("a resized copy is found when a registered image of that size exists (DWT)", async () => {
    const b = await marked("dwt"), db = { images: [{ record: { w: W, h: H } }] };
    const small = await A.resize(0.6)(b);
    const f = ok(await recover(small, db), "dwt");
    assert.equal(f.align.kind, "resized");
    assert.equal(f.aligned.w, W);
});
test("arbitrary-angle rotation is NOT recovered (documented limitation) and does not crash", async () => {
    const r = await recover(await A.rotate(7)(await marked("dwt")));
    assert.equal(r.found, null);
});
test("an unmarked photo: nothing found, no watermark-like pattern reported", async () => {
    const r = await recover(await makePhoto(W, H, 11));
    assert.equal(r.found, null);
    assert.ok(r.patternZ < PATTERN_Z, `patternZ ${r.patternZ}`);
});
test("a marked image destroyed by heavy noise is reported as damaged-but-present or not found, never as a wrong owner", async () => {
    const r = await recover(await A.noise(60)(await marked("dwt")));
    if (r.found)
        ok(r); // if it decodes at all, it must be the right payload (GCM tag)
    else
        assert.ok(r.patternZ >= 0);
});
test("a tiny image cannot carry the watermark and is handled without error", async () => {
    const tiny = await sharp(await makePhoto(120, 90, 5)).png().toBuffer();
    const r = await recover(tiny);
    assert.equal(r.found, null);
});
