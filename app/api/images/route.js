import { NextResponse } from "next/server";
import { limit, requireUser, requireVerified, route, uploaded } from "@/lib/auth";
import { load } from "@/lib/db";
import { registerImage } from "@/lib/register";
import { HttpError } from "@/lib/util";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const GET = route(async () => {
    const u = await requireUser();
    const db = await load();
    return NextResponse.json(db.images.filter(i => i.userId === u.id).reverse().map(i => ({
        id: i.id, regId: i.record.regId, name: i.name, at: i.record.at, alg: i.record.alg, psnr: i.psnr, ssim: i.ssim, w: i.record.w, h: i.record.h, bytes: i.bytes,
        sha256: i.record.wm, originalSha256: i.record.orig, exif: i.exif,
    })));
});
export const POST = route(async (req) => {
    const u = await requireVerified();
    limit("up:" + u.id, 30, 3600000);
    const { buf, name, form } = await uploaded(req);
    const alg = form.get("alg") === "dct" ? "dct" : "dwt";
    if (form.get("alg") && !["dwt", "dct"].includes(String(form.get("alg"))))
        throw new HttpError("Unknown algorithm.");
    return NextResponse.json(await registerImage(u, buf, name, alg));
});
