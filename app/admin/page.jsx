"use client";
import { useEffect, useState } from "react";
import { api, patch, when } from "@/lib/client";
export default function Page() {
    const [d, setD] = useState(), [e, setE] = useState(""), [q, setQ] = useState("");
    const refresh = () => api("/api/admin").then(setD).catch(x => setE(x.message));
    useEffect(() => { refresh(); }, []);
    if (e)
        return <main><h1><a href="/">SecureMark</a></h1><p className="e" role="alert">{e}</p></main>;
    if (!d)
        return <main><p>Loading…</p></main>;
    const s = d.stats, f = q.toLowerCase(), users = d.users.filter((u) => !f || u.name.toLowerCase().includes(f) || u.email.includes(f)), images = d.images.filter((i) => !f || i.regId.toLowerCase().includes(f) || i.name.toLowerCase().includes(f));
    const name = (id) => (id ? d.users.find((u) => u.id === id)?.name || id : "anonymous");
    return <main><header><h1><a href="/">SecureMark</a> admin</h1></header>
    <div className="stats">{[["Users", s.users], ["Images", s.images], ["Verifications", s.verifications], ["Verified", s.verified], ["Modified", s.modified], ["No watermark", s.unregistered], ["Inconclusive", s.inconclusive], ["Failed logins", s.failedLogins], ["Suspicious IPs", s.suspiciousIps]].map(([k, v]) => <div className="stat" key={String(k)}><b>{v}</b>{k}</div>)}</div>
    <p className={d.auditChainOk ? "ok" : "e"} role="status">{d.auditChainOk ? "Audit log hash chain intact." : "WARNING: audit log hash chain is broken; entries were altered or removed."}</p>
    <label>Search users / registration IDs<input value={q} onChange={x => setQ(x.target.value)}/></label>
    <h2>Users</h2><div className="scroll"><table><thead><tr><th>Name</th><th>E-mail</th><th>Role</th><th>Images</th><th>Joined</th><th>Status</th></tr></thead><tbody>
      {users.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.email}{u.verified ? "" : " (unverified)"}</td><td>{u.role}</td><td>{u.images}</td><td>{when(u.at)}</td>
        <td>{u.role === "ADMIN" ? "—" : <button className={u.active ? "danger" : ""} onClick={() => confirm(`${u.active ? "Suspend" : "Reactivate"} ${u.name}?`) && patch("/api/admin", { userId: u.id, active: !u.active }).then(refresh).catch(x => setE(x.message))}>{u.active ? "Suspend" : "Reactivate"}</button>}</td></tr>)}</tbody></table></div>
    <h2>Registered images</h2><div className="scroll"><table><thead><tr><th>Registration</th><th>Name</th><th>Owner</th><th>Method</th><th>When</th></tr></thead><tbody>
      {images.map((i) => <tr key={i.id}><td><a href={`/verify/${i.regId}`}>{i.regId}</a></td><td>{i.name}</td><td>{i.owner}</td><td>{i.alg.toUpperCase()}</td><td>{when(i.at)}</td></tr>)}</tbody></table></div>
    <h2>Recent verifications</h2><div className="scroll"><table><thead><tr><th>When</th><th>Result</th><th>Registration</th><th>By</th><th>Client (hashed)</th></tr></thead><tbody>
      {d.verifications.map((v) => <tr key={v.id}><td>{when(v.at)}</td><td>{v.status}{v.kind ? ` · ${v.kind}` : ""}</td><td>{v.regId || "—"}</td><td>{name(v.userId)}</td><td className="mono">{v.ip}</td></tr>)}</tbody></table></div>
    <h2>Audit log</h2><div className="scroll"><table><thead><tr><th>Time</th><th>Action</th><th>User</th><th>Details</th></tr></thead><tbody>
      {d.audit.map((a, i) => <tr key={i}><td>{when(a.t)}</td><td>{a.action}</td><td>{name(a.userId)}</td><td className="mono">{JSON.stringify(a.details)}</td></tr>)}</tbody></table></div></main>;
}
