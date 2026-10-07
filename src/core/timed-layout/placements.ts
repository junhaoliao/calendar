import {addDays, startOfDay} from "date-fns";
import {eventsOnDay} from "../dates";
import {placeTimedLanes} from "./lanes";
import type {CalendarEvent, TimedPlacement} from "../types";

const HOUR_HEIGHT = 64;

/**
 * Clips timed events into day segments and contains overlapping event stacks.
 */
const timedPlacements = (events: readonly CalendarEvent[], day: Date): TimedPlacement[] => {
    const timed = eventsOnDay(events, day)
        .filter((event) => !event.allDay)
        .sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());

    return placeTimedLanes(
        timed.map((event) => {
            const dayStart = startOfDay(day);
            const dayEnd = addDays(dayStart, 1);
            const segmentStart = new Date(Math.max(event.start.getTime(), dayStart.getTime()));
            const segmentEnd = new Date(Math.min(event.end.getTime(), dayEnd.getTime()));
            const start = segmentStart.getHours() * 60 + segmentStart.getMinutes();
            const end =
                segmentEnd.getTime() === dayEnd.getTime() ? 1440 : segmentEnd.getHours() * 60 + segmentEnd.getMinutes();

            // The fixed wall-clock grid maps a repeated fall-back hour to the same rows.
            const wallDuration = end - start;
            const minutes = wallDuration > 0 ? wallDuration : (segmentEnd.getTime() - segmentStart.getTime()) / 60000;

            return {
                continuesAfter: event.end > dayEnd,
                continuesBefore: event.start < dayStart,
                event: event,
                height: Math.max(16, (minutes / 60) * HOUR_HEIGHT),
                lane: 0,
                left: 0,
                segmentEnd: segmentEnd,
                segmentStart: segmentStart,
                top: (start / 60) * HOUR_HEIGHT,
                width: 100,
            };
        }),
    );
};

export {HOUR_HEIGHT, timedPlacements};
