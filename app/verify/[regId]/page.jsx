"use client";
import { useEffect, useState } from "react";
import { api, upload, when } from "@/lib/client";
import Drop from "@/components/Drop";
import Result from "@/components/Result";
/** Public page opened from the certificate QR code: shows the registration and lets anyone check an image against it. */
export default function Page({ params }) {
    const [rec, setRec] = useState(), [err, setErr] = useState(""), [r, setR] = useState(), [e, setE] = useState(""), [b, setB] = useState(false);
    useEffect(() => { api("/api/verify?reg=" + encodeURIComponent(params.regId)).then(setRec).catch(x => setErr(x.message)); }, [params.regId]);
    return <main><header><h1><a href="/">SecureMark</a></h1></header>
    <h2>Registration {params.regId}</h2>
    {err && <p className="e" role="alert">{err}</p>}
    {rec && <div className="card"><dl><dt>Registered owner</dt><dd>{rec.owner}</dd><dt>Registered at</dt><dd>{when(rec.registeredAt)}</dd><dt>Method</dt><dd>{rec.alg.toUpperCase()}</dd><dt>Size</dt><dd>{rec.width}×{rec.height} px</dd>
      <dt>Registered SHA-256</dt><dd className="mono">{rec.registeredHash}</dd><dt>Record signature</dt><dd>{rec.recordSignatureValid ? "valid (Ed25519)" : "INVALID"} · key {rec.keyFingerprint}</dd></dl>
      <p className="dim">This page shows that the registration exists. It does not show that any particular image belongs to it: upload the image below to check.</p></div>}
    <Drop label="Upload an image to check against SecureMark" busy={b} onFile={f => { setB(true); setE(""); setR(null); upload("/api/verify", f).then(setR).catch(x => setE(x.message)).finally(() => setB(false)); }}/>
    {e && <p className="e" role="alert">{e}</p>}{r && <Result r={r}/>}</main>;
}
