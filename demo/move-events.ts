import {addDays, differenceInCalendarDays} from "date-fns";
import type {CalendarEvent, EventMoveResolver} from "../src/index";

/** Consumer policy fixtures used by browser acceptance, independent of library semantics. */
const moveEvents = (): CalendarEvent[] => [
    {
        id: "move-range",
        title: "Host range",
        allDay: true,
        start: new Date(2026, 9, 4),
        end: new Date(2026, 9, 6, 23, 59, 59, 999),
        metadata: {startPrecision: "day", endPrecision: "day"},
    },
    {
        id: "move-point",
        title: "Host deadline",
        allDay: true,
        start: new Date(2026, 9, 5),
        end: new Date(2026, 9, 5),
        metadata: {deadlineOnly: true, endPrecision: "day"},
    },
    {
        id: "move-night",
        title: "Host overnight",
        start: new Date(2026, 9, 4, 22),
        end: new Date(2026, 9, 6),
        metadata: {startPrecision: "time", endPrecision: "day"},
    },
];

const hostMoveResolver: EventMoveResolver = ({event, anchor, target, defaultResult}) => {
    if (target.lane !== "timed") return defaultResult;
    if (event.id === "move-point") return {...event, allDay: false, start: target.time!, end: target.time!};
    if (!event.allDay) return defaultResult;
    const start = addDays(target.time!, -anchor.dayOffset);
    const end = addDays(start, differenceInCalendarDays(event.end, event.start));
    end.setHours(end.getHours() + 1);
    return {...event, allDay: false, start, end};
};

const rejectMove: EventMoveResolver = () => null;
const reasonMove: EventMoveResolver = ({target, defaultResult}) =>
    target.lane === "timed" ? {reject: "Room is booked"} : defaultResult;
const pointMove: EventMoveResolver = ({event, anchor, target, defaultResult}) => ({
    ...event,
    allDay: false,
    start: target.time ?? defaultResult.start,
    end: target.time ?? defaultResult.start,
    metadata: {...(typeof event.metadata === "object" ? event.metadata : {}), pickup: anchor},
});
export {moveEvents, hostMoveResolver, rejectMove, pointMove, reasonMove};
