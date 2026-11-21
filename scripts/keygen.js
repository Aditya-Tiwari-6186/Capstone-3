import crypto from "node:crypto";

const { privateKey } = crypto.generateKeyPairSync("ed25519");
const pem = privateKey.export({ type: "pkcs8", format: "pem" });
process.stdout.write(`SIGNING_KEY_PEM=${pem.replace(/\r?\n/g, "\\n")}\n`);
