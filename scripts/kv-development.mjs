// Writes the static KV data to the development environment's remote KV namespace in one bulk put.
// Development tracks a past event (YEAR in [env.development.vars]), so it gets that year's causes from kv/development/,
// and the history and previous graphs from kv/ without that year or later, so the event isn't counted twice.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const NAMESPACE_ID = "c9634f49deeb4618b3c3f1980f777f7a";

const wrangler = readFileSync("workers/tiltify-cache/wrangler.toml", "utf8");
const year = parseInt(wrangler.split("[env.development.vars]")[1]?.match(/^YEAR\s*=\s*(\d+)/m)?.[1]);
if (!year) {
    throw new Error("No YEAR in [env.development.vars] of workers/tiltify-cache/wrangler.toml");
}

const before = file => JSON.parse(readFileSync(file, "utf8")).filter(item => item.year < year);

const pairs = [
    { key: "causes", value: readFileSync("kv/development/causes.json", "utf8") },
    { key: "summary", value: JSON.stringify(before("kv/summary.json")) },
    { key: "trends-previous", value: JSON.stringify(before("kv/trends-previous.json")) },
];

const dir = mkdtempSync(join(tmpdir(), "jj-kv-dev-"));
const file = join(dir, "kv.json");
try {
    writeFileSync(file, JSON.stringify(pairs));
    execFileSync(
        "npx",
        ["wrangler", "kv", "bulk", "put", file, `--namespace-id=${NAMESPACE_ID}`, "--remote"],
        { stdio: "inherit", shell: process.platform === "win32" }
    );
    console.log(`Uploaded development KV for ${year}: ${pairs.map(pair => pair.key).join(", ")}`);
} finally {
    rmSync(dir, { recursive: true, force: true });
}
