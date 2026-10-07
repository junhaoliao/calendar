import {readFileSync} from "node:fs";
import path from "node:path";

import {describe, expect, it} from "vitest";

import type {
    CalendarEvent,
    CalendarLocale,
    CalendarNotification,
    CalendarNotificationAction,
    CalendarSlot,
    CalendarView,
    EventCalendarProps,
    EventColor,
    NewCalendarEvent,
    EventMoveResolver,
    EventMoveContext,
    EventMoveAnchor,
    EventMoveTarget,
    EventMoveLane,
    EventMoveConventions,
    EventMoveRejection,
    EventMoveRejected,
} from "./index";
import type {CalendarDropTarget, ResizeEdge} from "./date-math";
import * as main from "./index";
import * as dateMath from "./date-math";

const MAIN_RUNTIME = ["EventCalendar"];
const DATE_MATH_RUNTIME = [
    "DEFAULT_TIMED_DURATION_MINUTES",
    "atMinute",
    "calendarHeading",
    "daysFrom",
    "eventDatesChanged",
    "eventsOnDay",
    "lastOccupiedDay",
    "moveEvent",
    "navigateDate",
    "onDay",
    "resizeEvent",
];
const MAIN_TYPES = [
    "CalendarEvent",
    "CalendarLocale",
    "CalendarNotification",
    "CalendarNotificationAction",
    "CalendarSlot",
    "CalendarView",
    "EventCalendarProps",
    "EventColor",
    "NewCalendarEvent",
    "EventMoveResolver",
    "EventMoveContext",
    "EventMoveAnchor",
    "EventMoveTarget",
    "EventMoveLane",
    "EventMoveConventions",
    "EventMoveRejection",
    "EventMoveRejected",
];
const DATE_MATH_TYPES = ["CalendarDropTarget", "ResizeEdge"];

const documentedRows = (doc: string, entry: string): string[] => {
    const heading = `## \`${entry}\``;
    const start = doc.indexOf(heading);
    if (start < 0) {
        throw new Error(`Missing entry section: ${entry}`);
    }
    const rest = doc.slice(start + heading.length);
    const next = rest.search(/^## /m);
    const section = next < 0 ? rest : rest.slice(0, next);

    return [...section.matchAll(/^\|\s*`([A-Za-z_$][\w$]*)(?:<[^`]*>)?`\s*\|(.*)$/gm)].map((match) => {
        const cells = match[2].split(/(?<!\\)\|/).map((cell) => cell.trim());
        if (!cells[0] || !cells[1]) {
            throw new Error(`Missing kind/signature or contract: ${match[1]}`);
        }

        return match[1];
    });
};

type _UsedTypes = [
    CalendarEvent,
    CalendarLocale,
    CalendarNotification,
    CalendarNotificationAction,
    CalendarSlot,
    CalendarView,
    EventCalendarProps,
    EventColor,
    NewCalendarEvent,
    EventMoveResolver,
    EventMoveContext,
    EventMoveAnchor,
    EventMoveTarget,
    EventMoveLane,
    EventMoveConventions,
    EventMoveRejection,
    EventMoveRejected,
    CalendarDropTarget,
    ResizeEdge,
];

describe("public API", () => {
    it("exposes exactly the documented runtime exports", () => {
        expect(Object.keys(main).sort()).toEqual([...MAIN_RUNTIME].sort());
        expect(Object.keys(dateMath).sort()).toEqual([...DATE_MATH_RUNTIME].sort());
    });
    it("documents every export under its entry-point heading", () => {
        const doc = readFileSync(path.resolve(process.cwd(), "docs/API.md"), "utf8");

        expect(documentedRows(doc, "@junhaoliao/calendar").sort()).toEqual([...MAIN_RUNTIME, ...MAIN_TYPES].sort());
        expect(documentedRows(doc, "@junhaoliao/calendar/date-math").sort()).toEqual(
            [...DATE_MATH_RUNTIME, ...DATE_MATH_TYPES].sort(),
        );
    });
});
