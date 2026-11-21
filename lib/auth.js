import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { derive } from "./crypto.js";
import { audit, load, mutate } from "./db.js";
import { HttpError, rid, sha256 } from "./util.js";
const jwtKey = () => derive("jwt-hs256");
const COOKIE = "t";
export const pub = (u) => ({ id: u.id, name: u.name, role: u.role, verified: u.verified });
export const mustVerifyEmail = () => !!process.env.SMTP_URL || process.env.REQUIRE_EMAIL_VERIFICATION === "1";
export { publicUrl } from "./util.js";
/** Password policy: 8-128 chars with at least one letter and one digit. */
export function checkPassword(p) {
    if (typeof p !== "string" || p.length < 8 || p.length > 128)
        throw new HttpError("Password must be 8 to 128 characters.");
    if (!/[A-Za-z]/.test(p) || !/\d/.test(p))
        throw new HttpError("Password needs at least one letter and one digit.");
    return p;
}
export const hashPassword = (p) => bcrypt.hash(p, 11);
const DUMMY = bcrypt.hashSync("dummy-password-1", 11); // compared against when the e-mail is unknown, so timing does not reveal accounts
export async function passwordOk(u, p) { const ok = await bcrypt.compare(p, u?.hash || DUMMY); return !!u && ok; }
/* ---------- sessions: HS256 JWT in an httpOnly cookie; `tv` lets a password change revoke old sessions ---------- */
export async function startSession(u) {
    const t = await new SignJWT({ id: u.id, tv: u.tv }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").sign(jwtKey());
    cookies().set(COOKIE, t, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 86400, secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "0" });
}
export const endSession = () => cookies().set(COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
export async function currentUser() {
    let payload;
    try {
        ({ payload } = await jwtVerify(cookies().get(COOKIE)?.value || "", jwtKey(), { algorithms: ["HS256"] }));
    }
    catch {
        return null;
    }
    const u = (await load()).users.find(x => x.id === payload.id);
    return u && u.active && u.tv === payload.tv ? u : null;
}
export async function requireUser() {
    const u = await currentUser();
    if (!u)
        throw new HttpError("Please log in.", 401);
    return u;
}
export async function requireVerified() {
    const u = await requireUser();
    if (!u.verified)
        throw new HttpError("Please verify your e-mail address first (check your inbox).", 403);
    return u;
}
export async function requireAdmin() {
    const u = await requireUser();
    if (u.role !== "ADMIN")
        throw new HttpError("Administrators only.", 403);
    return u;
}
/* ---------- one-time tokens (e-mail verification / password reset); only a hash is stored ---------- */
export function makeToken(db, userId, kind, ttlMs) {
    const raw = rid(24);
    db.tokens = db.tokens.filter(t => t.exp > Date.now() && !(t.userId === userId && t.kind === kind));
    db.tokens.push({ h: sha256(raw), userId, kind, exp: Date.now() + ttlMs });
    return raw;
}
export function takeToken(db, raw, kind) {
    if (typeof raw !== "string")
        return null;
    const h = sha256(raw), i = db.tokens.findIndex(t => t.h === h && t.kind === kind && t.exp > Date.now());
    if (i < 0)
        return null;
    const [t] = db.tokens.splice(i, 1);
    return t.userId;
}
/* ---------- request helpers ---------- */
export const ipOf = (req) => (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
const hits = new Map();
/** Sliding-window rate limit (in memory: per server process). Throws HTTP 429. */
export function limit(key, max, windowMs = 60000) {
    const now = Date.now(), a = (hits.get(key) || []).filter(x => now - x < windowMs);
    if (a.length >= max) {
        hits.set(key, a);
        throw new HttpError("Too many requests. Please wait a minute and try again.", 429);
    }
    a.push(now);
    hits.set(key, a);
    if (hits.size > 5000)
        for (const [k, v] of hits)
            if (!v.length || now - v[v.length - 1] > windowMs)
                hits.delete(k);
}
export const route = (fn) => async (req, ctx) => {
    try {
        return await fn(req, ctx);
    }
    catch (e) {
        if (e instanceof HttpError)
            return NextResponse.json({ error: e.message }, { status: e.status });
        console.error("[securemark]", e);
        return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
};
export async function uploaded(req, max = 15 * 1024 * 1024) {
    const len = Number(req.headers.get("content-length") || 0);
    if (len > max + 200000)
        throw new HttpError("File too large (15 MB maximum).", 413);
    let form;
    try {
        form = await req.formData();
    }
    catch {
        throw new HttpError("Send the image as multipart form data.");
    }
    const f = form.get("file");
    if (!(f instanceof File) || !f.size)
        throw new HttpError("No file received.");
    if (f.size > max)
        throw new HttpError("File too large (15 MB maximum).", 413);
    return { buf: Buffer.from(await f.arrayBuffer()), name: f.name || "image", form };
}
export { audit, mutate };
