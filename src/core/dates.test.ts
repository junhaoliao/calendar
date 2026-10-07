import {describe, expect, it} from "vitest";
import {getDefaultOptions, setDefaultOptions} from "date-fns";
import {fr} from "date-fns/locale/fr";

import {atMinute, calendarHeading, daysFrom, eventsOnDay, isSpanning, monthDays, navigateDate} from "./dates";
import {moveEvent} from "./move";
import {timedPlacements} from "./timed-layout/placements";
import {weekSegments} from "./month-lanes";
import type {CalendarEvent} from "./types";

/**
 * Builds a local date fixture.
 */
const date = (day: number, minute = 0) => new Date(2026, 9, day, 0, minute);

/**
 * Builds an event fixture.
 */
const event = (id: string, start: Date, end: Date, allDay = false): CalendarEvent => ({
    allDay: allDay,
    end: end,
    id: id,
    start: start,
    title: id,
});

describe("calendar date math", () => {
    it("generates only intersecting complete Sunday-first month weeks", () => {
        const days = monthDays(date(4));
        expect(days).toHaveLength(35);
        expect(days[0]).toEqual(new Date(2026, 8, 27));
        expect(days[34]).toEqual(date(31));
        expect(monthDays(new Date(2026, 7, 1))).toHaveLength(42);
        expect(monthDays(new Date(2026, 1, 1))).toHaveLength(28);
    });
    it("clamps month navigation and uses view-specific range steps", () => {
        expect(navigateDate(new Date(2026, 0, 31), "month", 1)).toEqual(new Date(2026, 1, 28));
        expect(navigateDate(date(4), "week", -1)).toEqual(new Date(2026, 8, 27));
        expect(navigateDate(date(4), "day", 1)).toEqual(date(5));
        expect(navigateDate(date(4), "agenda", 1)).toEqual(new Date(2026, 10, 3));
    });
    it("detects different months with the same day number and inclusive final dates", () => {
        const spanning = event("span", new Date(2026, 8, 4, 9), date(4, 600));
        expect(isSpanning(spanning)).toBe(true);
        expect(eventsOnDay([spanning], date(4))).toEqual([spanning]);
        expect(eventsOnDay([spanning], date(5))).toEqual([]);
        const zero = event("zero", date(4), date(4), true);
        expect(eventsOnDay([zero], date(4))).toEqual([zero]);
    });
    it("formats range headings across months and years", () => {
        expect(calendarHeading(date(4), "month")).toBe("October 2026");
        expect(calendarHeading(date(31), "week")).toBe("October 2026");
        expect(calendarHeading(date(4), "agenda")).toBe("October 2026");
        expect(calendarHeading(date(31), "agenda")).toBe("October 2026");
        expect(calendarHeading(new Date(2026, 11, 31), "agenda")).toBe("December 2026");
        expect(calendarHeading(new Date(2026, 11, 31), "week")).toBe("Dec - Jan 2027");
    });
    it("uses the four optional heading patterns without changing the default cross-year range", () => {
        const options = {
            locale: fr,
            patterns: {
                monthYear: "'MONTH' yyyy",
                dayHeading: "'DAY' yyyy",
                weekStart: "'FROM' yyyy",
                weekEnd: "'TO' yyyy",
            },
        };
        expect(calendarHeading(date(4), "month", options)).toBe("MONTH 2026");
        expect(calendarHeading(date(4), "day", options)).toBe("DAY 2026");
        expect(calendarHeading(new Date(2026, 11, 31), "week", options)).toBe("FROM 2026 - TO 2027");
        expect(calendarHeading(new Date(2026, 11, 31), "week")).toBe("Dec - Jan 2027");
    });
    it("keeps Sunday geometry and default English headings under host Monday/French defaults", () => {
        const prior = getDefaultOptions();
        try {
            setDefaultOptions({weekStartsOn: 1, locale: fr});
            expect(monthDays(date(4))[0]).toEqual(new Date(2026, 8, 27));
            expect(calendarHeading(date(4), "month")).toBe("October 2026");
            expect(calendarHeading(new Date(2026, 11, 31), "week")).toBe("Dec - Jan 2027");
        } finally {
            // date-fns merges this object; explicit undefined removes keys added by the test.
            setDefaultOptions({locale: prior.locale, weekStartsOn: prior.weekStartsOn});
            expect(getDefaultOptions()).toEqual(prior);
        }
    });
    it("sets local wall time without mutating input or carrying seconds", () => {
        const original = date(4, 42);
        expect(atMinute(original, 585)).toEqual(date(4, 585));
        expect(original).toEqual(date(4, 42));
    });
});

