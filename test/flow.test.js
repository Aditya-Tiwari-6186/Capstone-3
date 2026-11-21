import test from "node:test";
import assert from "node:assert/strict";
import "./env.js";
import { makePhoto } from "./helpers.js";
import { mutate, load, auditChainOk } from "../lib/db.js";
import { registerImage } from "../lib/register.js";
import { verifyImage } from "../lib/verify.js";
import { sha256 } from "../lib/util.js";
import * as A from "../scripts/attacks.js";
import { execFileSync } from "node:child_process";
import fs from "fs";
import path from "path";
import { FILES } from "../lib/db.js";
const who = { userId: null, ip: "1.2.3.4" };
let alice, bob, orig, protectedPng, regId = "";
test("setup: two users and one registered image", async () => {
    await mutate(d => {
        for (const [i, name] of ["Alice", "Bob"].entries())
            d.users.push({ id: "u" + i, n: ++d.seq.user, name, email: name + "@x.io", hash: "x", role: "USER", active: true, verified: true, tv: 0, at: new Date().toISOString() });
    });
    [alice, bob] = (await load()).users;
    orig = await makePhoto(512, 384, 21);
    const r = await registerImage(alice, orig, "holiday photo.png", "dwt");
    regId = r.regId;
    assert.match(r.regId, /^SMK-\d{4}-000001$/);
    assert.ok(r.psnr > 30 && r.ssim > 0.9);
    protectedPng = fs.readFileSync(path.join(FILES, r.id + ".png"));
});
test("registered copy verifies as VERIFIED with owner and valid signature", async () => {
    const v = await verifyImage(protectedPng, who);
    assert.equal(v.status, "VERIFIED");
    assert.equal(v.owner, "Alice");
    assert.equal(v.regId, regId);
    assert.equal(v.recordSignatureValid, true);
    assert.equal(v.cryptoValid, true);
});
test("JPEG re-save: MODIFIED but classified as re-encoded, zero changed blocks (the old exact-pixel check flagged everything)", async () => {
    for (const q of [92, 75, 60]) {
        const v = await verifyImage(await A.jpeg(q)(protectedPng), who);
        assert.equal(v.status, "MODIFIED", `q${q}`);
        assert.equal(v.kind, "reencoded", `q${q} ${JSON.stringify(v.tamper && { pct: v.tamper.pct })}`);
        assert.equal(v.tamper.bad.length, 0);
    }
});
test("pasted patch: localised to the right blocks only", async () => {
    const v = await verifyImage(await A.paste(256, 192, 96, 0.05, 0.05)(protectedPng), who);
    assert.equal(v.status, "MODIFIED");
    assert.equal(v.kind, "local");
    const t = v.tamper, cols = new Set(t.bad.map(i => i % t.gw)), rows = new Set(t.bad.map(i => Math.floor(i / t.gw)));
    assert.ok(t.bad.length >= 4 && t.pct < 15, `pct ${t.pct}`);
    assert.ok([...cols].every(c => c >= 7 && c <= 11) && [...rows].every(r => r >= 5 && r <= 9), "changed blocks must lie around the pasted area");
    assert.ok(v.heatmap?.startsWith("data:image/jpeg;base64,"));
});
test("brightness edits are survived and classified as a global change", async () => {
    const v = await verifyImage(await A.brightness(30)(protectedPng), who);
    assert.equal(v.status, "MODIFIED");
    assert.equal(v.kind, "global");
    assert.ok(v.tamper && v.tamper.pct > 80, `pct ${v.tamper?.pct}`);
});
test("strong contrast scaling destroys the watermark (documented limit): reported honestly as not found, never as verified", async () => {
    const v = await verifyImage(await A.contrastBy(1.4)(protectedPng), who);
    assert.notEqual(v.status, "VERIFIED");
    assert.equal(v.cryptoValid, false);
    assert.match(v.reason || "", /does not prove/);
});
test("cropped copy: MODIFIED, reported as cropped with retained percentage, no bogus heatmap", async () => {
    const v = await verifyImage(await A.cropFrac(0.5, 0.4, 0.3)(protectedPng), who);
    assert.equal(v.status, "MODIFIED");
    assert.equal(v.kind, "cropped");
    assert.ok(Math.abs(v.retainedPct - 50) < 3);
    assert.equal(v.heatmap, undefined);
});
test("rotated by 90 degrees: recovered, compared in registered orientation, flagged as re-encoded geometry only", async () => {
    const v = await verifyImage(await A.rotate(90)(protectedPng), who);
    assert.equal(v.status, "MODIFIED");
    assert.match(v.align || "", /rotated (90|270)/);
    assert.equal(v.tamper?.bad.length, 0);
});
test("the original, unprotected upload verifies as UNREGISTERED (not VERIFIED)", async () => {
    const v = await verifyImage(orig, who);
    assert.equal(v.status, "UNREGISTERED");
    assert.equal(v.cryptoValid, false);
});
test("duplicates are rejected: same file, and an already-watermarked copy submitted by someone else", async () => {
    await assert.rejects(registerImage(alice, orig, "again.png", "dwt"), /already registered/);
    await assert.rejects(registerImage(bob, protectedPng, "stolen.png", "dwt"), /already registered/);
    await assert.rejects(registerImage(bob, await A.jpeg(80)(protectedPng), "recompressed.jpg", "dwt"), /already carries a SecureMark watermark/);
    await assert.rejects(registerImage(bob, await A.cropFrac(0.6, 0.3, 0.3)(protectedPng), "cropped.png", "dwt"), /already carries/);
    const mismatchImage = path.join(FILES, "wrong-key-recompressed.jpg");
    fs.writeFileSync(mismatchImage, await A.jpeg(80)(protectedPng));
    try {
        const script = `import fs from "node:fs"; import { registerImage } from "./lib/register.js"; try { await registerImage({ id: "u1", n: 2 }, fs.readFileSync(process.argv[1]), "wrong-key.jpg", "dwt"); process.exitCode = 1; } catch (e) { if (e.status !== 409 || !e.message.includes("SecureMark-like watermark")) { console.error(e); process.exitCode = 2; } }`;
        assert.doesNotThrow(() => execFileSync(process.execPath, ["--input-type=module", "-e", script, mismatchImage], {
            cwd: process.cwd(),
            env: { ...process.env, SECUREMARK_SECRET: "different-key-for-test" },
        }));
    }
    finally {
        fs.unlinkSync(mismatchImage);
    }
});
test("validation: garbage, tiny and unsupported inputs get clear errors", async () => {
    await assert.rejects(registerImage(bob, Buffer.from("not an image at all"), "x.png", "dwt"), /not a readable image/);
    await assert.rejects(registerImage(bob, await makePhoto(100, 100, 2), "tiny.png", "dwt"), /too small/);
    await assert.rejects(verifyImage(Buffer.from("junk"), who), /not a readable image/);
});
test("DCT registration works and is identified as DCT", async () => {
    const img = await makePhoto(448, 352, 33), r = await registerImage(bob, img, "dct.png", "dct");
    const v = await verifyImage(fs.readFileSync(path.join(FILES, r.id + ".png")), who);
    assert.equal(v.status, "VERIFIED");
    assert.equal(v.alg, "dct");
    assert.equal(v.owner, "Bob");
});
test("tampering with a stored record is detected through the Ed25519 signature", async () => {
    await mutate(d => { d.images[0].record.at = "2001-01-01T00:00:00.000Z"; });
    const v = await verifyImage(protectedPng, who);
    assert.equal(v.status, "INCONCLUSIVE");
    assert.equal(v.recordSignatureValid, false);
});
test("audit log is hash-chained and detects edits", async () => {
    const db = await load();
    assert.ok(db.audit.length > 5);
    assert.equal(auditChainOk(db), true);
    await mutate(d => { d.audit[2].details = { forged: true }; });
    assert.equal(auditChainOk(await load()), false);
    void sha256;
});
