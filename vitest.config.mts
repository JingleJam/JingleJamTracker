import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "tiltify-cache": fileURLToPath(new URL("./workers/tiltify-cache/src", import.meta.url)),
        },
    },
    test: {
        projects: [
            {
                // Fast tests against a fake Tiltify, run in CI
                extends: true,
                test: {
                    name: "unit",
                    include: ["workers/*/test/**/*.test.ts"],
                    exclude: ["**/*.live.test.ts"],
                },
            },
            {
                // Tests that call the real Tiltify API, run on demand
                extends: true,
                test: {
                    name: "live",
                    include: ["workers/*/test/**/*.live.test.ts"],
                    testTimeout: 60000,
                },
            },
        ],
    },
});
