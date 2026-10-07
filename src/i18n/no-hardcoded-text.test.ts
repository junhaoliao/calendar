import {readFileSync, readdirSync} from "node:fs";
import path from "node:path";
import {describe, expect, it} from "vitest";

const calendarDirectory = path.resolve(process.cwd(), "src/components/event-calendar");
const bareJsxText = />\s*[A-Za-z][a-z]+(\s+[a-z]+)*\s*</u;
const literalAriaLabel = /aria-label=\{?["`][A-Za-z]/u;

// Add only justified source-path/line exceptions here, with a reason beside each.
// The `(no title)` value in use-event-draft.ts is a persisted data sentinel,
// not rendered JSX; it deliberately stays English and needs no allow-list entry.
const allowed: readonly string[] = [];

const violations = () =>
    readdirSync(calendarDirectory)
        .filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"))
        .flatMap((file) =>
            readFileSync(path.join(calendarDirectory, file), "utf8")
                .split(/\r?\n/u)
                .flatMap((line, index) => {
                    const location = `${file}:${index + 1}`;
                    return (bareJsxText.test(line) || literalAriaLabel.test(line)) && !allowed.includes(location)
                        ? [`${location}: ${line.trim()}`]
                        : [];
                }),
        );

describe("calendar built-in text guard", () => {
    it("has no bare English JSX text or literal English aria labels", () => {
        expect(violations()).toEqual([]);
    });
});
