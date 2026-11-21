"use client";
import { useState } from "react";
/** File picker with drag-and-drop and a live preview. */
export default function Drop({ label, onFile, busy }) {
    const [over, setOver] = useState(false), [prev, setPrev] = useState();
    const take = (f) => { if (!f)
        return; setPrev(URL.createObjectURL(f)); onFile(f); };
    return (<div className={`drop${over ? " over" : ""}`} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); if (!busy)
        take(e.dataTransfer.files?.[0]); }}>
      <label>{label}<input type="file" accept="image/png,image/jpeg,image/webp,image/tiff" disabled={busy} onChange={e => { take(e.target.files?.[0]); e.target.value = ""; }}/></label>
      <span className="dim">or drop an image here</span>
      {prev && <div><img src={prev} alt="Selected image preview" style={{ maxWidth: 220, maxHeight: 160, marginTop: 10, borderRadius: 8 }}/></div>}
    </div>);
}
