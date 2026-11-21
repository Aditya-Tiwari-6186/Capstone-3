import { NextResponse } from "next/server";
import { currentUser, ipOf, limit, route, uploaded } from "@/lib/auth";
import { publicKeyPem, keyFingerprint } from "@/lib/crypto";
import { publicRecord, verifyImage } from "@/lib/verify";
import { HttpError } from "@/lib/util";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
/** Public: no account needed. 20 requests per minute per IP. */
export const POST = route(async (req) => {
    limit("verify:" + ipOf(req), 20);
    const { buf } = await uploaded(req);
    const u = await currentUser();
    return NextResponse.json(await verifyImage(buf, { userId: u?.id ?? null, ip: ipOf(req) }));
});
/** Public record lookup: GET /api/verify?reg=SMK-2026-000001 (owner name, date, hashes only; never e-mail or file paths). */
export const GET = route(async (req) => {
    limit("lookup:" + ipOf(req), 60);
    const reg = new URL(req.url).searchParams.get("reg") || "";
    if (!/^SMK-\d{4}-\d{6}$/.test(reg))
        throw new HttpError("Not a valid registration ID.");
    const r = await publicRecord(reg);
    if (!r)
        throw new HttpError("No such registration.", 404);
    return NextResponse.json({ ...r, publicKey: publicKeyPem(), keyFingerprint: keyFingerprint() });
});
