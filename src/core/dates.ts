import {
    addDays,
    addMonths,
    differenceInCalendarDays,
    endOfMonth,
    format,
    isSameDay,
    isSameMonth,
    startOfDay,
    startOfWeek,
} from "date-fns";
import type {Locale} from "date-fns";
import {enUS} from "date-fns/locale/en-US";
import type {CalendarEvent, CalendarView} from "./types";

/**
 * Finds the final occupied date; timed ranges exclude a terminal midnight.
 *
 * @param event The original event.
 * @return The final occupied local date.
 */
const lastOccupiedDay = <T extends Pick<CalendarEvent, "start" | "end" | "allDay">>(event: T): Date =>
    startOfDay(!event.allDay && event.end > event.start ? new Date(event.end.getTime() - 1) : event.end);

const EVENT_COLORS = ["sky", "amber", "violet", "rose", "emerald", "orange"] as const;
const VIEWS: CalendarView[] = ["month", "week", "day", "agenda"];

/**
 * Returns an immutable local date at the requested minute of day.
 */
const atMinute = (date: Date, minute: number): Date => {
    const result = new Date(date);
    result.setHours(0, minute, 0, 0);

    return result;
};

/**
 * Formats compact twelve-hour event time.
 */
const eventTime = (date: Date, locale: Locale = enUS): string => {
    if (!locale.code?.startsWith("en")) return format(date, "p", {locale});
    return format(date, date.getMinutes() === 0 ? "ha" : "h:mma", {locale}).toLowerCase();
};

/**
 * Detects calendar-day spanning, including different months and years.
 */
const isSpanning = (event: CalendarEvent): boolean => {
    return Boolean(event.allDay) || !isSameDay(event.start, lastOccupiedDay(event));
};

/**
 * Occupied calendar-date membership, including zero-duration events.
 */
const onDay = (event: CalendarEvent, day: Date): boolean => {
    const stamp = startOfDay(day).getTime();
    return startOfDay(event.start).getTime() <= stamp && lastOccupiedDay(event).getTime() >= stamp;
};

/**
 * Returns date members with spanning events first and stable chronological ordering.
 */
const eventsOnDay = (events: readonly CalendarEvent[], day: Date): CalendarEvent[] => {
    return events
        .filter((event) => onDay(event, day))
        .sort((a, b) => Number(isSpanning(b)) - Number(isSpanning(a)) || a.start.getTime() - b.start.getTime());
};

/**
 * Returns consecutive local dates without assuming a day is 24 elapsed hours.
 */
const daysFrom = (date: Date, count: number): Date[] => {
    return Array.from(
        {
            length: count,
        },
        (_, index) => addDays(startOfDay(date), index),
    );
};

/**
 * Returns only the complete weeks intersecting the selected month.
 */
const monthDays = (date: Date): Date[] => {
    const first = startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1), {weekStartsOn: 0});
    const last = addDays(startOfWeek(endOfMonth(date), {weekStartsOn: 0}), 6);
    return daysFrom(first, differenceInCalendarDays(last, first) + 1);
};

/**
 * Navigates by the visible range and clamps end-of-month dates.
 */
const navigateDate = (date: Date, view: CalendarView, direction: number): Date => {
    if (view === "month") {
        return addMonths(date, direction);
    }
    const steps = {
        agenda: 30,
        day: 1,
        week: 7,
    };

    return addDays(date, direction * steps[view]);
};

/**
 * Formats calendar toolbar headings, including cross-month ranges.
 */
interface HeadingPatterns {
    monthYear?: string;
    dayHeading?: string;
    weekStart?: string;
    weekEnd?: string;
}

interface HeadingOptions {
    locale?: Locale;
    patterns?: HeadingPatterns;
}

const calendarHeading = (date: Date, view: CalendarView, options: HeadingOptions = {}): string => {
    const locale = options.locale ?? enUS;
    const patterns = options.patterns;
    if (view === "day") {
        return format(date, patterns?.dayHeading ?? "EEE MMMM d, yyyy", {locale});
    }
    if (view === "month" || view === "agenda") {
        return format(date, patterns?.monthYear ?? "MMMM yyyy", {locale});
    }
    const start = startOfWeek(date, {weekStartsOn: 0});
    const end = addDays(start, 6);

    return isSameMonth(start, end)
        ? format(start, patterns?.monthYear ?? "MMMM yyyy", {locale})
        : `${format(start, patterns?.weekStart ?? "MMM", {locale})} - ${format(end, patterns?.weekEnd ?? "MMM yyyy", {locale})}`;
};

export {
    lastOccupiedDay,
    EVENT_COLORS,
    VIEWS,
    atMinute,
    eventTime,
    isSpanning,
    onDay,
    eventsOnDay,
    daysFrom,
    monthDays,
    navigateDate,
    calendarHeading,
};
export type {HeadingOptions, HeadingPatterns};
