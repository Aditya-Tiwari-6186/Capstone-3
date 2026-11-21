import { NextResponse } from "next/server";
import { audit, mutate, requireUser, route } from "@/lib/auth";
import { getImageFile, load } from "@/lib/db";
import { HttpError } from "@/lib/util";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Download the protected PNG. Only its owner (or an admin) may fetch it. */
export const GET = route(async (_req, { params }) => {
    const u = await requireUser(), db = await load(), img = db.images.find(i => i.id === params.id);
    if (!img || (img.userId !== u.id && u.role !== "ADMIN"))
        throw new HttpError("Not found.", 404);
    const file = await getImageFile(img.id, "png");
    if (!file)
        throw new HttpError("The stored file is missing.", 404);
    await mutate(d => audit(d, "download", u.id, { regId: img.record.regId }));
    return new NextResponse(file, { headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${img.record.regId}.png"`, "Cache-Control": "private, no-store" } });
});
