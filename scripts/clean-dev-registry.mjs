// Removes this project's entries from Wrangler's local dev registry when the dev session that wrote them is no longer running.
// A dev session that is force-killed (e.g. stopping a VS Code task or concurrently on Windows) leaves its entry behind, and
// Wrangler won't replace an entry owned by another process until it is 90s old, so the API can't reach the cache service's
// Durable Objects ("Network connection lost") for up to 90s after a restart.
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { connect } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";

const WORKER_NAMES = ["jingle-jam-tracker", "tiltify-cache"];

// Mirrors Wrangler's registry location: WRANGLER_REGISTRY_PATH, else <global config dir>/registry
function registryPath() {
    if (process.env.WRANGLER_REGISTRY_PATH) {
        return process.env.WRANGLER_REGISTRY_PATH;
    }
    const legacyDir = join(homedir(), ".wrangler");
    if (existsSync(legacyDir)) {
        return join(legacyDir, "registry");
    }
    let configDir = process.env.XDG_CONFIG_HOME;
    if (!configDir) {
        if (process.platform === "win32") {
            configDir = join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "xdg.config");
        } else if (process.platform === "darwin") {
            configDir = join(homedir(), "Library", "Preferences");
        } else {
            configDir = join(homedir(), ".config");
        }
    }
    return join(configDir, ".wrangler", "registry");
}

function isListening(address) {
    const [host, port] = address.split(":");
    return new Promise(resolve => {
        const socket = connect({ host, port: Number(port) });
        socket.setTimeout(500);
        socket.once("connect", () => { socket.destroy(); resolve(true); });
        socket.once("timeout", () => { socket.destroy(); resolve(false); });
        socket.once("error", () => resolve(false));
    });
}

for (const name of WORKER_NAMES) {
    const file = join(registryPath(), name);
    let definition;
    try {
        definition = JSON.parse(readFileSync(file, "utf8"));
    } catch {
        continue;
    }
    if (definition.debugPortAddress && !(await isListening(definition.debugPortAddress))) {
        try {
            unlinkSync(file);
            console.log(`Removed stale dev registry entry: ${name}`);
        } catch { }
    }
}
