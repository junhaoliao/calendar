import type {
    CalendarEvent,
    CalendarView,
    NewCalendarEvent,
    EventMoveResolver,
    EventMoveRejected,
} from "../../core/types";
import type {CSSProperties, ReactNode} from "react";
import type {CalendarLocale} from "../../i18n/locales";

/** Internal editor state: creating a new event or editing an existing one. */
type EventDraft = {mode: "create"; event: NewCalendarEvent} | {mode: "edit"; event: CalendarEvent};

type CalendarNotificationAction = "added" | "updated" | "deleted" | "moved" | "resized";

/** A completed mutation request. Added events have no id yet. */
type CalendarNotification<TEvent extends CalendarEvent = CalendarEvent> =
    {action: "added"; event: NewCalendarEvent} | {action: Exclude<CalendarNotificationAction, "added">; event: TEvent};

interface CalendarSlot {
    start: Date;
    end: Date;
    allDay: boolean;
}

interface EventCalendarProps<TEvent extends CalendarEvent = CalendarEvent> {
    events: readonly TEvent[];
    /** New event without id; assign an id and any required host fields here. */
    onEventAdd?: (event: NewCalendarEvent) => void;
    onEventUpdate?: (event: TEvent) => void;
    onEventDelete?: (id: string) => void;
    onEventClick?: (event: TEvent) => void;
    onSlotClick?: (slot: CalendarSlot) => void;
    onDateChange?: (date: Date) => void;
    onViewChange?: (view: CalendarView) => void;
    onNotification?: (notification: CalendarNotification<TEvent>) => void;
    /** One refused drop; no mutation or success notification accompanies it. */
    onMoveRejected?: (rejection: EventMoveRejected<TEvent>) => void;
    date?: Date;
    view?: CalendarView;
    initialDate?: Date;
    initialView?: CalendarView;
    now?: Date;
    readOnly?: boolean;
    className?: string;
    /** UI language for built-in labels. Default: "en". */
    locale?: CalendarLocale;
    /** Omit to follow the nearest .dark/.light ancestor, including live changes. */
    theme?: "light" | "dark";
    /** Root layout and CSS variables; only variables carry to portals/feedback. */
    style?: CSSProperties;

    /** Positive minute duration for all-day to timed conversion. Default: 60. */
    defaultTimedDurationMinutes?: number;
    /** Pure synchronous policy shared by preview and completion; null/{reject} refuses. */
    resolveEventMove?: EventMoveResolver<TEvent>;

    /**
     * Preferred minimum lane width in CSS pixels; at least one lane stays visible.
     * Default: 90.
     */
    minimumTimedEventWidth?: number;

    /** Replaces the shared event label while retaining interaction and geometry. */
    renderEvent?: (event: TEvent, view: CalendarView) => ReactNode;
}

export {
    type CalendarSlot,
    type CalendarNotification,
    type CalendarNotificationAction,
    type EventDraft,
    type EventCalendarProps,
};

export type {
    CalendarView,
    EventColor,
    CalendarEvent,
    NewCalendarEvent,
    DropData,
    EventSegment,
    TimedPlacement,
    EventMoveLane,
    EventMoveAnchor,
    EventMoveTarget,
    EventMoveContext,
    EventMoveResolver,
    EventMoveConventions,
    EventMoveRejection,
    EventMoveRejected,
} from "../../core/types";
