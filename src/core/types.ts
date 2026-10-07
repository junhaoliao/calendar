type CalendarView = "month" | "week" | "day" | "agenda";

type EventColor = "sky" | "amber" | "violet" | "rose" | "emerald" | "orange";

interface CalendarEvent<TMetadata = unknown> {
    id: string;
    title: string;
    start: Date;
    end: Date;
    allDay?: boolean;
    color?: EventColor;
    description?: string;
    location?: string;
    /** Consumer-owned data, retained by reference through edits and moves. */
    metadata?: TMetadata;
}

/** A newly created event. The host assigns its id in onEventAdd. */
type NewCalendarEvent = Omit<CalendarEvent, "id">;

interface DropData {
    date: Date;
    minute?: number;
    allDay?: boolean;
    lane?: EventMoveLane;
}

/** Month cells move dates without implying an all-day conversion. */
type EventMoveLane = "month" | "all-day" | "timed";

interface EventMoveAnchor {
    /** Local date of the grabbed day/continued segment. */
    date: Date;
    /** Logical start of that segment, not the pointer's position. */
    segmentStart: Date;
    dayOffset: number;
    offsetMilliseconds: number;
    lane: EventMoveLane;
    source: "grid" | "popup";
}

interface EventMoveTarget {
    lane: EventMoveLane;
    date: Date;
    /** Snapped wall-clock minute, null for date-only destinations. */
    minute: number | null;
    /** Actual local instant after DST normalization, null for date-only targets. */
    time: Date | null;
}

interface EventMoveContext<TEvent extends CalendarEvent = CalendarEvent> {
    /** Unconverted event, including current consumer fields. */
    event: TEvent;
    anchor: EventMoveAnchor;
    target: EventMoveTarget;
    defaultResult: TEvent;
    /** Built-in date/time contract. Resolver output is never snapped again. */
    conventions: EventMoveConventions;
}

interface EventMoveConventions {
    readonly allDayEnd: "inclusive";
    readonly timedEnd: "exclusive";
    readonly calendarDays: "local";
    readonly snapMinutes: number;
    readonly nonexistentTime: "forward";
    readonly ambiguousTime: "earlier";
}

/** Host-localized rejection text. An event with an id remains an event. */
interface EventMoveRejection {
    reject: string;
    id?: never;
}

/** Completion feedback for a rejected drop; the event's schedule is unchanged. */
interface EventMoveRejected<TEvent extends CalendarEvent = CalendarEvent> {
    event: TEvent;
    reason: string | null;
}

/** Pure synchronous resolution; null or {reject} rejects. Returned dates are exact. */
type EventMoveResolver<TEvent extends CalendarEvent = CalendarEvent> = (
    context: EventMoveContext<TEvent>,
) => TEvent | EventMoveRejection | null;

interface EventSegment {
    event: CalendarEvent;
    lane: number;
    isFirst: boolean;
    isLast: boolean;
    hasLabel: boolean;
}

interface TimedPlacement {
    event: CalendarEvent;
    top: number;
    height: number;
    left: number;
    width: number;
    lane: number;
    segmentStart: Date;
    segmentEnd: Date;
    continuesBefore: boolean;
    continuesAfter: boolean;
}

export type {CalendarView, EventColor, CalendarEvent, NewCalendarEvent, DropData, EventSegment, TimedPlacement};
export type {
    EventMoveLane,
    EventMoveAnchor,
    EventMoveTarget,
    EventMoveContext,
    EventMoveResolver,
    EventMoveConventions,
    EventMoveRejection,
    EventMoveRejected,
};