describe("event positioning and movement", () => {
    it("keeps spanning lanes aligned and labels a continued event at week start", () => {
        const events = [
            event("short", date(5, 600), date(5, 660)),
            event("long", date(3), date(7), true),
            event("second", date(6), date(8), true),
        ];
        const layout = weekSegments(events, daysFrom(date(4), 7));
        expect(layout[0][0]).toMatchObject({
            hasLabel: true,
            isFirst: false,
            lane: 0,
        });
        expect(layout[1].find((item) => item.event.id === "short")?.lane).toBe(1);
        expect(layout[2].find((item) => item.event.id === "second")?.lane).toBe(1);
        expect(layout[3][0]).toMatchObject({
            hasLabel: false,
            isLast: true,
            lane: 0,
        });
    });
    it("moves a continued month segment by relative days, preserving start time and duration", () => {
        const source = event("span", date(7, 870), date(9, 885));
        const moved = moveEvent(source, date(8), {
            date: date(10),
        });

        expect(moved.start).toEqual(date(9, 870));
        expect(moved.end).toEqual(date(11, 885));
        expect(source.start).toEqual(date(7, 870));
    });
    it("snaps timed drops and preserves elapsed duration", () => {
        const source = event("lunch", date(5, 720), date(5, 795));
        const moved = moveEvent(source, date(5), {
            date: date(9),
            minute: 607,
        });

        expect(moved.start).toEqual(date(9, 600));
        expect(moved.end).toEqual(date(9, 675));
        expect(
            moveEvent(source, date(5), {
                date: date(9),
                minute: 1500,
            }).start,
        ).toEqual(date(9, 1425));
    });
    it("retains all-day date span and time boundaries across daylight-saving changes", () => {
        const source = event("all", new Date(2026, 2, 6), new Date(2026, 2, 8, 23, 59, 59, 999), true);
        const moved = moveEvent(source, source.start, {
            allDay: true,
            date: new Date(2026, 2, 7),
        });

        expect(moved.start).toEqual(new Date(2026, 2, 7));
        expect(moved.end).toEqual(new Date(2026, 2, 9, 23, 59, 59, 999));
        expect(daysFrom(new Date(2026, 2, 7), 3).map((day) => day.getDate())).toEqual([7, 8, 9]);
    });
    it("lays out simultaneous events in separate lanes without overflowing deep stacks", () => {
        const events = Array.from(
            {
                length: 12,
            },
            (_, index) => event(String(index), date(9, 540), date(9, 660)),
        );
        const layout = timedPlacements(events, date(9));
        expect(layout[0]).toMatchObject({
            height: 128,
            left: 0,
            top: 576,
        });
        expect(layout[0].width).toBeCloseTo(100 / 12);
        expect(layout[1].left).toBeCloseTo(100 / 12);
        expect(layout[1].width).toBeCloseTo(100 / 12);
        expect(layout.every((item) => item.left + item.width <= 100)).toBe(true);
        const adjacent = timedPlacements(
            [event("a", date(9, 540), date(9, 600)), event("b", date(9, 600), date(9, 660))],
            date(9),
        );

        expect(adjacent.map((item) => item.lane)).toEqual([0, 0]);
    });
});
