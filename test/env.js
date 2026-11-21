// Import this FIRST in every test file: imports are hoisted, so this must be a module side effect, not a call.
import fs from "fs";
import os from "os";
import path from "path";
process.env.SECUREMARK_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "securemark-test-"));
process.env.NODE_ENV = process.env.NODE_ENV || "test";
