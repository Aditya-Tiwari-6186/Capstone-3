import crypto from "node:crypto";
import { loadEnvFile } from "./env.js";

loadEnvFile();
const [{ audit, load, mutate }, { keyFingerprint, keyFingerprintForPublicKey, privateKeyFromPem, publicKeyFromPem, sigOk, sigOkWithPublicKey, sign }] = await Promise.all([
    import("../lib/db.js"),
    import("../lib/crypto.js"),
]);
const oldPublicPem = process.env.OLD_PUBLIC_KEY_PEM;
const oldPrivatePem = process.env.OLD_PRIVATE_KEY_PEM;
if (!oldPublicPem && !oldPrivatePem)
    throw new Error("Set OLD_PUBLIC_KEY_PEM or OLD_PRIVATE_KEY_PEM in .env.");
const oldPublicKey = oldPublicPem ? publicKeyFromPem(oldPublicPem) : crypto.createPublicKey(privateKeyFromPem(oldPrivatePem));
const oldFingerprint = keyFingerprintForPublicKey(oldPublicKey), currentFingerprint = keyFingerprint();
const apply = process.argv.includes("--apply");
const classify = images => {
    const resign = [], unverified = [];
    for (const image of images) {
        if (sigOk(image.record, image.sig))
            continue;
        if (sigOkWithPublicKey(image.record, image.sig, oldPublicKey))
            resign.push(image.record.regId);
        else
            unverified.push(image.record.regId);
    }
    return { resign, unverified };
};

if (!apply) {
    const result = classify((await load()).images);
    console.log(JSON.stringify({ mode: "dry-run", oldFingerprint, currentFingerprint, wouldResign: result.resign, unverified: result.unverified }, null, 2));
}
else {
    const result = await mutate(db => {
        const classified = classify(db.images), changed = [];
        for (const image of db.images) {
            if (!classified.resign.includes(image.record.regId))
                continue;
            image.record.keyFingerprint = currentFingerprint;
            image.sig = sign(image.record);
            audit(db, "record.resign", null, { regId: image.record.regId, oldFingerprint, newFingerprint: currentFingerprint });
            changed.push(image.record.regId);
        }
        return { changed, unverified: classified.unverified };
    });
    console.log(JSON.stringify({ mode: "applied", oldFingerprint, currentFingerprint, resigned: result.changed, unverified: result.unverified }, null, 2));
}
