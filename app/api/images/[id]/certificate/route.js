import { NextResponse } from "next/server";
import { audit, mutate, requireUser, route } from "@/lib/auth";
import { load } from "@/lib/db";
import { certificatePdf } from "@/lib/cert";
import { HttpError } from "@/lib/util";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = route(async (_req, { params }) => {
    const u = await requireUser(), db = await load(), img = db.images.find(i => i.id === params.id);
    if (!img || (img.userId !== u.id && u.role !== "ADMIN"))
        throw new HttpError("Not found.", 404);
    const owner = db.users.find(x => x.id === img.userId);
    const pdf = await certificatePdf(img, owner);
    await mutate(d => audit(d, "certificate", u.id, { regId: img.record.regId }));
    return new NextResponse(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${img.record.regId}-certificate.pdf"`, "Cache-Control": "private, no-store" } });
});
