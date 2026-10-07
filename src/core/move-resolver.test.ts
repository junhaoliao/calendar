import {describe, expect, it, vi} from "vitest";
import {addDays, differenceInCalendarDays} from "date-fns";
import {moveAnchor, moveTarget, resolveMove} from "./move";
import {onDay} from "./dates";
import {timedPlacements} from "./timed-layout/placements";
import type {CalendarEvent, EventMoveResolver} from "./types";

import type {MoveResolution} from "./move";

const accepted = <T extends CalendarEvent>(result: MoveResolution<T>): T => {
    if (result.status !== "accepted") throw new Error(result.reason ?? "Move rejected");
    return result.event;
};

const date = (day: number, hour = 0) => new Date(2026, 9, day, hour);
const event = {
    id: "task",
    title: "Task",
    start: date(4),
    end: date(6, 23),
    allDay: true,
    metadata: {endPrecision: "day", deadlineOnly: false},
    project: "host",
};

describe("host move resolution", () => {
    it.each(["Room is booked", "   "])("supports a host reason: %s", (reason) => {
        expect(
            resolveMove(event, moveAnchor(event, event.start, "all-day"), moveTarget({date: date(8)})!, () => ({
                reject: reason,
            })),
        ).toEqual({status: "rejected", reason: reason.trim() || null});
    });
    it("keeps an event's consumer-owned reject field as event data", () => {
        const result = accepted(
            resolveMove(
                event,
                moveAnchor(event, event.start, "all-day"),
                moveTarget({date: date(8)})!,
                ({defaultResult}) => ({...defaultResult, reject: "Consumer data"}),
            ),
        );
        expect(result.id).toBe(event.id);
    });
    it("rejects resolver exceptions without accepting the fallback", () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        const error = new Error("Host policy bug");
        expect(
            resolveMove(event, moveAnchor(event, event.start, "all-day"), moveTarget({date: date(8)})!, () => {
                throw error;
            }),
        ).toEqual({status: "rejected", reason: null});
        expect(log).toHaveBeenCalledExactlyOnceWith("resolveEventMove threw; the move was rejected.", error);
        log.mockRestore();
    });
    it.each([
        [7, 0],
        [8, 15],
        [-30, 0],
        [1440, 1425],
    ])("aligns the fallback with the resolver target for raw minute %i", (raw, snapped) => {
        const target = moveTarget({date: date(8), minute: raw})!;
        const result = accepted(
            resolveMove(event, moveAnchor(event, event.start, "all-day"), target, ({target, defaultResult}) => {
                expect(target.minute).toBe(snapped);
                expect(defaultResult.start).toEqual(target.time);
                return defaultResult;
            }),
        );
        expect(result.start).toEqual(new Date(2026, 9, 8, 0, snapped));
    });
    it("preserves an interior-day anchor and a consumer-defined multi-day timed range", () => {
        const anchor = moveAnchor(event, date(5), "all-day");
        const target = moveTarget({date: date(8), minute: 602})!;
        const result = accepted(
            resolveMove(event, anchor, target, ({event, anchor, target, conventions}) => {
                expect(conventions).toEqual({
                    allDayEnd: "inclusive",
                    timedEnd: "exclusive",
                    calendarDays: "local",
                    snapMinutes: 15,
                    nonexistentTime: "forward",
                    ambiguousTime: "earlier",
                });
                expect(anchor).toMatchObject({
                    dayOffset: 1,
                    offsetMilliseconds: 86400000,
                    lane: "all-day",
                    source: "grid",
                });
                expect(target).toMatchObject({lane: "timed", minute: 600, time: date(8, 10)});
                const start = addDays(target.time!, -anchor.dayOffset);
                return {
                    ...event,
                    allDay: false,
                    start,
                    end: addDays(start, differenceInCalendarDays(event.end, event.start)),
                };
            }),
        );
        expect(result.start).toEqual(date(7, 10));
        expect(result.end).toEqual(date(9, 10));
        expect([7, 8, 9, 10].map((day) => onDay(result, date(day)))).toEqual([true, true, true, false]);
        expect(result.project).toBe("host");
        expect(result.metadata).toBe(event.metadata);
    });

    it.each([date(6), date(6, 2)])("provides overnight defaults with exclusive midnight ends: %s", (end) => {
        const original = {...event, allDay: false, start: date(5, 22), end};
        const target = moveTarget({date: date(8), allDay: true})!;
        const resolve: EventMoveResolver<typeof original> = ({event, defaultResult, target}) => {
            expect(event.allDay).toBe(false);
            expect(target).toMatchObject({lane: "all-day", minute: null, time: null});
            return defaultResult;
        };
        const result = accepted(resolveMove(original, moveAnchor(original, date(5), "timed"), target, resolve));
        expect(result.start).toEqual(date(8));
        expect(onDay(result, date(9))).toBe(end.getHours() !== 0);
    });

    it("keeps a deadline point and its mixed-precision metadata, without normalizing instants", () => {
        const deadline = {...event, end: event.start, metadata: {endPrecision: "day", deadlineOnly: true}};
        const instant = new Date(date(8, 10).getTime() + 30123);
        const result = accepted(
            resolveMove(
                deadline,
                moveAnchor(deadline, deadline.start, "all-day"),
                moveTarget({date: date(8), minute: 600})!,
                ({event}) => ({...event, start: instant, end: instant, allDay: false}),
            ),
        );
        expect(result.start).toEqual(instant);
        expect(result.end).toEqual(instant);
        expect(result.start).not.toBe(instant);
        expect(result).not.toHaveProperty("taskStart");
        const [placement] = timedPlacements([result], date(8));
        expect(placement.height).toBe(16);
        expect(placement.segmentStart).toEqual(placement.segmentEnd);
        expect(result.metadata).toBe(deadline.metadata);
    });

    it("distinguishes Month movement from conversion and exposes continued popup segments", () => {
        const original = {...event, allDay: false, start: date(4, 22), end: date(6, 2)};
        expect(moveAnchor(original, date(5), "timed", "popup")).toMatchObject({
            dayOffset: 1,
            offsetMilliseconds: 7200000,
            segmentStart: date(5),
            source: "popup",
        });
        const target = moveTarget({date: date(8)})!;
        expect(target.lane).toBe("month");
        const result = accepted(resolveMove(original, moveAnchor(original, date(5), "month"), target));
        expect(result.allDay).toBe(false);
        expect(result.start).toEqual(date(7, 22));
    });

    it("protects input Date objects even when a resolver edits its date copies", () => {
        const originalStart = event.start.getTime();
        const target = moveTarget({date: date(8), minute: 600})!;
        const anchor = moveAnchor(event, date(5), "all-day");
        resolveMove(event, anchor, target, ({event, anchor, target, defaultResult}) => {
            event.start.setFullYear(2000);
            event.end.setFullYear(2000);
            anchor.date.setFullYear(2000);
            target.time!.setFullYear(2000);
            return defaultResult;
        });
        expect(event.start.getTime()).toBe(originalStart);
        expect(event.end.getFullYear()).toBe(2026);
        expect(anchor.date.getFullYear()).toBe(2026);
        expect(target.time!.getFullYear()).toBe(2026);
    });

    it.each([null, {...event, id: "other"}, {...event, start: new Date(NaN)}, {...event, end: date(3)}])(
        "rejects null and invalid results without changing identity",
        (candidate) => {
            expect(
                resolveMove(
                    event,
                    moveAnchor(event, date(4), "all-day"),
                    moveTarget({date: date(8)})!,
                    () => candidate,
                ),
            ).toEqual({status: "rejected", reason: null});
        },
    );

    it.runIf(new Date(2026, 2, 8).getTimezoneOffset() !== new Date(2026, 2, 8, 4).getTimezoneOffset())(
        "passes normalized spring targets and preserves a host's later fall-fold instant exactly",
        () => {
            const target = moveTarget({date: new Date(2026, 2, 8), minute: 150})!;
            expect(target.minute).toBe(150);
            expect(target.time!.getHours()).toBe(3);
            const fold = new Date("2026-11-01T01:30:00-05:00");
            const result = accepted(
                resolveMove(event, moveAnchor(event, date(4), "all-day"), target, ({event}) => ({
                    ...event,
                    start: fold,
                    end: fold,
                    allDay: false,
                })),
            );
            expect(result.start.toISOString()).toBe("2026-11-01T06:30:00.000Z");
            expect(result.end.getTime()).toBe(fold.getTime());
        },
    );
});
