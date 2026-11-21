"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
const pc = (x) => Math.round(100 * x) + "%";
const cellBg = (x) => ({ background: `color-mix(in srgb, var(--ok) ${Math.round(x * 45)}%, transparent)` });
/** Results of `npm run eval`: quality, pixel-aligned attacks and geometric attacks for each configuration. */
export default function Page() {
    const [d, setD] = useState(), [e, setE] = useState("");
    useEffect(() => { api("/api/research").then(setD).catch(x => setE(x.message)); }, []);
    return <main><header><h1><a href="/">SecureMark</a></h1></header><h2>Research: algorithm comparison</h2>
    {e && <p className="e">{e}</p>}{!d && !e && <p>Loading…</p>}
    {d && <>
      <p className="dim">{d.note} {d.images.length} images, generated {new Date(d.generated).toLocaleString()}. Recovery rate = share of images whose AES-GCM-authenticated payload was decoded.</p>
      <h2>Quality and speed</h2><div className="scroll"><table><thead><tr><th>Configuration</th><th>Bits</th><th>PSNR dB</th><th>SSIM</th><th>Embed ms</th><th>Extract ms</th></tr></thead><tbody>
        {d.configs.map((c) => { const q = d.quality[c.id]; return <tr key={c.id}><td>{c.label}</td><td>{c.bitsEmbedded}</td><td>{q.psnr.toFixed(1)}</td><td>{q.ssim.toFixed(4)}</td><td>{q.embedMs.toFixed(0)}</td><td>{q.extractMs.toFixed(0)}</td></tr>; })}</tbody></table></div>
      <h2>Pixel-aligned attacks</h2><p className="dim">Each cell: recovery rate · bit error rate before error correction · normalised correlation.</p>
      <div className="scroll"><table><thead><tr><th>Attack</th>{d.configs.map((c) => <th key={c.id}>{c.label}</th>)}</tr></thead><tbody>
        {Object.keys(d.pixel[d.configs[0].id]).map(a => <tr key={a}><td>{a}</td>{d.configs.map((c) => { const m = d.pixel[c.id][a]; return <td key={c.id} style={cellBg(m.recovery)}>{pc(m.recovery)} · {(100 * m.ber).toFixed(1)}% · {m.nc.toFixed(2)}</td>; })}</tr>)}</tbody></table></div>
      <h2>Geometric attacks (full pipeline with re-synchronisation)</h2>
      <div className="scroll"><table><thead><tr><th>Attack</th><th>DWT + redundancy + RS</th><th>DCT + redundancy + RS</th></tr></thead><tbody>
        {Object.keys(d.geometric["dwt-red-ecc"]).map(a => <tr key={a}><td>{a}</td><td style={cellBg(d.geometric["dwt-red-ecc"][a])}>{pc(d.geometric["dwt-red-ecc"][a])}</td><td style={cellBg(d.geometric["dct-red-ecc"][a])}>{pc(d.geometric["dct-red-ecc"][a])}</td></tr>)}</tbody></table></div></>}</main>;
}
