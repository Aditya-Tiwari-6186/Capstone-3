import fs from "fs";
import path from "path";
import { DATA } from "./db.js";
/**
 * Sends e-mail through SMTP_URL when configured. Without it (development) the message is appended to data/outbox.log
 * so you can copy the link out of the file; the API also returns the link outside production (see /api/auth).
 */
export async function sendMail(to, subject, text) {
    fs.appendFileSync(path.join(DATA, "outbox.log"), `--- ${new Date().toISOString()} to ${to}\nSubject: ${subject}\n${text}\n\n`, { mode: 0o600 });
    if (!process.env.SMTP_URL)
        return;
    const nodemailer = await import("nodemailer");
    await nodemailer.createTransport(process.env.SMTP_URL).sendMail({ from: process.env.MAIL_FROM || "SecureMark <no-reply@localhost>", to, subject, text });
}
