import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import "./env.js";
import { DATA } from "../lib/db.js";

process.env.SECUREMARK_SECRET = "securemark-test-secret";
const pairA = crypto.generateKeyPairSync("ed25519");
const pairB = crypto.generateKeyPairSync("ed25519");
const toEnv = key => key.export({ type: "pkcs8", format: "pem" }).replace(/\r?\n/g, "\\n");
process.env.SIGNING_KEY_PEM = toEnv(pairA.privateKey);
const { derive, keyFingerprint, sign, sigOk, signingPrivateKey } = await import("../lib/crypto.js");

test("signing keys follow the environment and do not cache file changes", () => {
    const record = { regId: "SMK-2026-000001" }, sigA = sign(record), fingerprintA = keyFingerprint();
    assert.equal(sigOk(record, sigA), true);

    process.env.SIGNING_KEY_PEM = toEnv(pairB.privateKey);
    assert.notEqual(keyFingerprint(), fingerprintA);
    assert.equal(sigOk(record, sigA), false);
    assert.equal(sigOk(record, sign(record)), true);

    process.env.NODE_ENV = "development";
    process.env.SIGNING_KEY_PEM = "";
    const keyFile = path.join(DATA, "ed25519.pem");
    fs.writeFileSync(keyFile, pairA.privateKey.export({ type: "pkcs8", format: "pem" }));
    const fileFingerprintA = keyFingerprint();
    fs.writeFileSync(keyFile, pairB.privateKey.export({ type: "pkcs8", format: "pem" }));
    assert.notEqual(keyFingerprint(), fileFingerprintA);

    process.env.NODE_ENV = "production";
    assert.throws(() => signingPrivateKey(), /SIGNING_KEY_PEM is required in production/);
    process.env.SECUREMARK_SECRET = "";
    assert.throws(() => derive("payload-aes-256-gcm"), /SECUREMARK_SECRET is required in production/);
});
