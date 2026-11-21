import { NextResponse } from "next/server";
import { audit, checkPassword, currentUser, endSession, hashPassword, ipOf, limit, makeToken, mustVerifyEmail, mutate, passwordOk, pub, publicUrl, requireUser, route, startSession, takeToken } from "@/lib/auth";
import { load } from "@/lib/db";
import { HttpError, rid } from "@/lib/util";
import { sendMail } from "@/lib/mail";
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const dev = () => process.env.NODE_ENV !== "production" && !process.env.SMTP_URL; // expose links only while developing without SMTP
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const GET = route(async () => {
    const u = await currentUser();
    if (!u)
        await load();
    return NextResponse.json(u ? pub(u) : null);
});
export const POST = route(async (req) => {
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object")
        throw new HttpError("Invalid request.");
    const ip = ipOf(req), mode = b.mode;
    if (mode === "logout") {
        endSession();
        return NextResponse.json({ ok: true });
    }
    if (mode === "register") {
        limit("reg:" + ip, 10, 3600000);
        const name = str(b.name, 80), email = str(b.email, 320).toLowerCase(), password = checkPassword(b.password);
        if (!name)
            throw new HttpError("Please enter your name.");
        if (!EMAIL.test(email))
            throw new HttpError("Please enter a valid e-mail address.");
        const hash = await hashPassword(password);
        let verifyToken = null;
        const u = await mutate(db => {
            if (db.users.some(x => x.email === email))
                throw new HttpError("An account with this e-mail already exists.", 409);
            const first = db.users.length === 0; // the first account becomes the administrator
            const user = { id: rid(8), n: ++db.seq.user, name, email, hash, role: first ? "ADMIN" : "USER", active: true, verified: first || !mustVerifyEmail(), tv: 0, at: new Date().toISOString() };
            db.users.push(user);
            if (!user.verified)
                verifyToken = makeToken(db, user.id, "verify", 48 * 3600000);
            audit(db, "user.register", user.id, { role: user.role });
            return user;
        });
        let devLink;
        if (verifyToken) {
            const link = `${publicUrl()}/?verify=${verifyToken}`;
            await sendMail(email, "Confirm your SecureMark account", `Hi ${name},\n\nConfirm your e-mail address to start protecting images:\n${link}\n\nThe link is valid for 48 hours.`);
            if (dev())
                devLink = link;
            return NextResponse.json({ needsVerification: true, devLink });
        }
        await startSession(u);
        return NextResponse.json(pub(u));
    }
    if (mode === "login") {
        const email = str(b.email, 320).toLowerCase();
        limit("login-ip:" + ip, 20);
        limit("login:" + email, 8, 15 * 60000);
        const u = (await load()).users.find(x => x.email === email);
        const ok = await passwordOk(u, typeof b.password === "string" ? b.password.slice(0, 200) : "");
        await mutate(db => audit(db, ok ? "login" : "login.failed", ok ? u.id : null, ok ? {} : { email: email.slice(0, 80) }));
        if (!ok || !u)
            throw new HttpError("Wrong e-mail or password.", 401);
        if (!u.active)
            throw new HttpError("This account has been suspended.", 403);
        if (!u.verified)
            throw new HttpError("Please confirm your e-mail first. Use “Resend” if you did not get the message.", 403);
        await startSession(u);
        return NextResponse.json(pub(u));
    }
    if (mode === "resend" || mode === "forgot") {
        limit("mail:" + ip, 5, 3600000);
        const email = str(b.email, 320).toLowerCase();
        let link, to = "";
        await mutate(db => {
            const u = db.users.find(x => x.email === email && x.active);
            if (!u || (mode === "resend" && u.verified))
                return;
            const kind = mode === "resend" ? "verify" : "reset", t = makeToken(db, u.id, kind, kind === "verify" ? 48 * 3600000 : 3600000);
            link = `${publicUrl()}/?${kind}=${t}`;
            to = u.email;
            audit(db, "mail." + kind, u.id);
        });
        if (link)
            await sendMail(to, mode === "resend" ? "Confirm your SecureMark account" : "Reset your SecureMark password", mode === "resend" ? `Confirm your e-mail:\n${link}` : `Reset your password (valid for 1 hour):\n${link}\n\nIf you did not ask for this, ignore this message.`);
        // same answer whether or not the account exists, so the form cannot be used to discover accounts
        return NextResponse.json({ ok: true, devLink: dev() ? link : undefined });
    }
    if (mode === "verify") {
        const done = await mutate(db => { const id = takeToken(db, b.token, "verify"), u = db.users.find(x => x.id === id); if (!u)
            return false; u.verified = true; audit(db, "user.verified", u.id); return true; });
        if (!done)
            throw new HttpError("This confirmation link is invalid or has expired.");
        return NextResponse.json({ ok: true });
    }
    if (mode === "reset") {
        const password = checkPassword(b.password), hash = await hashPassword(password);
        const done = await mutate(db => { const id = takeToken(db, b.token, "reset"), u = db.users.find(x => x.id === id); if (!u)
            return false; u.hash = hash; u.tv++; u.verified = true; audit(db, "user.password.reset", u.id); return true; });
        if (!done)
            throw new HttpError("This reset link is invalid or has expired.");
        return NextResponse.json({ ok: true });
    }
    if (mode === "change") {
        const me = await requireUser();
        limit("chg:" + me.id, 10, 15 * 60000);
        if (!(await passwordOk(me, String(b.current || ""))))
            throw new HttpError("Current password is wrong.", 401);
        const hash = await hashPassword(checkPassword(b.password));
        const u = await mutate(db => { const x = db.users.find(y => y.id === me.id); x.hash = hash; x.tv++; audit(db, "user.password.change", x.id); return x; });
        await startSession(u); // keep this browser signed in; every other session is revoked
        return NextResponse.json({ ok: true });
    }
    throw new HttpError("Unknown request.");
});
