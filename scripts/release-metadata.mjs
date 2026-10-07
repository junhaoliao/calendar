import assert from "node:assert/strict";
import {appendFileSync, readFileSync} from "node:fs";

const {
    name,
    version,
    private: isPrivate,
} = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
assert.equal(name, "@junhaoliao/calendar", "Unexpected npm package name.");
assert.notEqual(isPrivate, true, "The package must allow publication.");
assert.equal(process.env.GITHUB_REF_TYPE, "tag", "Run the release workflow from a version tag.");
assert.equal(process.env.GITHUB_REF_NAME, `v${version}`, "The Git tag must match package.json.");

// Stable versions use latest; named prereleases use their first identifier.
// Restrict the first identifier to a name so npm cannot interpret it as a version.
const match = /^(\d+\.\d+\.\d+)(?:-([a-z][a-z0-9-]*)(?:\.[a-z0-9-]+)*)?$/.exec(version);
assert.ok(match, "Use a stable version or a named prerelease such as 0.2.0-beta.1.");
const tag = match[2] ?? (process.env.RELEASE_PRERELEASE === "true" ? "next" : "latest");
assert.ok(!match[2] || tag !== "latest", "Prereleases must not use the latest distribution tag.");
assert.ok(process.env.GITHUB_OUTPUT, "GitHub Actions output path is required.");
appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\ntag=${tag}\n`);
console.log(`Release ${name}@${version} with npm distribution tag ${tag}.`);
