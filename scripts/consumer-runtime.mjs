import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {existsSync} from "node:fs";
import {cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const flag = (name) => {
    const index = process.argv.indexOf(name);
    return index < 0 ? undefined : process.argv[index + 1];
};
const react = flag("--react");
assert.ok(["18.3.1", "19.2.7"].includes(react), "Use --react 18.3.1 or 19.2.7");
const tarball = flag("--tarball");
assert.ok(tarball, "Use --tarball <packed .tgz>");
const packed = path.resolve(tarball);
assert.ok(existsSync(packed), `Missing tarball: ${packed}`);
const npmCLI = [
    path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
    path.resolve(path.dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
    "/usr/share/nodejs/npm/bin/npm-cli.js",
].find(existsSync);
assert.ok(npmCLI, "This Node installation needs its own compatible npm.");
const evidenceDir = path.join(root, "artifacts");
await mkdir(evidenceDir, {recursive: true});
const id = `node-${process.version.slice(1)}-react-${react}`;
const evidencePath = path.join(evidenceDir, `consumer-runtime-${id}.json`);
const scratchRoot = path.join(root, ".tmp");
await mkdir(scratchRoot, {recursive: true});
const host = await mkdtemp(path.join(scratchRoot, `consumer-runtime-${id}-`));
const resolvedHost = path.resolve(host);
const resolvedScratch = path.resolve(scratchRoot);
assert.ok(resolvedHost.startsWith(resolvedScratch + path.sep), `Unsafe host cleanup: ${resolvedHost}`);
const result = {
    node: process.version,
    executable: process.execPath,
    react,
    npm: null,
    tarball: packed,
    host,
    install: null,
    ssr: {},
    packages: [],
};
let succeeded = false;
try {
    const manifest = {
        name: `calendar-runtime-${id}`,
        private: true,
        type: "module",
        dependencies: {"@junhaoliao/calendar": `file:${packed.replaceAll("\\", "/")}`, react, "react-dom": react},
    };
    await writeFile(path.join(host, "package.json"), JSON.stringify(manifest, null, 2) + "\n");
    await cp(path.join(root, "examples/consumer/ssr.mjs"), path.join(host, "ssr.mjs"));
    const npm = (args, capture = false) =>
        execFileSync(process.execPath, [npmCLI, ...args], {
            cwd: host,
            stdio: capture ? "pipe" : "inherit",
            encoding: "utf8",
        });
    result.npm = npm(["--version"], true).trim();
    npm([
        "install",
        "--omit=dev",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--engine-strict",
        "--package-lock=false",
    ]);
    result.install = "passed";
    const seen = new Set();
    async function walk(directory) {
        if (!existsSync(directory)) return;
        for (const entry of await readdir(directory, {withFileTypes: true})) {
            if (!entry.isDirectory()) continue;
            if (entry.name.startsWith("@")) {
                for (const child of await readdir(path.join(directory, entry.name), {withFileTypes: true})) {
                    if (child.isDirectory()) await add(path.join(directory, entry.name, child.name));
                }
            } else await add(path.join(directory, entry.name));
        }
    }
    async function add(directory) {
        if (seen.has(directory)) return;
        seen.add(directory);
        const file = path.join(directory, "package.json");
        if (!existsSync(file)) return;
        const pkg = JSON.parse(await readFile(file, "utf8"));
        result.packages.push({
            name: pkg.name,
            version: pkg.version,
            engines: pkg.engines ?? null,
            path: path.relative(host, directory),
        });
        await walk(path.join(directory, "node_modules"));
    }
    await walk(path.join(host, "node_modules"));
    result.packages.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
    for (const mode of ["development", "production"]) {
        execFileSync(process.execPath, ["ssr.mjs"], {
            cwd: host,
            stdio: "inherit",
            env: {...process.env, NODE_ENV: mode},
        });
        result.ssr[mode] = "passed";
    }
    succeeded = true;
} catch (error) {
    result.error = error.message;
    throw error;
} finally {
    await writeFile(evidencePath, JSON.stringify(result, null, 2) + "\n");
    if (succeeded) {
        await rm(resolvedHost, {recursive: true, force: true});
    } else {
        console.error(`Kept failed runtime host: ${host}`);
    }
}
console.log(`${id}: strict install, ESM/CJS imports and development/production SSR passed.`);
