import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { rsEncode, rsDecode } from "../lib/rs.js";
const rnd = (n) => Uint8Array.from(crypto.randomBytes(n));
test("RS: clean codeword decodes unchanged", () => {
    const d = rnd(40), cw = rsEncode(d, 16);
    assert.equal(cw.length, 56);
    assert.deepEqual(rsDecode(cw, 16), d);
});
test("RS: corrects 1..8 random byte errors (500 trials each)", () => {
    for (let e = 1; e <= 8; e++) {
        for (let t = 0; t < 500; t++) {
            const d = rnd(40), cw = rsEncode(d, 16), bad = Uint8Array.from(cw);
            const pos = new Set();
            while (pos.size < e)
                pos.add(crypto.randomInt(0, 56));
            for (const p of pos)
                bad[p] ^= 1 + crypto.randomInt(0, 255); // always a real change
            const out = rsDecode(bad, 16);
            assert.ok(out, `decode failed with ${e} errors`);
            assert.deepEqual(out, d);
        }
    }
});
test("RS: errors in the parity bytes are corrected too", () => {
    const d = rnd(40), cw = rsEncode(d, 16), bad = Uint8Array.from(cw);
    for (let i = 40; i < 48; i++)
        bad[i] ^= 0xff;
    assert.deepEqual(rsDecode(bad, 16), d);
});
test("RS: never returns wrong data silently for 9+ errors (null, or a different valid codeword that GCM will reject)", () => {
    let nulls = 0;
    for (let t = 0; t < 400; t++) {
        const d = rnd(40), cw = rsEncode(d, 16), bad = Uint8Array.from(cw);
        const pos = new Set();
        while (pos.size < 12)
            pos.add(crypto.randomInt(0, 56));
        for (const p of pos)
            bad[p] ^= 1 + crypto.randomInt(0, 255);
        const out = rsDecode(bad, 16);
        if (out === null)
            nulls++;
    }
    assert.ok(nulls > 380, `expected almost all over-capacity words to be rejected, got ${nulls}/400`);
});
test("RS: random garbage is almost never accepted", () => {
    let accepted = 0;
    for (let t = 0; t < 5000; t++)
        if (rsDecode(rnd(56), 16))
            accepted++;
    assert.ok(accepted < 20, `accepted ${accepted}/5000`);
});
