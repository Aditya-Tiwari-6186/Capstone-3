import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
/** Evaluation results produced by `npm run eval` (research/results.json). */
export async function GET() {
    try {
        return NextResponse.json(JSON.parse(fs.readFileSync(path.join(process.cwd(), "research", "results.json"), "utf8")));
    }
    catch {
        return NextResponse.json({ error: "No results yet. Run `npm run eval`." }, { status: 404 });
    }
}
