/**
 * Reed-Solomon over GF(256) (primitive polynomial 0x11d, generator roots alpha^1 .. alpha^nsym).
 * A codeword is [data bytes | nsym parity bytes]; up to nsym/2 corrupted bytes are corrected.
 * Used to protect the 40-byte encrypted watermark payload (nsym = 16 -> corrects 8 wrong bytes).
 */
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(() => {
    let x = 1;
    for (let i = 0; i < 255; i++) {
        EXP[i] = x;
        LOG[x] = i;
        x <<= 1;
        if (x & 0x100)
            x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++)
        EXP[i] = EXP[i - 255];
})();
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
const div = (a, b) => (a === 0 ? 0 : EXP[LOG[a] + 255 - LOG[b]]); // b must be non-zero
function generator(nsym) {
    let g = [1]; // high-degree coefficient first
    for (let i = 1; i <= nsym; i++) {
        const r = new Array(g.length + 1).fill(0);
        for (let j = 0; j < g.length; j++) {
            r[j] ^= g[j];
            r[j + 1] ^= mul(g[j], EXP[i]);
        }
        g = r;
    }
    return g;
}
export function rsEncode(data, nsym) {
    const g = generator(nsym), out = new Uint8Array(data.length + nsym);
    out.set(data);
    for (let i = 0; i < data.length; i++) {
        const c = out[i];
        if (c)
            for (let j = 1; j < g.length; j++)
                out[i + j] ^= mul(g[j], c);
    }
    out.set(data);
    return out;
}
const syndromes = (r, nsym) => {
    const S = new Array(nsym).fill(0);
    for (let j = 0; j < nsym; j++) {
        const a = EXP[j + 1];
        let y = 0;
        for (let i = 0; i < r.length; i++)
            y = mul(y, a) ^ r[i];
        S[j] = y;
    }
    return S;
};
/** Returns the corrected data bytes, or null when the word has more errors than can be corrected. */
export function rsDecode(msg, nsym) {
    const n = msg.length, r = Uint8Array.from(msg), S = syndromes(r, nsym);
    if (S.every(s => s === 0))
        return r.slice(0, n - nsym);
    // Berlekamp-Massey: error locator polynomial C (low-degree first)
    let C = [1], B = [1], L = 0, m = 1, b = 1;
    for (let i = 0; i < nsym; i++) {
        let d = S[i];
        for (let j = 1; j <= L; j++)
            d ^= mul(C[j] ?? 0, S[i - j]);
        if (d === 0) {
            m++;
            continue;
        }
        const T = C.slice(), coef = div(d, b);
        while (C.length < B.length + m)
            C.push(0);
        for (let j = 0; j < B.length; j++)
            C[j + m] ^= mul(coef, B[j]);
        if (2 * L <= i) {
            L = i + 1 - L;
            B = T;
            b = d;
            m = 1;
        }
        else
            m++;
    }
    if (L === 0 || L > nsym >> 1)
        return null;
    while (C.length > L + 1) {
        if (C[C.length - 1] !== 0)
            return null;
        C.pop();
    }
    // Chien search: position i has locator X = alpha^(n-1-i); it is in error when C(X^-1) = 0
    const pos = [], xinvs = [];
    for (let i = 0; i < n; i++) {
        const xinv = EXP[(255 - ((n - 1 - i) % 255)) % 255];
        let y = 0;
        for (let j = C.length - 1; j >= 0; j--)
            y = mul(y, xinv) ^ C[j];
        if (y === 0) {
            pos.push(i);
            xinvs.push(xinv);
        }
    }
    if (pos.length !== L)
        return null;
    // Forney: error evaluator Omega = S(x) * C(x) mod x^nsym; magnitude = Omega(X^-1) / C'(X^-1) (first root = alpha^1)
    const omega = new Array(nsym).fill(0);
    for (let k = 0; k < nsym; k++)
        for (let j = 0; j <= Math.min(k, L); j++)
            omega[k] ^= mul(C[j], S[k - j]);
    const dC = [];
    for (let j = 1; j < C.length; j += 2)
        dC[j - 1] = C[j];
    for (let t = 0; t < pos.length; t++) {
        const xi = xinvs[t];
        let num = 0, den = 0;
        for (let k = omega.length - 1; k >= 0; k--)
            num = mul(num, xi) ^ omega[k];
        for (let k = dC.length - 1; k >= 0; k--)
            den = mul(den, xi) ^ (dC[k] ?? 0);
        if (den === 0)
            return null;
        r[pos[t]] ^= div(num, den);
    }
    return syndromes(r, nsym).every(s => s === 0) ? r.slice(0, n - nsym) : null;
}
