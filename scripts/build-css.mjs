import {readFile, writeFile, mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import selectorParser from "postcss-selector-parser";

const root = fileURLToPath(new URL("..", import.meta.url));
const scope = "[data-event-calendar-scope]";
const scopeConstraint = `:where(${scope}, ${scope} *)`;

// Apply after Tailwind expansion, including preflight and property fallbacks.
// A zero-specificity constraint retains the upstream cascade and raw controls.
const isolate = {
    postcssPlugin: "event-calendar-css-scope",
    Once(root) {
        const animations = new Map();
        root.walkAtRules("keyframes", (rule) => {
            const name = rule.params;
            animations.set(name, `event-calendar-${name}`);
            rule.params = animations.get(name);
        });
        root.walkDecls((decl) => {
            if (!/animation|^--animate/.test(decl.prop)) return;
            for (const [name, scopedName] of animations) {
                decl.value = decl.value.replace(new RegExp(`(?<![-\\w])${name}(?![-\\w])`, "g"), scopedName);
            }
        });
        root.walkRules((rule) => {
            if (rule.parent?.type === "atrule" && /keyframes$/.test(rule.parent.name)) return;
            if (!rule.selector) return;
            const selectors = selectorParser().astSync(rule.selector);
            for (const selector of selectors.nodes) {
                const original = selector.toString().trim();
                if ([":root", ":host", "html", "body"].includes(original)) {
                    selector.replaceWith(selectorParser().astSync(scope).first);
                } else {
                    const constraint = selectorParser().astSync(scopeConstraint).first.first;
                    const pseudoElement = selector.nodes.findLast(
                        (node) => node.type === "pseudo" && /^::/.test(node.value),
                    );
                    if (pseudoElement) selector.insertBefore(pseudoElement, constraint);
                    else selector.append(constraint);
                }
            }
            rule.selector = selectors.toString();
        });
    },
};

export async function buildCSS() {
    const source = path.join(root, "src/styles.css");
    const expanded = await postcss([tailwind({base: root, optimize: false})]).process(await readFile(source, "utf8"), {
        from: source,
    });
    const result = await postcss([isolate]).process(expanded.css, {from: undefined});
    await mkdir(path.join(root, "dist"), {recursive: true});
    await writeFile(path.join(root, "dist/styles.css"), result.css);
    await writeFile(path.join(root, "dist/styles.css.d.ts"), "export {};\n");
    console.log(`Built scoped CSS (${Math.round(result.css.length / 1024)} KiB).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await buildCSS();
