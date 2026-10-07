import {addDays, differenceInCalendarDays, endOfDay, startOfDay} from "date-fns";
import {lastOccupiedDay} from "./dates";
import type {CalendarEvent} from "./types";

type ResizeEdge = "start" | "end";
const RESIZE_STEP_MINUTES = 15;
const MINIMUM_TIMED_DURATION = RESIZE_STEP_MINUTES * 60000;

/** Snap only the edited instant, retaining its timezone occurrence across DST. */
const snapResizeTime = (date: Date, direction: "round" | "floor" | "ceil" = "round") => {
    const minutes = date.getMinutes() + date.getSeconds() / 60 + date.getMilliseconds() / 60000;
    const snapped = Math[direction](minutes / RESIZE_STEP_MINUTES) * RESIZE_STEP_MINUTES;
    return new Date(date.getTime() + (snapped - minutes) * 60000);
};

/** Adjust one endpoint without moving, converting or mutating the original event. */
const resizeEvent = <T extends CalendarEvent>(event: T, edge: ResizeEdge, target: Date, dateOnly = false): T => {
    let next: Date;
    if (event.allDay) {
        next =
            edge === "start"
                ? startOfDay(target > startOfDay(event.end) ? event.end : target)
                : endOfDay(target < startOfDay(event.start) ? event.start : target);
    } else if (dateOnly) {
        const original = edge === "end" ? lastOccupiedDay(event) : event.start;
        next = addDays(event[edge], differenceInCalendarDays(target, original));
        // Date-only changes retain the endpoint's original clock time.
        if (edge === "start") {
            while (next.getTime() > event.end.getTime() - MINIMUM_TIMED_DURATION) next = addDays(next, -1);
        } else {
            while (next.getTime() < event.start.getTime() + MINIMUM_TIMED_DURATION) next = addDays(next, 1);
        }
    } else {
        next = snapResizeTime(target);
        if (edge === "start" && next.getTime() > event.end.getTime() - MINIMUM_TIMED_DURATION) {
            next = snapResizeTime(new Date(event.end.getTime() - MINIMUM_TIMED_DURATION), "floor");
        }
        if (edge === "end" && next.getTime() < event.start.getTime() + MINIMUM_TIMED_DURATION) {
            next = snapResizeTime(new Date(event.start.getTime() + MINIMUM_TIMED_DURATION), "ceil");
        }
    }
    return {...event, [edge]: next};
};

export {resizeEvent, snapResizeTime, RESIZE_STEP_MINUTES};
export type {ResizeEdge};
