import {describe, expect, it} from "vitest";

import {eventDatesChanged, moveEvent} from "./move";
import {lastOccupiedDay} from "./dates";
import {onDay} from "./dates";
import {timedPlacements} from "./timed-layout/placements";

/**
 * Creates a local wall-clock fixture.
 *
 * @return A local date.
 */
const day = (date: number, minute = 0) => new Date(2026, 9, date, 0, minute);
const timed = {
    id: "event",
    title: "Maintenance",
    start: day(5, 1320),
    end: day(6, 120),
    metadata: {source: "consumer", resourceId: "room-a"},
    color: "violet" as const,
};

describe("consistent drag conversions", () => {
    it("finds the last occupied date for an id-less timed range", () => {
        const range = {allDay: false, start: day(5, 1320), end: day(6)};

        expect(lastOccupiedDay(range)).toEqual(day(5));
    });
    it.each([1, 3])("converts a %i-day all-day event to one hour at the snapped drop", (count) => {
        const original = {...timed, allDay: true, start: day(6), end: day(5 + count, 1439)};
        const result = moveEvent(original, day(7), {date: day(9), minute: 842});
        expect(result).toMatchObject({
            allDay: false,
            id: timed.id,
            metadata: timed.metadata,
            start: day(9, 840),
            end: day(9, 900),
        });
        expect(result.metadata).toBe(original.metadata);
        expect(original.allDay).toBe(true);
    });
    it("uses configurable duration for both the move and the preview calculation", () => {
        const original = {...timed, allDay: true};
        expect(moveEvent(original, day(5), {date: day(8), minute: 1425}, 90)).toMatchObject({
            start: day(8, 1425),
            end: day(9, 75),
            allDay: false,
        });
        for (const invalid of [0, -1, NaN, Infinity]) {
            const result = moveEvent(original, day(5), {date: day(8), minute: 600}, invalid);
            expect(result.end.getTime() - result.start.getTime()).toBe(3600000);
        }
    });
    it("converts timed spans to their occupied dates aligned with the grabbed date", () => {
        expect(moveEvent(timed, day(6), {date: day(9), allDay: true})).toMatchObject({
            allDay: true,
            start: day(8),
            end: new Date(2026, 9, 9, 23, 59, 59, 999),
        });
        const untilMidnight = {...timed, end: day(6)};
        expect(lastOccupiedDay(untilMidnight)).toEqual(day(5));
        expect(onDay(untilMidnight, day(6))).toBe(false);
        expect(moveEvent(untilMidnight, day(5), {date: day(9), allDay: true}).end).toEqual(
            new Date(2026, 9, 9, 23, 59, 59, 999),
        );
        const zero = {...timed, start: day(5), end: day(5)};
        expect(moveEvent(zero, day(5), {date: day(9), allDay: true}).end).toEqual(
            new Date(2026, 9, 9, 23, 59, 59, 999),
        );
    });
    it("moves continued timed segments as one event, preserving elapsed duration and metadata", () => {
        const result = moveEvent(timed, day(6), {date: day(8), minute: 540});
        expect(result.start).toEqual(day(8, 420));
        expect(result.end).toEqual(day(8, 660));
        expect(result.id).toBe(timed.id);
        expect(result.metadata).toBe(timed.metadata);
        expect(timed.start).toEqual(day(5, 1320));
        expect(moveEvent(timed, day(5), {date: day(7), minute: 1260})).toMatchObject({
            start: day(7, 1260),
            end: day(8, 60),
        });
    });
    it("preserves all-day date count and detects a type-only change", () => {
        const original = {...timed, allDay: true, start: day(6), end: new Date(2026, 9, 8, 23, 59, 59, 999)};
        const moved = moveEvent(original, day(7), {date: day(10), allDay: true});
        expect(moved.start).toEqual(day(9));
        expect(moved.end).toEqual(new Date(2026, 9, 11, 23, 59, 59, 999));
        expect(eventDatesChanged(original, original)).toBe(false);
        expect(eventDatesChanged(original, {...original, allDay: false})).toBe(true);
    });
});

