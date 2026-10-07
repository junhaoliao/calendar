import {createRequire} from "node:module";
import {readFile, readdir, mkdir, writeFile, realpath} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const queue = Object.keys(manifest.dependencies).map((name) => ({
    name,
    from: path.join(root, "package.json"),
    usage: "runtime",
}));
for (const name of ["react", "react-dom"]) queue.push({name, from: path.join(root, "package.json"), usage: "peer"});
for (const name of ["shadcn", "tailwindcss", "tw-animate-css"])
    queue.push({name, from: path.join(root, "package.json"), usage: "copied UI / generated CSS"});
for (const name of ["@fontsource-variable/inter", "sonner"])
    queue.push({name, from: path.join(root, "package.json"), usage: "demo only"});
const records = new Map();
await mkdir(path.join(root, "LICENSES"), {recursive: true});
while (queue.length) {
    const {name, from, usage} = queue.shift();
    const require = createRequire(from);
    let file;
    // Read package metadata through the installed tree even for CSS-only exports.
    for (const directory of require.resolve.paths(name) ?? []) {
        const candidate = path.join(directory, name, "package.json");
        try {
            if (JSON.parse(await readFile(candidate, "utf8")).name === name) {
                file = candidate;
                break;
            }
        } catch {
            /* Not installed at this ancestor. */
        }
    }
    if (!file) {
        file = require.resolve(name);
        let directory = path.dirname(file);
        while (true) {
            const candidate = path.join(directory, "package.json");
            try {
                if (JSON.parse(await readFile(candidate, "utf8")).name === name) {
                    file = candidate;
                    break;
                }
            } catch {
                /* Entry may be below a package boundary. */
            }
            const parent = path.dirname(directory);
            if (parent === directory) throw new Error(`Cannot resolve license metadata for ${name}`);
            directory = parent;
        }
    }
    file = await realpath(file);
    const pkg = JSON.parse(await readFile(file, "utf8"));
    const key = `${pkg.name}@${pkg.version}`;
    if (records.has(key)) continue;
    const directory = path.dirname(file);
    const licenseNames = (await readdir(directory)).filter((name) => /^(licen[sc]e|copying|notice)(\.|$)/i.test(name));
    const outputNames = [];
    for (const name of licenseNames) {
        const outputName = `${pkg.name.replaceAll("/", "__").replace("@", "")}-${pkg.version}-${name}`;
        await writeFile(path.join(root, "LICENSES", outputName), await readFile(path.join(directory, name)));
        outputNames.push(outputName);
    }
    if (!outputNames.length) throw new Error(`License text missing from installed package ${key}`);
    records.set(key, {name: pkg.name, version: pkg.version, license: pkg.license, usage, notices: outputNames});
    // shadcn's CLI dependencies do not ship in this library; its copied UI/CSS does.
    if (usage === "runtime" || usage === "peer") {
        for (const dependency of Object.keys(pkg.dependencies ?? {}))
            queue.push({name: dependency, from: file, usage: "runtime transitive"});
    } else if (usage === "runtime transitive") {
        for (const dependency of Object.keys(pkg.dependencies ?? {})) queue.push({name: dependency, from: file, usage});
    }
}
const inventory = [...records.values()].sort((a, b) => a.name.localeCompare(b.name));
await writeFile(path.join(root, "LICENSES/inventory.json"), JSON.stringify(inventory, null, 2) + "\n");
const lines = inventory.map(
    (item) =>
        `| ${item.name} | ${item.version} | ${item.license} | ${item.usage} | ${item.notices.map((name) => `[notice](LICENSES/${name})`).join(", ")} |`,
);
await writeFile(
    path.join(root, "THIRD_PARTY_NOTICES.md"),
    `# Third-party notices\n\nCopied shadcn UI primitives (base-vega style, built on Base UI) and CSS retain the shadcn MIT notice.\nThe installed dependency texts below are preserved verbatim in LICENSES.\nDependencies remain external to the JavaScript build; generated CSS contains\nTailwind, tw-animate-css and shadcn styling. Inter and Sonner belong only to the\nstandalone demo and are not required by the package.\n\n| Package | Verified version | License | Use | Preserved notice |\n| --- | --- | --- | --- | --- |\n${lines.join("\n")}\n\nThe library uses the ${manifest.license} license; its root LICENSE names Junhao Liao as copyright holder.\nThird-party notices and license texts are retained independently.\nThe npm package @junhaoliao/calendar is not yet published.\n\nRegenerate against the lockfile installation with\n\`node scripts/license-inventory.mjs\`. This inventory covers runtime dependencies,\nruntime peers and the copied UI/CSS. Build/test tooling that does not ship is\nrecorded in pnpm-lock.yaml.\n`,
);
console.log(`Preserved license notices for ${inventory.length} packages.`);
