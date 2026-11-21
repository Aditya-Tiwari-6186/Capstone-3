export async function api(u, o) {
    const r = await fetch(u, o), j = await r.json().catch(() => null);
    if (!r.ok)
        throw new Error(j?.error || "Request failed");
    return j;
}
export const post = (u, b) => api(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
export const patch = (u, b) => api(u, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
export const upload = (u, f, extra = {}) => { const d = new FormData(); d.append("file", f); for (const k in extra)
    d.append(k, extra[k]); return api(u, { method: "POST", body: d }); };
export const when = (s) => new Date(s).toLocaleString();
