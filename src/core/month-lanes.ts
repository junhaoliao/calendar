import {isSameDay} from "date-fns";
import {isSpanning, onDay, lastOccupiedDay} from "./dates";
import type {CalendarEvent, EventSegment} from "./types";

/**
 * Assigns spanning events a consistent lane across a whole week.
 */
const weekSegments = (events: readonly CalendarEvent[], days: Date[]): EventSegment[][] => {
    const result: EventSegment[][] = days.map(() => []);
    const candidates = events
        .filter((event) => days.some((day) => onDay(event, day)))
        .sort((a, b) => Number(isSpanning(b)) - Number(isSpanning(a)) || a.start.getTime() - b.start.getTime());

    for (const event of candidates) {
        const indexes = days.map((day, index) => (onDay(event, day) ? index : -1)).filter((index) => index >= 0);
        let lane = 0;
        let occupied = true;
        while (occupied) {
            occupied = false;
            for (const index of indexes) {
                for (const segment of result[index]) {
                    occupied ||= segment.lane === lane;
                }
            }
            if (occupied) {
                lane++;
            }
        }
        for (const index of indexes) {
            result[index].push({
                event: event,
                hasLabel: index === indexes[0],
                isFirst: isSameDay(days[index], event.start),
                isLast: isSameDay(days[index], lastOccupiedDay(event)),
                lane: lane,
            });
        }
    }

    return result;
};

/** Date previews retain original lanes until commit, while exposing new dates. */
export function resizeSegments(
    events: readonly CalendarEvent[],
    days: Date[],
    session:
        | {
              original: CalendarEvent;
              event: CalendarEvent;
              dateOnly: boolean;
              lane: number;
          }
        | null
        | undefined,
) {
    const original = weekSegments(events, days);
    if (!session?.dateOnly) return original;
    const preview = weekSegments([session.event], days);
    return original.map((items, index) => [
        ...items.filter((item) => item.event.id !== session.original.id),
        ...preview[index].map((item) => ({
            ...item,
            lane: items.find((other) => other.event.id === item.event.id)?.lane ?? session.lane,
        })),
    ]);
}

export {weekSegments};
