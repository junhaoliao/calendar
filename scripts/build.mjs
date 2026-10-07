import {build} from "esbuild";
import {rollup} from "rollup";
import {dts} from "rollup-plugin-dts";
import {execFileSync} from "node:child_process";
import {rm} from "node:fs/promises";
import {buildCSS} from "./build-css.mjs";

await rm("dist", {recursive: true, force: true});
await buildCSS();
execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.build.json"], {stdio: "inherit"});
for (const entry of ["index", "date-math"]) {
    for (const format of ["esm", "cjs"]) {
        await build({
            entryPoints: [`src/${entry}.ts`],
            outfile: `dist/${entry}.${format === "esm" ? "js" : "cjs"}`,
            bundle: true,
            packages: "external",
            format,
            platform: "neutral",
            target: "es2022",
            jsx: "automatic",
            sourcemap: true,
        });
    }
    const declarations = await rollup({input: `.tmp/types/${entry}.d.ts`, plugins: [dts()]});
    await declarations.write({file: `dist/${entry}.d.ts`, format: "es"});
    await declarations.write({file: `dist/${entry}.d.cts`, format: "es"});
    await declarations.close();
}
console.log("Built ESM, CommonJS, declarations, source maps and CSS.");
