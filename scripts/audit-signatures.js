import { loadEnvFile } from "./env.js";

loadEnvFile();
const [{ load }, { keyFingerprint, sigOk }] = await Promise.all([
    import("../lib/db.js"),
    import("../lib/crypto.js"),
]);
const db = await load();
const invalid = db.images.filter(image => !sigOk(image.record, image.sig)).map(image => image.record.regId);
console.log(JSON.stringify({
    signingKeyFingerprint: keyFingerprint(),
    total: db.images.length,
    valid: db.images.length - invalid.length,
    invalid,
}, null, 2));