describe("timed midnight segmentation", () => {
    it("excludes a terminal midnight after year rollover and preserves a zero-length date", () => {
        const original = {...timed, start: new Date(2026, 11, 31, 22), end: new Date(2027, 0, 1)};
        expect(lastOccupiedDay(original)).toEqual(new Date(2026, 11, 31));
        expect(timedPlacements([original], new Date(2027, 0, 1))).toEqual([]);
        const midnight = {...original, start: new Date(2027, 0, 1)};
        expect(timedPlacements([midnight], midnight.start)).toHaveLength(1);
        expect(moveEvent(midnight, midnight.start, {date: midnight.start, allDay: true}).end).toEqual(
            new Date(2027, 0, 1, 23, 59, 59, 999),
        );
    });
    it.runIf(new Date(2026, 2, 8, 0).getTimezoneOffset() !== new Date(2026, 2, 8, 4).getTimezoneOffset())(
        "handles a repeated fall-back hour segment and a nonexistent spring time",
        () => {
            const repeated = {
                ...timed,
                start: new Date("2026-11-01T01:45:00-04:00"),
                end: new Date("2026-11-01T01:15:00-05:00"),
            };
            const [segment] = timedPlacements([repeated], repeated.start);
            expect(segment.height).toBe(32);
            const moved = moveEvent(repeated, repeated.start, {date: day(9), minute: 600});
            expect(moved.end.getTime() - moved.start.getTime()).toBe(1800000);
            const allDay = {...timed, allDay: true};
            const spring = moveEvent(allDay, allDay.start, {date: new Date(2026, 2, 8), minute: 150});
            expect(spring.start.getHours()).toBe(3);
            expect(spring.end.getTime() - spring.start.getTime()).toBe(3600000);
        },
    );
    it("clips hourly segments to each date with continuation flags and shared event identity", () => {
        const [first] = timedPlacements([timed], day(5));
        const [second] = timedPlacements([timed], day(6));
        expect(first).toMatchObject({
            top: 1408,
            height: 128,
            continuesBefore: false,
            continuesAfter: true,
            segmentStart: timed.start,
            segmentEnd: day(6),
        });
        expect(second).toMatchObject({
            top: 0,
            height: 128,
            continuesBefore: true,
            continuesAfter: false,
            segmentStart: day(6),
            segmentEnd: timed.end,
        });
        expect(first.event).toBe(second.event);
        expect(timedPlacements([{...timed, end: day(6)}], day(6))).toEqual([]);
    });
    it("retains elapsed duration across spring/fall DST and all-day wall boundaries", () => {
        for (const month of [2, 10]) {
            const original = {
                ...timed,
                start: new Date(2026, month, month === 2 ? 8 : 1, 0),
                end: new Date(2026, month, month === 2 ? 8 : 1, 4),
            };
            const result = moveEvent(original, original.start, {date: day(9), minute: 1260});
            expect(result.end.getTime() - result.start.getTime()).toBe(
                original.end.getTime() - original.start.getTime(),
            );
            const allDay = moveEvent(original, original.start, {date: day(9), allDay: true});
            expect(allDay.end).toEqual(new Date(2026, 9, 9, 23, 59, 59, 999));
        }
        const original = {
            ...timed,
            allDay: true,
            start: new Date(2026, 2, 7),
            end: new Date(2026, 2, 9, 23, 59, 59, 999),
        };
        const moved = moveEvent(original, original.start, {date: new Date(2026, 2, 8), allDay: true});
        expect(moved.end).toEqual(new Date(2026, 2, 10, 23, 59, 59, 999));
        const hour = moveEvent(original, original.start, {date: new Date(2026, 2, 8), minute: 90});
        expect(hour.end.getTime() - hour.start.getTime()).toBe(3600000);
    });
});
