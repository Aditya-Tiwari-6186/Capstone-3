import fs from "node:fs";
import path from "node:path";

export function loadEnvFile(file = path.join(process.cwd(), ".env")) {
    let text;
    try {
        text = fs.readFileSync(file, "utf8");
    }
    catch (error) {
        if (error.code === "ENOENT")
            return;
        throw error;
    }
    for (const line of text.split(/\r?\n/)) {
        const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/.exec(line);
        if (!match || line.trimStart().startsWith("#"))
            continue;
        let value = match[2];
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
            value = value.slice(1, -1);
        if (process.env[match[1]] === undefined || process.env[match[1]] === "")
            process.env[match[1]] = value;
    }
}
