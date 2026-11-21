/**
 * Research evaluation. Usage:  npm run eval            (synthetic photos)
 *                              SAMPLE_DIR=/path/to/photos npm run eval   (your own .png/.jpg files; real photos give honest numbers)
 * Writes research/results.json (read by the /research page) and research/results.md.
 */
import "../test/env.js";
import fs from "fs";
import path from "path";
import { decodeImage, encodePng, embedBits, voteBits, luma, ssim } from "../lib/wm.js";
import { payloadBits, NB_ECC, NB_RAW } from "../lib/crypto.js";
import { recover, tryVotes } from "../lib/recover.js";
import { makePhoto } from "../test/helpers.js";
import * as A from "./attacks.js";
const CFGS = [
    { id: "dct-single", label: "DCT, single embedding", alg: "dct", redundant: false, ecc: false },
    { id: "dwt-single", label: "DWT, single embedding", alg: "dwt", redundant: false, ecc: false },
    { id: "dwt-red", label: "DWT + redundancy", alg: "dwt", redundant: true, ecc: false },
    { id: "dwt-red-ecc", label: "DWT + redundancy + Reed-Solomon", alg: "dwt", redundant: true, ecc: true },
    { id: "dct-red-ecc", label: "DCT + redundancy + Reed-Solomon", alg: "dct", redundant: true, ecc: true },
];
const PIX = [
    ["none", A.none], ["JPEG q90", A.jpeg(90)], ["JPEG q70", A.jpeg(70)], ["JPEG q50", A.jpeg(50)], ["JPEG q30", A.jpeg(30)],
    ["Gaussian noise σ5", A.noise(5)], ["Gaussian noise σ10", A.noise(10)], ["Salt & pepper 1%", A.saltPepper(0.01)], ["Blur σ1", A.blur(1)], ["Blur σ2", A.blur(2)],
    ["Brightness +20", A.brightness(20)], ["Brightness −35", A.brightness(-35)], ["Contrast ×1.2", A.contrastBy(1.2)], ["Colour shift", A.colorShift],
];
const GEO = [
    ["Crop to 75% area", A.cropFrac(0.75, 0.3, 0.2)], ["Crop to 50% area", A.cropFrac(0.5, 0.7, 0.4)], ["Rotate 90°", A.rotate(90)], ["Rotate 180°", A.rotate(180)], ["Mirror", A.flop],
    ["Resize ×0.6", A.resize(0.6)], ["Rotate 5°", A.rotate(5)], ["JPEG q70 + crop 75%", async (b) => A.cropFrac(0.75, 0.2, 0.3)(await A.jpeg(70)(b))],
];
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sdBits = (b) => Array.from(b, x => (x ? 1 : -1));
async function loadImages() {
    const dir = process.env.SAMPLE_DIR;
    if (dir && fs.existsSync(dir))
        return fs.readdirSync(dir).filter(f => /\.(png|jpe?g)$/i.test(f)).slice(0, 12).map(f => ({ name: f, buf: fs.readFileSync(path.join(dir, f)) }));
    return Promise.all([1, 2, 3, 4, 5, 6].map(async (i) => ({ name: `synthetic-${i}`, buf: await makePhoto(480 + 40 * (i % 3), 360 + 30 * (i % 2), i) })));
}
(async () => {
    var _a, _b, _c, _d, _e;
    const imgs = await loadImages(), t0 = Date.now();
    console.log(`Evaluating ${imgs.length} images: ${imgs.map(i => i.name).join(", ")}`);
    const quality = {};
    const pix = {};
    const geo = {};
    for (const { name, buf } of imgs) {
        const src = await decodeImage(buf);
        for (const c of CFGS) {
            const bits = payloadBits(7, 2, 1700000000, c.ecc), n = bits.length;
            const q = (quality[_a = c.id] || (quality[_a] = { psnr: [], ssim: [], embedMs: [], extractMs: [] }));
            let t = performance.now();
            const e = embedBits(src, bits, c.alg, { single: !c.redundant });
            q.embedMs.push(performance.now() - t);
            q.psnr.push(e.psnr);
            const png = await encodePng(e.img);
            q.ssim.push(ssim(src, await decodeImage(png)));
            for (const [an, atk] of PIX) {
                const out = await decodeImage(await atk(png)), Y = luma(out);
                t = performance.now();
                const v = voteBits(Y, out.w, out.h, c.alg, n, { single: !c.redundant });
                const dec = tryVotes(v.votes);
                q.extractMs.push(performance.now() - t);
                const hard = Uint8Array.from(v.votes, x => (x > 0 ? 1 : 0));
                const ber = (inv) => bits.reduce((s, b, i) => s + ((hard[i] ^ (inv ? 1 : 0)) !== b ? 1 : 0), 0) / n;
                const inv = ber(true) < ber(false), r = sdBits(hard).map((x, i) => (inv ? -x : x) * (bits[i] ? 1 : -1));
                const cell = ((_c = (pix[_b = c.id] || (pix[_b] = {})))[an] || (_c[an] = { rec: [], ber: [], nc: [] }));
                cell.rec.push(dec ? 1 : 0);
                cell.ber.push(Math.min(ber(false), ber(true)));
                cell.nc.push(mean(r));
            }
            // geometric attacks use the real end-to-end pipeline (re-synchronisation), only meaningful for the redundant configs
            if (c.redundant && c.ecc)
                for (const [an, atk] of GEO) {
                    const db = { images: [{ record: { w: src.w, h: src.h } }] };
                    const r = await recover(await atk(png), db);
                    ((_e = (geo[_d = c.id] || (geo[_d] = {})))[an] || (_e[an] = [])).push(r.found && r.found.reg === 7 ? 1 : 0);
                }
        }
        console.log("  done", name);
    }
    const out = {
        generated: new Date().toISOString(), images: imgs.map(i => i.name), note: process.env.SAMPLE_DIR ? "Real photographs." : "Synthetic photo-like images (smooth colour fields, shapes, grain). Re-run with SAMPLE_DIR for real photographs.",
        configs: CFGS.map(c => ({ ...c, bitsEmbedded: c.ecc ? NB_ECC : NB_RAW })),
        quality: Object.fromEntries(Object.entries(quality).map(([k, q]) => [k, { psnr: mean(q.psnr), ssim: mean(q.ssim), embedMs: mean(q.embedMs), extractMs: mean(q.extractMs) }])),
        pixel: Object.fromEntries(Object.entries(pix).map(([k, a]) => [k, Object.fromEntries(Object.entries(a).map(([an, m]) => [an, { recovery: mean(m.rec), ber: mean(m.ber), nc: mean(m.nc) }]))])),
        geometric: Object.fromEntries(Object.entries(geo).map(([k, a]) => [k, Object.fromEntries(Object.entries(a).map(([an, m]) => [an, mean(m)]))])),
    };
    fs.mkdirSync("research", { recursive: true });
    fs.writeFileSync("research/results.json", JSON.stringify(out, null, 1));
    const pc = (x) => (100 * x).toFixed(0) + "%";
    let md = `# SecureMark evaluation\n\n${out.note} Images: ${out.images.length}. Generated ${out.generated}.\n\n## Quality and speed\n\n| Configuration | bits | PSNR dB | SSIM | embed ms | extract ms |\n|---|---|---|---|---|---|\n`;
    for (const c of out.configs) {
        const q = out.quality[c.id];
        md += `| ${c.label} | ${c.bitsEmbedded} | ${q.psnr.toFixed(1)} | ${q.ssim.toFixed(4)} | ${q.embedMs.toFixed(0)} | ${q.extractMs.toFixed(0)} |\n`;
    }
    md += `\n## Pixel-aligned attacks (recovery rate = authenticated payload decoded; BER on embedded bits before error correction; NC = normalised correlation)\n\n| Attack | ${out.configs.map(c => c.label).join(" | ")} |\n|---|${out.configs.map(() => "---").join("|")}|\n`;
    for (const [an] of PIX)
        md += `| ${an} | ${out.configs.map(c => { const m = out.pixel[c.id][an]; return `${pc(m.recovery)} · BER ${(100 * m.ber).toFixed(1)}% · NC ${m.nc.toFixed(2)}`; }).join(" | ")} |\n`;
    md += `\n## Geometric attacks, full pipeline with re-synchronisation (recovery rate)\n\n| Attack | DWT + redundancy + RS | DCT + redundancy + RS |\n|---|---|---|\n`;
    for (const [an] of GEO)
        md += `| ${an} | ${pc(out.geometric["dwt-red-ecc"][an])} | ${pc(out.geometric["dct-red-ecc"][an])} |\n`;
    fs.writeFileSync("research/results.md", md);
    console.log(md, `\nTotal ${((Date.now() - t0) / 1000).toFixed(0)}s`);
})();
