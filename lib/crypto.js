import crypto from "crypto";
import fs from "fs";
import path from "path";
import { DATA } from "./db.js";
import { canon } from "./util.js";
import { rsEncode, rsDecode } from "./rs.js";
/* ---------- keys (derived lazily so `next build` works without the secret; production refuses to run without it) ---------- */
function secret() {
    const s = process.env.SECUREMARK_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-only-secret");
    if (!s)
        throw new Error("SECUREMARK_SECRET is required in production");
    return s;
}
export const derive = (info) => Buffer.from(crypto.hkdfSync("sha256", secret(), "securemark-v1", info, 32));
let K = null;
function keys() {
    if (K)
        return K;
    const kp = path.join(DATA, "ed25519.pem");
    if (!fs.existsSync(kp)) {
        const pem = crypto.generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" });
        try {
            fs.writeFileSync(kp, pem, { mode: 0o600, flag: "wx" });
        }
        catch (e) {
            if (e.code !== "EEXIST")
                throw e;
        }
    }
    const sk = crypto.createPrivateKey(fs.readFileSync(kp));
    return (K = { aes: derive("payload-aes-256-gcm"), sk, pk: crypto.createPublicKey(sk) });
}
/* ---------- Ed25519 signatures over the canonical registration record ---------- */
export const sign = (o) => crypto.sign(null, Buffer.from(canon(o)), keys().sk).toString("base64");
export const sigOk = (o, s) => { try {
    return crypto.verify(null, Buffer.from(canon(o)), keys().pk, Buffer.from(s, "base64"));
}
catch {
    return false;
} };
export const publicKeyPem = () => keys().pk.export({ type: "spki", format: "pem" });
export const keyFingerprint = () => crypto.createHash("sha256").update(keys().pk.export({ type: "spki", format: "der" })).digest("hex").slice(0, 16);
/* ---------- AES-256-GCM payload: nonce(12) | ciphertext(12) | tag(16) = 40 bytes ---------- */
const AAD = Buffer.from("SMK1");
export const PAYLOAD_BYTES = 40, NSYM = 16;
export const NB_RAW = PAYLOAD_BYTES * 8, NB_ECC = (PAYLOAD_BYTES + NSYM) * 8; // 320 / 448 embedded bits
export function seal(reg, owner, ts) {
    const p = Buffer.alloc(12);
    p.writeUInt32BE(reg, 0);
    p.writeUInt32BE(owner, 4);
    p.writeUInt32BE(ts, 8);
    const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", keys().aes, iv);
    c.setAAD(AAD);
    return Buffer.concat([iv, c.update(p), c.final(), c.getAuthTag()]);
}
export function unseal(b) {
    if (b.length !== PAYLOAD_BYTES)
        return null;
    try {
        const x = Buffer.from(b), d = crypto.createDecipheriv("aes-256-gcm", keys().aes, x.subarray(0, 12));
        d.setAAD(AAD);
        d.setAuthTag(x.subarray(24));
        const p = Buffer.concat([d.update(x.subarray(12, 24)), d.final()]);
        return { reg: p.readUInt32BE(0), owner: p.readUInt32BE(4), ts: p.readUInt32BE(8) };
    }
    catch {
        return null;
    }
}
/* ---------- payload <-> embedded bits (Reed-Solomon around the ciphertext) ---------- */
export const toBits = (b) => Uint8Array.from({ length: b.length * 8 }, (_, i) => (b[i >> 3] >> (7 - (i & 7))) & 1);
export function fromBits(bits) {
    const out = new Uint8Array(bits.length >> 3);
    for (let i = 0; i < out.length * 8; i++)
        if (bits[i])
            out[i >> 3] |= 1 << (7 - (i & 7));
    return out;
}
export function payloadBits(reg, owner, ts, ecc = true) {
    const p = seal(reg, owner, ts);
    return toBits(ecc ? rsEncode(p, NSYM) : p);
}
/** Error-correct, then decrypt + authenticate. Returns null unless the GCM tag is valid. */
export function openBits(bits) {
    const b = fromBits(bits);
    if (b.length === PAYLOAD_BYTES + NSYM) {
        const d = rsDecode(b, NSYM);
        return d ? unseal(d) : null;
    }
    return unseal(b);
}
