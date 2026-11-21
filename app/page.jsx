"use client";
import { useEffect, useState } from "react";
import { api, post, upload, when } from "@/lib/client";
import { STATUS_LABEL } from "@/lib/labels";
import Drop from "@/components/Drop";
import Result from "@/components/Result";
function Verify({ signedIn, onOpenProtect }) {
    const [r, setR] = useState(), [e, setE] = useState(""), [b, setB] = useState(false);
    return <section className="workspace">
    <div className="hero"><div className="hero-copy"><span className="eyebrow"><span className="live-dot"/> PUBLIC VERIFICATION</span>
      <h2>Know what’s <span className="accent">in your image.</span></h2>
      <p>Verify a SecureMark watermark and check for changes. No account is needed to run a check.</p>
      <div className="hero-points"><span><i>01</i> Upload an image</span><span><i>02</i> Verify its signature</span><span><i>03</i> Review the evidence</span></div>
    </div><div className="hero-art" aria-hidden="true"><div className="scan-frame"><div className="scan-corner top-left"/><div className="scan-corner top-right"/><div className="scan-corner bottom-left"/><div className="scan-corner bottom-right"/><div className="scan-symbol">S<span>✓</span></div><div className="scan-line"/></div><div className="art-label"><span className="live-dot"/> SECUREMARK / VERIFICATION</div></div></div>
    <div className="section-heading"><div><span className="eyebrow">START HERE</span><h2>Check an image</h2></div><span className="public-tag">FREE · NO SIGN-IN</span></div>
    <p className="section-intro">Upload a protected image to confirm its authenticity, registration, and whether it has been modified.</p>
    <Drop label="Choose an image to check" busy={b} onFile={f => { setB(true); setE(""); setR(null); upload("/api/verify", f).then(setR).catch(x => setE(x.message)).finally(() => setB(false)); }}/>
    {b && <p className="loading-line"><span className="spinner"/> Checking image and signature…</p>}{e && <p className="e alert-box" role="alert">{e}</p>}{r && <Result r={r}/>}
    <div className="access-note"><span className="access-icon">↗</span><span><b>{signedIn ? "Want to protect another image?" : "Need to protect your own work?"}</b><small>{signedIn ? "Register a new image and manage your protected collection." : "Sign in to register images, download certificates, and manage your collection."}</small></span><button className="button-outline" onClick={onOpenProtect}>{signedIn ? "Protect image" : "Sign in"} <span aria-hidden="true">→</span></button></div>
    </section>;
}
function Auth({ done, token }) {
    const [mode, setMode] = useState(token?.kind === "reset" ? "login" : "login");
    const [f, setF] = useState({ name: "", email: "", password: "" }), [e, setE] = useState(""), [msg, setMsg] = useState(""), [link, setLink] = useState("");
    const [verified, setVerified] = useState(token?.kind === "verify" ? "Confirming your e-mail…" : "");
    const s = (k) => (ev) => setF({ ...f, [k]: ev.target.value });
    useEffect(() => { if (token?.kind === "verify")
        post("/api/auth", { mode: "verify", token: token.value }).then(() => setVerified("E-mail confirmed. You can log in now.")).catch(x => setVerified(x.message)); }, [token]);
    const run = (p) => { setE(""); setMsg(""); p.catch(x => setE(x.message)); };
    if (token?.kind === "reset" && !msg.startsWith("Password"))
        return <div className="auth-layout"><div className="auth-aside"><span className="eyebrow">ACCOUNT RECOVERY</span><h2>A fresh start, securely.</h2><p>Choose a new password to secure your SecureMark account.</p></div><div className="auth-form"><h2>Choose a new password</h2><label>New password<input type="password" autoComplete="new-password" value={f.password} onChange={s("password")}/></label>
      {e && <p className="e alert-box" role="alert">{e}</p>}<button onClick={() => run(post("/api/auth", { mode: "reset", token: token.value, password: f.password }).then(() => { setMsg("Password changed. Please log in."); history.replaceState(null, "", "/"); }))}>Set password</button></div></div>;
    return <div className="auth-layout"><div className="auth-aside"><span className="eyebrow">YOUR CREATOR WORKSPACE</span><h2>{mode === "register" ? <>Protect what <span className="accent">you create.</span></> : mode === "forgot" ? <>Get back to <span className="accent">your work.</span></> : <>Good to have <span className="accent">you back.</span></>}</h2><p>One secure workspace for image ownership records, watermark checks, and certificates.</p><div className="auth-benefits"><span><b>01</b> Invisible image protection</span><span><b>02</b> Verifiable ownership records</span><span><b>03</b> Private collection and history</span></div><div className="auth-public-link">Just checking an image? <button className="text-button" onClick={() => document.querySelector('[data-tab="verify"]')?.click()}>Use public verification →</button></div></div><div className="auth-form"><span className="eyebrow">{mode === "register" ? "GET STARTED" : mode === "forgot" ? "ACCOUNT RECOVERY" : "MEMBER SIGN-IN"}</span><h2>{mode === "register" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Sign in"}</h2>
    {verified && <p className="ok alert-box" role="status">{verified}</p>}{msg && <p className="ok alert-box" role="status">{msg}</p>}
    {mode === "register" && <label>Full name<input autoComplete="name" value={f.name} onChange={s("name")}/></label>}
    <label>Email<input type="email" autoComplete="email" value={f.email} onChange={s("email")}/></label>
    {mode !== "forgot" && <label>Password{mode === "register" && <span className="dim"> (8+ characters, with a letter and a digit)</span>}<input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} value={f.password} onChange={s("password")}/></label>}
    {e && <p className="e alert-box" role="alert">{e}</p>}
    {link && <p className="dim">Development mode (no SMTP configured): <a href={link}>open the link</a></p>}
    <button className="button-primary auth-submit" onClick={() => run(mode === "forgot"
            ? post("/api/auth", { mode: "forgot", email: f.email }).then(r => { setMsg("If that address has an account, a reset link is on its way."); setLink(r.devLink || ""); })
            : post("/api/auth", { mode, ...f }).then(r => { if (r.needsVerification) {
                setMsg("Check your inbox to confirm your e-mail, then log in.");
                setLink(r.devLink || "");
                setMode("login");
            }
            else
                done(r); }))}>
      {mode === "register" ? "Create account" : mode === "forgot" ? "Send reset link" : "Log in"}</button>{" "}
    <div className="auth-actions"><button className="text-button" onClick={() => { setMode(mode === "register" ? "login" : "register"); setE(""); }}>{mode === "register" ? "I have an account" : "Create an account"}</button>
    {mode === "login" && <><button className="text-button" onClick={() => setMode("forgot")}>Forgot password?</button>
      <button className="text-button" onClick={() => run(post("/api/auth", { mode: "resend", email: f.email }).then(r => { setMsg("If the account needs confirmation, a new link was sent."); setLink(r.devLink || ""); }))}>Resend confirmation</button></>}</div>
  </div></div>;
}
function Register() {
    const [r, setR] = useState(), [e, setE] = useState(""), [b, setB] = useState(false), [alg, setAlg] = useState("dwt");
    return <section className="workspace"><div className="page-intro"><span className="eyebrow">IMAGE OWNERSHIP</span><h2>Protect your work.</h2><p>Your image receives an invisible, encrypted watermark. The original upload is not stored.</p></div>
    <div className="panel"><div className="section-heading"><div><span className="eyebrow">NEW REGISTRATION</span><h2>Choose your protection method</h2></div><span className="step-count">DWT + DCT AVAILABLE</span></div>
    <label>Watermark algorithm<select value={alg} onChange={ev => setAlg(ev.target.value)}>
      <option value="dwt">DWT (recommended): survives JPEG, noise, blur, cropping, rotation by 90°</option>
      <option value="dct">DCT: less visible (higher PSNR), but weaker against blur and strong compression</option></select></label>
    <Drop label="Choose an original image (JPEG, PNG, WebP or TIFF, at least 240×240)" busy={b} onFile={f => { setB(true); setE(""); setR(null); upload("/api/images", f, { alg }).then(setR).catch(x => setE(x.message)).finally(() => setB(false)); }}/>
    {b && <p className="loading-line"><span className="spinner"/> Applying encrypted watermark…</p>}{e && <p className="e alert-box" role="alert">{e}</p>}
    {r && <div className="card"><b>{r.regId}</b> registered with {r.alg.toUpperCase()}. Quality: PSNR {r.psnr} dB, SSIM {r.ssim}.<br />
      <a href={`/api/images/${r.id}`}>Download protected image</a> · <a href={`/api/images/${r.id}/certificate`}>Download certificate (PDF)</a>
      {r.similar?.length > 0 && <p className="e">Heads up: this image looks similar to already registered ones: {r.similar.map((s) => s.regId).join(", ")}. Visual similarity is not proof of anything, but another person may have registered a related image.</p>}      </div>}</div><div className="trust-note"><b>Private by design</b><span>SecureMark stores a protected copy and verification data—not the original image.</span></div></section>;
}
function Mine() {
    const [l, setL] = useState();
    useEffect(() => { api("/api/images").then(setL); }, []);
    if (!l)
        return <p>Loading…</p>;
    if (!l.length)
        return <p>No registered images yet. Use “Protect image” to add your first.</p>;
    return <section className="workspace"><div className="page-intro"><span className="eyebrow">YOUR LIBRARY</span><h2>Your protected images.</h2><p>Manage your registrations, certificates, and public verification pages.</p></div>{l.map(i => <div className="card image-card" key={i.id}><b>{i.regId}</b> · {i.name}<br />
    <span className="dim">{when(i.at)} · {i.alg.toUpperCase()} · {i.w}×{i.h} · PSNR {i.psnr} dB · SSIM {i.ssim}</span><br />
    <a href={`/api/images/${i.id}`}>Download</a> · <a href={`/api/images/${i.id}/certificate`}>Certificate (PDF)</a> · <a href={`/verify/${i.regId}`}>Public page</a>
    <details><summary>Details</summary><dl><dt>Protected SHA-256</dt><dd className="mono">{i.sha256}</dd><dt>Original SHA-256</dt><dd className="mono">{i.originalSha256}</dd>
      <dt>Camera</dt><dd>{[i.exif?.make, i.exif?.model].filter(Boolean).join(" ") || "—"}</dd><dt>Captured</dt><dd>{i.exif?.datetimeOriginal || i.exif?.datetime || "—"}</dd>
      <dt>Original format</dt><dd>{i.exif?.format || "—"}</dd><dt>GPS in original</dt><dd>{i.exif?.gps ? "yes" : "no"}</dd></dl></details></div>)}</section>;
}
function History() {
    const [l, setL] = useState();
    useEffect(() => { api("/api/history").then(setL); }, []);
    if (!l)
        return <p>Loading…</p>;
    if (!l.length)
        return <p>Nothing here yet. Checks you run while logged in appear in this list.</p>;
    return <section className="workspace"><div className="page-intro"><span className="eyebrow">ACTIVITY</span><h2>Verification history.</h2><p>Review image checks you’ve run while signed in.</p></div><div className="scroll"><table><thead><tr><th>When</th><th>Result</th><th>Registration</th><th>Changed</th></tr></thead>
    <tbody>{l.map(v => <tr key={v.id}><td>{when(v.at)}</td><td>{STATUS_LABEL[v.status]}</td><td>{v.regId || "—"}</td><td>{v.pct != null ? v.pct + "%" : "—"}</td></tr>)}</tbody></table></div></section>;
}
function Account() {
    const [f, setF] = useState({ current: "", password: "" }), [m, setM] = useState(""), [e, setE] = useState("");
    return <section className="workspace"><div className="page-intro"><span className="eyebrow">SECURITY</span><h2>Account settings.</h2><p>Update your password and keep your workspace secure.</p></div><div className="panel account-panel"><h2>Change password</h2><label>Current password<input type="password" autoComplete="current-password" value={f.current} onChange={x => setF({ ...f, current: x.target.value })}/></label>
    <label>New password<input type="password" autoComplete="new-password" value={f.password} onChange={x => setF({ ...f, password: x.target.value })}/></label>
    {e && <p className="e" role="alert">{e}</p>}{m && <p className="ok" role="status">{m}</p>}
    <button onClick={() => { setE(""); setM(""); post("/api/auth", { mode: "change", ...f }).then(() => { setM("Password changed. Other devices were signed out."); setF({ current: "", password: "" }); }).catch(x => setE(x.message)); }}>Change password</button></div></section>;
}
export default function Page() {
    const [u, setU] = useState(null), [ready, setReady] = useState(false), [tab, setTab] = useState("verify"), [token, setToken] = useState();
    useEffect(() => {
        const q = new URLSearchParams(location.search), k = q.has("verify") ? "verify" : q.has("reset") ? "reset" : "";
        if (k) {
            setToken({ kind: k, value: q.get(k) });
            setTab("login");
        }
        api("/api/auth").then(setU).finally(() => setReady(true));
    }, []);
    if (!ready)
        return <main className="app-shell"><div className="loading-screen"><span className="brand-mark">S</span><span className="spinner"/>Preparing your secure workspace…</div></main>;
    const tabs = [["verify", "Check image"], ...(u ? [["register", "Protect image"], ["mine", "My images"], ["history", "History"], ["account", "Account"]] : [["login", "Log in"]])];
    return <main className="app-shell"><header className="topbar"><a className="brand-lockup" href="/"><span className="brand-mark">S</span><span>secure<span className="brand-light">mark</span><small>IMAGE INTEGRITY PLATFORM</small></span></a>
      <nav className="main-nav" aria-label="Sections">{tabs.map(([k, t]) => <button data-tab={k} key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{t === "Check image" && <span className="nav-icon">⌕</span>}{t === "Protect image" && <span className="nav-icon">✳</span>}{t === "My images" && <span className="nav-icon">▤</span>}{t === "History" && <span className="nav-icon">◷</span>}{t === "Account" && <span className="nav-icon">⚙</span>}{t === "Log in" && <span className="nav-icon">↗</span>}{t}</button>)}
      <a href="/research">Research</a>{u?.role === "ADMIN" && <a href="/admin">Admin</a>}</nav>
      <div className="topbar-right">{u ? <><span className="user-status"><i/>{u.name}</span><button className="button-outline compact" onClick={() => post("/api/auth", { mode: "logout" }).then(() => { setU(null); setTab("verify"); })}>Sign out</button></> : <button className="button-primary compact" onClick={() => setTab("login")}>Sign in <span aria-hidden="true">→</span></button>}</div></header>
    <div className="account-strip"><span><span className="live-dot"/>{u ? "SIGNED IN / SECURE WORKSPACE" : "PUBLIC AREA / IMAGE CHECKS ARE OPEN"}</span><span>IMAGE INTEGRITY, PROVEN.</span></div>
    {tab === "verify" && <Verify signedIn={Boolean(u)} onOpenProtect={() => setTab(u ? "register" : "login")} />}{tab === "login" && !u && <Auth token={token} done={x => { setU(x); setTab("register"); }}/>}
    {tab === "register" && u && <Register />}{tab === "mine" && u && <Mine />}{tab === "history" && u && <History />}{tab === "account" && u && <Account />}
    <footer className="site-footer"><span>© SECUREMARK / IMAGE OWNERSHIP, MADE VERIFIABLE.</span><span>PROTECTED WITH ENCRYPTION <i className="live-dot"/></span></footer></main>;
}
