import sharp from "sharp";
/** Image-processing attacks used by the evaluation, the tests and the smoke test. Each takes and returns an encoded image. */
const raw = async (b) => { const { data, info } = await sharp(b).removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height }; };
const png = (data, w, h) => sharp(data, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
export const jpeg = (q) => b => sharp(b).jpeg({ quality: q }).toBuffer();
export const noise = (sigma) => async (b) => { const { data, w, h } = await raw(b); for (let i = 0; i < data.length; i++)
    data[i] = Math.max(0, Math.min(255, Math.round(data[i] + gauss() * sigma))); return png(data, w, h); };
export const saltPepper = (p) => async (b) => { const { data, w, h } = await raw(b); for (let i = 0; i < w * h; i++)
    if (Math.random() < p) {
        const v = Math.random() < 0.5 ? 0 : 255;
        data[i * 3] = data[i * 3 + 1] = data[i * 3 + 2] = v;
    } return png(data, w, h); };
export const blur = (sigma) => b => sharp(b).blur(sigma).png().toBuffer();
export const resize = (f) => async (b) => { const m = await sharp(b).metadata(); return sharp(b).resize(Math.round(m.width * f), Math.round(m.height * f)).png().toBuffer(); };
export const cropFrac = (f, fx = 0.3, fy = 0.2) => async (b) => {
    const m = await sharp(b).metadata(), s = Math.sqrt(f), w = Math.round(m.width * s), h = Math.round(m.height * s);
    return sharp(b).extract({ left: Math.round((m.width - w) * fx), top: Math.round((m.height - h) * fy), width: w, height: h }).png().toBuffer();
};
export const rotate = (deg) => b => sharp(b).rotate(deg, { background: "#808080" }).png().toBuffer();
export const flop = b => sharp(b).flop().png().toBuffer();
export const brightness = (d) => b => sharp(b).linear(1, d).png().toBuffer();
export const contrastBy = (a) => b => sharp(b).linear(a, 128 * (1 - a)).png().toBuffer();
export const colorShift = b => sharp(b).modulate({ saturation: 1.35, hue: 20 }).png().toBuffer();
/** Paste a patch taken from elsewhere in the same image over a region (object insertion / copy-move). */
export const paste = (px, py, size, fromX = 0.1, fromY = 0.1) => async (b) => {
    const { data, w, h } = await raw(b), sx = Math.floor(w * fromX), sy = Math.floor(h * fromY);
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
            for (let c = 0; c < 3; c++)
                data[((py + y) * w + px + x) * 3 + c] = data[((sy + y) * w + sx + x) * 3 + c];
    return png(data, w, h);
};
export const none = async (b) => b;
