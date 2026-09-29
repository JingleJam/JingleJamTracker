// Writes the static KV data (kv/*.json) into the shared local Wrangler state in one bulk put.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const KEYS = ["causes", "summary", "trends-previous"];

const pairs = KEYS.map(key => ({ key, value: readFileSync(`kv/${key}.json`, "utf8") }));

const dir = mkdtempSync(join(tmpdir(), "jj-seed-"));
const file = join(dir, "kv.json");
try {
    writeFileSync(file, JSON.stringify(pairs));
    execFileSync(
        "npx",
        ["wrangler", "kv", "bulk", "put", file, "--binding=JINGLE_JAM_DATA", "--preview", "--local", "--persist-to", ".wrangler/state"],
        { stdio: "inherit", shell: process.platform === "win32" }
    );
    console.log(`Seeded local KV: ${KEYS.join(", ")}`);
} finally {
    rmSync(dir, { recursive: true, force: true });
}
