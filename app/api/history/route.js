import { NextResponse } from "next/server";
import { requireUser, route } from "@/lib/auth";
import { load } from "@/lib/db";
export const dynamic = "force-dynamic";
/** The signed-in user's own verification history (checks they ran while logged in). */
export const GET = route(async () => {
    const u = await requireUser();
    const db = await load();
    return NextResponse.json(db.verifications.filter(v => v.userId === u.id).slice(-100).reverse().map(v => ({ id: v.id, at: v.at, status: v.status, kind: v.kind, regId: v.regId, hash: v.hash, pct: v.result.pct, changes: v.result.changes })));
});
