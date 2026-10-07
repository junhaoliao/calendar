import {lastOccupiedDay} from "./dates";
import {addDays, differenceInCalendarDays, endOfDay, startOfDay} from "date-fns";

import type {CalendarEvent, DropData, EventMoveAnchor, EventMoveTarget, EventMoveResolver} from "./types";

const DEFAULT_TIMED_DURATION_MINUTES = 60;
const SNAP_MINUTES = 15;
const LAST_SLOT_MINUTE = 24 * 60 - SNAP_MINUTES;

/** Snaps a wall-clock minute into the day's available quarter-hour slots. */
const snapMinute = (minute: number): number =>
    Math.max(0, Math.min(LAST_SLOT_MINUTE, Math.round(minute / SNAP_MINUTES) * SNAP_MINUTES));

/** null from the controller means inapplicable, distinct from this refusal. */
type MoveResolution<T extends CalendarEvent> =
    {status: "accepted"; event: T} | {status: "rejected"; reason: string | null};

/**
 * Normalizes the public conversion duration to a positive finite minute count.
 *
 * @param minutes Consumer configuration.
 * @return A usable duration in minutes.
 */
const timedConversionDuration = (minutes: number): number => {
    if (!Number.isFinite(minutes) || minutes <= 0) {
        return DEFAULT_TIMED_DURATION_MINUTES;
    }

    return minutes;
};

/**
 * Applies type conversion or whole-event movement without mutating metadata.
 *
 * @param event The original consumer event.
 * @param anchor The date of the grabbed segment.
 * @param target The destination date and type.
 * @param defaultDurationMinutes Duration for all-day to timed conversion.
 * @return One updated event with its original id and custom properties.
 */
const moveEvent = <T extends CalendarEvent>(
    event: T,
    anchor: Date,
    target: DropData,
    defaultDurationMinutes = DEFAULT_TIMED_DURATION_MINUTES,
): T => {
    const shift = differenceInCalendarDays(target.date, anchor);
    if (target.allDay) {
        if (event.allDay) {
            return {...event, start: addDays(event.start, shift), end: addDays(event.end, shift)};
        }
        const occupiedDates = differenceInCalendarDays(lastOccupiedDay(event), event.start) + 1;
        const count = Math.max(1, occupiedDates);
        const start = addDays(startOfDay(event.start), shift);
        return {...event, allDay: true, start: start, end: endOfDay(addDays(start, count - 1))};
    }
    if (typeof target.minute !== "undefined") {
        const dropped = startOfDay(target.date);
        dropped.setMinutes(snapMinute(target.minute));
        if (event.allDay) {
            const duration = timedConversionDuration(defaultDurationMinutes) * 60000;
            return {...event, allDay: false, start: dropped, end: new Date(dropped.getTime() + duration)};
        }
        const segmentStart = Math.max(event.start.getTime(), startOfDay(anchor).getTime());
        const start = new Date(dropped.getTime() - (segmentStart - event.start.getTime()));
        return {...event, start: start, end: new Date(start.getTime() + event.end.getTime() - event.start.getTime())};
    }
    const start = addDays(event.start, shift);
    const end = event.allDay
        ? addDays(event.end, shift)
        : new Date(start.getTime() + event.end.getTime() - event.start.getTime());

    return {...event, start, end};
};

/**
 * Detects a completed move or conversion while ignoring unchanged consumer metadata.
 *
 * @param before Original event.
 * @param after Candidate update.
 * @return Whether a mutation callback is needed.
 */
const eventDatesChanged = (before: CalendarEvent, after: CalendarEvent): boolean =>
    Boolean(before.allDay) !== Boolean(after.allDay) ||
    before.start.getTime() !== after.start.getTime() ||
    before.end.getTime() !== after.end.getTime();

export {DEFAULT_TIMED_DURATION_MINUTES, eventDatesChanged, moveEvent, timedConversionDuration};

/** Clone schedule objects without copying or interpreting consumer-owned data. */
const copyEvent = <T extends CalendarEvent>(event: T): T => ({
    ...event,
    start: new Date(event.start),
    end: new Date(event.end),
});

const moveAnchor = (
    event: CalendarEvent,
    date: Date,
    lane: EventMoveAnchor["lane"],
    source: EventMoveAnchor["source"] = "grid",
): EventMoveAnchor => {
    const segmentStart = new Date(Math.max(event.start.getTime(), startOfDay(date).getTime()));
    return {
        date: startOfDay(date),
        segmentStart,
        dayOffset: differenceInCalendarDays(date, event.start),
        offsetMilliseconds: segmentStart.getTime() - event.start.getTime(),
        lane,
        source,
    };
};

const moveTarget = (data: DropData): EventMoveTarget | null => {
    if (!(data.date instanceof Date) || !Number.isFinite(data.date.getTime())) return null;
    const lane = data.lane ?? (data.allDay ? "all-day" : data.minute === undefined ? "month" : "timed");
    if (lane === "timed" && !Number.isFinite(data.minute)) return null;
    const minute = lane === "timed" ? snapMinute(data.minute!) : null;
    const date = startOfDay(data.date);
    const time = minute === null ? null : startOfDay(date);
    time?.setMinutes(minute!);
    return {lane, date, minute, time};
};

/** Shared preview/commit pipeline. No normalization occurs after host resolution. */
const resolveMove = <T extends CalendarEvent>(
    event: T,
    anchor: EventMoveAnchor,
    target: EventMoveTarget,
    resolver?: EventMoveResolver<T>,
    duration = DEFAULT_TIMED_DURATION_MINUTES,
): MoveResolution<T> => {
    const fallback = moveEvent(
        copyEvent(event),
        anchor.date,
        {date: target.date, allDay: target.lane === "all-day", minute: target.minute ?? undefined},
        duration,
    );
    let candidate: ReturnType<EventMoveResolver<T>> = fallback;
    if (resolver) {
        try {
            candidate = resolver({
                event: copyEvent(event),
                anchor: {...anchor, date: new Date(anchor.date), segmentStart: new Date(anchor.segmentStart)},
                target: {...target, date: new Date(target.date), time: target.time ? new Date(target.time) : null},
                defaultResult: fallback,
                conventions: {
                    allDayEnd: "inclusive",
                    timedEnd: "exclusive",
                    calendarDays: "local",
                    snapMinutes: SNAP_MINUTES,
                    nonexistentTime: "forward",
                    ambiguousTime: "earlier",
                },
            });
        } catch (error) {
            // Cached by the controller: preview and drop report one failed resolution.
            console.error("resolveEventMove threw; the move was rejected.", error);
            return {status: "rejected", reason: null};
        }
    }
    if (
        candidate &&
        typeof candidate === "object" &&
        !Object.hasOwn(candidate, "id") &&
        "reject" in candidate &&
        typeof candidate.reject === "string"
    ) {
        return {status: "rejected", reason: candidate.reject.trim() || null};
    }
    // Invalid results reject just like null; identity is never replaced.
    if (
        !candidate ||
        candidate.id !== event.id ||
        !("start" in candidate) ||
        !(candidate.start instanceof Date) ||
        !("end" in candidate) ||
        !(candidate.end instanceof Date) ||
        !Number.isFinite(candidate.start.getTime()) ||
        !Number.isFinite(candidate.end.getTime()) ||
        candidate.end < candidate.start ||
        ("allDay" in candidate && candidate.allDay !== undefined && typeof candidate.allDay !== "boolean")
    )
        return {status: "rejected", reason: null};
    return {status: "accepted", event: copyEvent(candidate as T)};
};

export {copyEvent, moveAnchor, moveTarget, resolveMove, snapMinute};
export type {MoveResolution};
