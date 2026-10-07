import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {existsSync} from "node:fs";
import {cp, mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "@playwright/test";
import {build, preview} from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const npmCLI = [
    path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
    path.resolve(path.dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
    "/usr/share/nodejs/npm/bin/npm-cli.js",
].find(existsSync);
assert.ok(npmCLI, "Use a Node installation that includes npm for the isolated tarball test.");
const npm = (args, cwd = root, capture = false) =>
    execFileSync(process.execPath, [npmCLI, ...args], {
        cwd,
        encoding: "utf8",
        stdio: capture ? "pipe" : "inherit",
    });
await mkdir(path.join(root, "artifacts"), {recursive: true});
const [packed] = JSON.parse(
    npm(["pack", "--ignore-scripts", "--json", "--pack-destination", path.join(root, "artifacts")], root, true),
);
assert.ok(packed.files.some((file) => file.path === "dist/styles.css"));
assert.ok(packed.files.some((file) => file.path === "dist/index.d.cts"));
assert.ok(packed.files.every((file) => !/^(src|node_modules|dist\/demo|\.tmp)\//.test(file.path)));
const tarball = path.join(root, "artifacts", packed.filename);
const runPackageTool = async (packageName, binName, args) => {
    const directory = path.join(root, "node_modules", packageName);
    const manifest = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
    const entry = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.[binName];
    assert.ok(entry, `Missing ${binName} executable in ${packageName}`);
    execFileSync(process.execPath, [path.resolve(directory, entry), ...args], {cwd: root, stdio: "inherit"});
};
await runPackageTool("publint", "publint", ["run", tarball, "--strict"]);
// CSS is a side-effect export with a declaration for noUncheckedSideEffectImports, not a JavaScript entrypoint.
await runPackageTool("@arethetypeswrong/cli", "attw", [
    tarball,
    "--profile",
    "node16",
    "--exclude-entrypoints",
    "styles.css",
]);
const results = [];
const browser = await chromium.launch({headless: true});
try {
    for (const version of ["19.2.7", "18.3.1"]) {
        await mkdir(path.join(root, ".tmp"), {recursive: true});
        const host = await mkdtemp(path.join(root, `.tmp/consumer-react-${version}-`));
        try {
            await cp(path.join(root, "examples/consumer"), host, {recursive: true});
            const manifest = JSON.parse(await readFile(path.join(host, "package.json"), "utf8"));
            manifest.dependencies["@junhaoliao/calendar"] = `file:${tarball.replaceAll("\\", "/")}`;
            manifest.dependencies.react = manifest.dependencies["react-dom"] = version;
            if (version.startsWith("18")) {
                manifest.devDependencies["@types/react"] = "18.3.27";
                manifest.devDependencies["@types/react-dom"] = "18.3.7";
            }
            await writeFile(path.join(host, "package.json"), JSON.stringify(manifest, null, 2));
            console.log(`Installing isolated tarball consumer with React ${version}...`);
            npm(["install", "--include=dev", "--ignore-scripts", "--no-audit", "--no-fund"], host);
            execFileSync(process.execPath, [path.join(host, "node_modules/typescript/bin/tsc"), "--noEmit"], {
                cwd: host,
                stdio: "inherit",
            });
            for (const mode of ["development", "production"]) {
                execFileSync(process.execPath, ["ssr.mjs"], {
                    cwd: host,
                    stdio: "inherit",
                    env: {...process.env, NODE_ENV: mode},
                });
            }
            await build({root: host, configFile: false, logLevel: "warn", build: {outDir: "dist"}});
            const server = await preview({
                root: host,
                configFile: false,
                preview: {host: "127.0.0.1", port: 4174, strictPort: true},
            });
            const context = await browser.newContext({viewport: {width: 1280, height: 900}});
            const page = await context.newPage();
            const errors = [];
            page.on("pageerror", (error) => errors.push(error.message));
            page.on("console", (message) => {
                if (message.type() === "error") errors.push(message.text());
            });
            try {
                await page.goto("http://127.0.0.1:4174");
                const calendar = page.getByLabel("Event calendar", {exact: true});
                await calendar.waitFor();
                assert.equal(
                    await page.locator(".sentinel.flex").evaluate((element) => getComputedStyle(element).display),
                    "block",
                );
                const hostStyle = await page.locator("body").evaluate((element) => {
                    const css = getComputedStyle(element);
                    return {
                        margin: css.margin,
                        font: css.fontFamily,
                        overflow: css.overflowY,
                        scrolls: document.documentElement.scrollHeight > innerHeight,
                    };
                });
                assert.deepEqual(hostStyle, {
                    margin: "13px",
                    font: "Georgia, serif",
                    overflow: "visible",
                    scrolls: true,
                });
                await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
                assert.ok(await page.evaluate(() => scrollY > 1000));
                await page.evaluate(() => scrollTo(0, 0));
                await page.locator('[data-slot="calendar-scroll"]').evaluate((element) => {
                    element.scrollTop = 500;
                });
                assert.equal(
                    Math.round(
                        await page
                            .getByRole("button", {name: /^Package meeting,/})
                            .evaluate((element) => element.getBoundingClientRect().height),
                    ),
                    96,
                );
                await page.getByRole("button", {name: /^Package meeting,/}).click();
                const editor = page.getByRole("dialog", {name: "Edit Event", exact: true});
                await editor.waitFor();
                assert.equal(
                    await editor.evaluate((element) => element.closest("[data-event-calendar-scope]").style.height),
                    "",
                );
                assert.equal(
                    await editor.evaluate((element) => getComputedStyle(element).backgroundColor),
                    "oklch(1 0 0)",
                );
                await page.getByRole("button", {name: "Start Date", exact: true}).click();
                const datePopup = page.locator('[data-slot="popover-content"][data-open]');
                await datePopup.waitFor();
                assert.equal(
                    await datePopup.evaluate((element) =>
                        getComputedStyle(element).getPropertyValue("--radius").trim(),
                    ),
                    "0.75rem",
                );
                await page.keyboard.press("Escape");
                await datePopup.waitFor({state: "detached"});
                await page.getByRole("textbox", {name: "Title", exact: true}).fill("Updated package meeting");
                await page.getByRole("button", {name: "Save", exact: true}).click();
                await editor.waitFor({state: "detached"});
                const [updated] = JSON.parse(await page.locator(".calendar-frame").getAttribute("data-host-events"));
                assert.equal(updated.id, "meeting:a|b]");
                assert.equal(updated.projectId, "calendar-demo");
                assert.deepEqual(updated.metadata, {source: "packed-host"});
                assert.equal(updated.title, "Updated package meeting");
                await page.getByRole("button", {name: "Adjust end of Updated package meeting", exact: true}).focus();
                await page.keyboard.press("ArrowDown");
                await page.keyboard.press("Enter");
                const [resized] = JSON.parse(await page.locator(".calendar-frame").getAttribute("data-host-events"));
                assert.equal(new Date(resized.end).getMinutes(), 45);
                assert.equal(resized.start, updated.start);
                assert.equal(resized.projectId, "calendar-demo");
                assert.deepEqual(resized.metadata, {source: "packed-host"});
                await page.getByRole("button", {name: "Host theme", exact: true}).click();
                await page.waitForFunction(
                    () =>
                        document.querySelector(".event-calendar")?.getAttribute("data-event-calendar-theme") === "dark",
                );
                await page.locator('[aria-haspopup="menu"]').click();
                const menu = page.getByRole("menu");
                await menu.waitFor();
                assert.equal(
                    await menu.evaluate((element) => getComputedStyle(element).backgroundColor),
                    "oklch(0.205 0 0)",
                );
                assert.equal(
                    await menu.evaluate((element) => getComputedStyle(element).getPropertyValue("--radius").trim()),
                    "0.75rem",
                );
                await page.getByRole("menuitem", {name: /^Agenda/}).click();
                assert.equal(await page.locator("[data-host-heading]").textContent(), "October 2026");
                await page.screenshot({
                    path: path.join(root, `artifacts/consumer-react-${version}-dark.png`),
                    fullPage: true,
                });
                await page.getByRole("button", {name: "Host read only", exact: true}).click();
                assert.equal(await page.getByRole("button", {name: "New event", exact: true}).count(), 0);
                await page.getByRole("button", {name: /^Updated package meeting,/}).click();
                assert.equal(await page.getByRole("dialog").count(), 0);
                await page.getByRole("button", {name: "Host theme", exact: true}).click();
                await page.waitForFunction(
                    () =>
                        document.querySelector(".event-calendar")?.getAttribute("data-event-calendar-theme") ===
                        "light",
                );
                await page.screenshot({
                    path: path.join(root, `artifacts/consumer-react-${version}-light.png`),
                    fullPage: true,
                });
                assert.deepEqual(errors, []);
                results.push({
                    react: version,
                    host: path.relative(root, host),
                    removed: true,
                    checks: [
                        "NodeNext ESM/CJS and strict CSS import types",
                        "ESM/CJS imports and development/production SSR",
                        "production tarball host",
                        "scoped CSS and host scrolling",
                        "editor/date/menu portals",
                        "metadata-safe editing",
                        "controlled navigation",
                        "light/dark",
                        "readOnly",
                        "no runtime errors",
                    ],
                });
                console.log(`React ${version}: package types, imports, SSR and browser consumer checks passed.`);
            } catch (error) {
                await page.screenshot({
                    path: path.join(root, `artifacts/consumer-react-${version}-failure.png`),
                    fullPage: true,
                });
                throw error;
            } finally {
                await context.close();
                server.httpServer.closeAllConnections();
                await new Promise((resolve) => server.httpServer.close(resolve));
            }
        } catch (error) {
            console.error(`Kept failed React ${version} consumer for debugging: ${host}`);
            throw error;
        }
        await rm(host, {recursive: true, force: true});
    }
} finally {
    await browser.close();
}
await writeFile(
    path.join(root, "artifacts/package-smoke.json"),
    JSON.stringify({tarball, size: packed.size, unpackedSize: packed.unpackedSize, results}, null, 2),
);
console.log(
    `Verified ${packed.filename}: ${Math.round(packed.size / 1024)} KiB packed; React 18 and 19 consumers passed.`,
);
