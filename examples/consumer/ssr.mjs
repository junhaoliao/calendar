import assert from "node:assert/strict";
import {createElement} from "react";
import {renderToString} from "react-dom/server";
import {EventCalendar} from "@junhaoliao/calendar";
import {calendarHeading} from "@junhaoliao/calendar/date-math";
import {createRequire} from "node:module";

assert.equal(typeof globalThis.window, "undefined");
const require = createRequire(import.meta.url);
const commonjs = require("@junhaoliao/calendar");
const pure = require("@junhaoliao/calendar/date-math");
assert.equal(typeof commonjs.EventCalendar, "function");
assert.equal(typeof pure.moveEvent, "function");
const date = new Date(2026, 9, 4, 9);
assert.equal(calendarHeading(date, "agenda"), "October 2026");
// Upstream DnD uses layout effects: React 18 emits its expected SSR advisory.
const warnings = [];
const onError = console.error;
console.error = (...args) => warnings.push(args.join(" "));
try {
    for (const component of [EventCalendar, commonjs.EventCalendar]) {
        for (const view of ["month", "week", "day", "agenda"]) {
            const html = renderToString(
                createElement(component, {
                    events: [{id: "ssr", title: "SSR meeting", start: date, end: new Date(date.getTime() + 5400000)}],
                    initialDate: date,
                    now: date,
                    initialView: view,
                }),
            );
            assert.ok(html.includes("Event calendar"));
        }
    }
} finally {
    console.error = onError;
}
assert.ok(warnings.every((message) => message.includes("useLayoutEffect does nothing on the server")));
console.log(
    `ESM/CJS imports and eight static SSR renders passed (${warnings.length} React 18 layout-effect advisories).`,
);
