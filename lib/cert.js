import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { keyFingerprint } from "./crypto.js";
import { publicUrl } from "./util.js";
/** One-page A4 ownership certificate with a QR code that opens the public verification page. */
export async function certificatePdf(img, owner) {
    const r = img.record, url = `${publicUrl()}/verify/${r.regId}`;
    const pdf = await PDFDocument.create(), page = pdf.addPage([595, 842]);
    const F = await pdf.embedFont(StandardFonts.Helvetica), B = await pdf.embedFont(StandardFonts.HelveticaBold), M = await pdf.embedFont(StandardFonts.Courier);
    const ink = rgb(0.1, 0.13, 0.2), dim = rgb(0.4, 0.44, 0.5), brand = rgb(0.1, 0.35, 0.6);
    page.drawRectangle({ x: 24, y: 24, width: 547, height: 794, borderColor: brand, borderWidth: 2 });
    page.drawText("SecureMark", { x: 56, y: 770, size: 26, font: B, color: brand });
    page.drawText("Certificate of image registration", { x: 56, y: 744, size: 14, font: F, color: dim });
    const rows = [
        ["Certificate no.", "CERT-" + r.regId.replace("SMK-", "")], ["Registration ID", r.regId], ["Registered owner", owner.name], ["Image name", img.name],
        ["Registered at (UTC)", r.at], ["Watermark method", r.alg === "dwt" ? "Haar DWT (LL band), QIM, AES-256-GCM payload, Reed-Solomon" : "8x8 DCT (mid band), QIM, AES-256-GCM payload, Reed-Solomon"],
        ["Image size", `${r.w} x ${r.h} px`], ["Quality", `PSNR ${img.psnr} dB, SSIM ${img.ssim}`],
    ];
    let y = 690;
    for (const [k, v] of rows) {
        page.drawText(k.toUpperCase(), { x: 56, y, size: 8, font: B, color: dim });
        page.drawText(v.slice(0, 80), { x: 56, y: y - 14, size: 11, font: F, color: ink });
        y -= 38;
    }
    const hash = (label, h) => { page.drawText(label, { x: 56, y, size: 8, font: B, color: dim }); page.drawText(h.slice(0, 32), { x: 56, y: y - 13, size: 9, font: M, color: ink }); page.drawText(h.slice(32), { x: 56, y: y - 25, size: 9, font: M, color: ink }); y -= 46; };
    hash("SHA-256 OF PROTECTED IMAGE (the file that was issued)", r.wm);
    hash("SHA-256 OF ORIGINAL UPLOAD", r.orig);
    const qr = await pdf.embedPng(await QRCode.toBuffer(url, { margin: 1, width: 300, errorCorrectionLevel: "M" }));
    page.drawImage(qr, { x: 56, y: 150, width: 130, height: 130 });
    page.drawText("Scan to verify", { x: 56, y: 134, size: 9, font: B, color: ink });
    page.drawText(url, { x: 200, y: 262, size: 9, font: M, color: brand });
    page.drawText("Open the link and upload any image to check it against this", { x: 200, y: 240, size: 9, font: F, color: ink });
    page.drawText("registration. The QR code alone does not prove an image carries", { x: 200, y: 227, size: 9, font: F, color: ink });
    page.drawText("the watermark; only the upload check does.", { x: 200, y: 214, size: 9, font: F, color: ink });
    page.drawText(`Record signature (Ed25519, key ${keyFingerprint()}):`, { x: 200, y: 188, size: 8, font: B, color: dim });
    page.drawText(img.sig.slice(0, 44), { x: 200, y: 176, size: 8, font: M, color: ink });
    page.drawText(img.sig.slice(44), { x: 200, y: 166, size: 8, font: M, color: ink });
    page.drawText("This certificate records a registration on the SecureMark platform. It is evidence of when a file was registered by this account;", { x: 56, y: 90, size: 7.5, font: F, color: dim });
    page.drawText("it is not a legal copyright certificate and does not by itself establish authorship or ownership of the work.", { x: 56, y: 79, size: 7.5, font: F, color: dim });
    pdf.setTitle(`SecureMark certificate ${r.regId}`);
    pdf.setProducer("SecureMark");
    return pdf.save();
}
