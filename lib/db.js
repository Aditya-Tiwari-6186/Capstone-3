import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { canon, sha256 } from "./util.js";

export const DATA = process.env.SECUREMARK_DATA || path.join(process.cwd(), "data");
export const FILES = path.join(DATA, "files");
fs.mkdirSync(FILES, { recursive: true });

const DBF = path.join(DATA, "db.json");
const empty = () => ({ users: [], images: [], verifications: [], audit: [], tokens: [], seq: { user: 0, img: 0 } });
const inTests = process.env.NODE_ENV === "test";
const poolKey = "__securemarkPostgresPool";
const readyKey = "__securemarkPostgresReady";
const pool = inTests ? null : (globalThis[poolKey] ||= new Pool({
    ...(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {}),
    max: 10,
}));

async function ensurePostgres() {
    if (!process.env.DATABASE_URL && !process.env.PGHOST)
        throw new Error("DATABASE_URL or PGHOST is required. Start the app with Docker Compose or configure PostgreSQL.");
    if (!globalThis[readyKey]) {
        globalThis[readyKey] = (async () => {
            const client = await pool.connect();
            try {
                await client.query("CREATE TABLE IF NOT EXISTS securemark_state (id smallint PRIMARY KEY CHECK (id = 1), data jsonb NOT NULL)");
                let initial = empty();
                if (process.env.SECUREMARK_IMPORT_LEGACY_DB !== "0") {
                    try {
                        initial = { ...empty(), ...JSON.parse(fs.readFileSync(DBF, "utf8")) };
                    }
                    catch (error) {
                        if (error.code !== "ENOENT")
                            throw error;
                    }
                }
                await client.query(
                    "INSERT INTO securemark_state (id, data) VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING",
                    [JSON.stringify(initial)],
                );
            }
            finally {
                client.release();
            }
        })().catch(error => {
            delete globalThis[readyKey];
            throw error;
        });
    }
    await globalThis[readyKey];
}

/** Read the persistent application state from PostgreSQL (or an isolated JSON file in tests). */
export async function load() {
    if (inTests) {
        try {
            return { ...empty(), ...JSON.parse(fs.readFileSync(DBF, "utf8")) };
        }
        catch (error) {
            if (error.code === "ENOENT")
                return empty();
            throw error;
        }
    }
    await ensurePostgres();
    const { rows } = await pool.query("SELECT data FROM securemark_state WHERE id = 1");
    if (!rows[0])
        throw new Error("SecureMark database state is missing.");
    return { ...empty(), ...rows[0].data };
}

/** Apply a synchronous state update while holding the PostgreSQL row lock. */
export async function mutate(fn) {
    if (inTests) {
        const db = await load(), result = fn(db);
        if (result && typeof result.then === "function")
            throw new TypeError("Database mutation callbacks must be synchronous.");
        const tmp = `${DBF}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(db));
        fs.renameSync(tmp, DBF);
        return result;
    }
    await ensurePostgres();
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const { rows } = await client.query("SELECT data FROM securemark_state WHERE id = 1 FOR UPDATE");
        if (!rows[0])
            throw new Error("SecureMark database state is missing.");
        const db = { ...empty(), ...rows[0].data };
        const result = fn(db);
        if (result && typeof result.then === "function")
            throw new TypeError("Database mutation callbacks must be synchronous.");
        await client.query("UPDATE securemark_state SET data = $1::jsonb WHERE id = 1", [JSON.stringify(db)]);
        await client.query("COMMIT");
        return result;
    }
    catch (error) {
        try {
            await client.query("ROLLBACK");
        }
        catch (rollbackError) {
            console.error("[securemark] database rollback failed", rollbackError);
        }
        throw error;
    }
    finally {
        client.release();
    }
}

/** Hash-chained audit log: every entry commits to the previous one, so edits/deletions are detectable. */
export function audit(db, action, userId, details = {}) {
    const prev = db.audit.length ? db.audit[db.audit.length - 1].h : "0".repeat(64);
    const e = { t: new Date().toISOString(), action, userId, details, prev };
    db.audit.push({ ...e, h: sha256(canon(e)) });
}

export function auditChainOk(db) {
    let prev = db.audit.length ? db.audit[0].prev : "";
    for (const a of db.audit) {
        const { h, ...e } = a;
        if (a.prev !== prev || sha256(canon(e)) !== h)
            return false;
        prev = a.h;
    }
    return true;
}
