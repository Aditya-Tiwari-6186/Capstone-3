import crypto from "crypto";
export const sha256 = (b) => crypto.createHash("sha256").update(b).digest("hex");
export const rid = (bytes = 8) => crypto.randomBytes(bytes).toString("hex");
/** Error whose message is safe to show to the client. */
export class HttpError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}
/** Canonical JSON (sorted keys, undefined dropped) so signatures/hashes do not depend on key order. */
export function canon(o) {
    if (o === null || typeof o !== "object")
        return JSON.stringify(o);
    if (Array.isArray(o))
        return "[" + o.map(canon).join(",") + "]";
    const r = o;
    return "{" + Object.keys(r).filter(k => r[k] !== undefined).sort().map(k => JSON.stringify(k) + ":" + canon(r[k])).join(",") + "}";
}
export const regIdOf = (n, at) => `SMK-${at.getUTCFullYear()}-${String(n).padStart(6, "0")}`;
/** Hamming distance between two equal-length hex strings. */
export function hamming(a, b) {
    let d = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
        while (x) {
            d += x & 1;
            x >>= 1;
        }
    }
    return d;
}
export const publicUrl = () => (process.env.PUBLIC_URL || "http://localhost:3000").replace(/\/$/, "");
