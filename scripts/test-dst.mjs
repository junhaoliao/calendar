import {spawnSync} from "node:child_process";

// Every suite runs in a timezone with DST transitions; date helpers must not
// assume 24-hour days. Tests gated with it.runIf(...) only execute here.
const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", ...process.argv.slice(2)], {
    stdio: "inherit",
    env: {...process.env, TZ: "America/Toronto"},
});
process.exit(result.status ?? 1);
