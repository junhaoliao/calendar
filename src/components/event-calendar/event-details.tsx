import {displayTitle} from "./event-display";
import {format, isSameDay} from "date-fns";
import type {Locale} from "date-fns";

import {useCalendarTranslation} from "../../i18n/translations";
import type {CalendarEvent} from "./types";

interface EventDetailOptions {
    locale: Locale;
    allDayLabel: string;
    allDayRange: (start: string, end: string) => string;
    patterns: {day: string; time: string; dateTime: string};
}

/**
 * Formats complete ranges without repeating dates within a single day.
 *
 * @param event Original consumer event.
 * @return Human-readable complete range.
 */
const eventDetailRange = (event: CalendarEvent, options: EventDetailOptions) => {
    const {locale, patterns} = options;
    if (event.allDay) {
        if (isSameDay(event.start, event.end)) return options.allDayLabel;
        const start = format(event.start, patterns.day, {locale});
        const end = format(event.end, patterns.day, {locale});
        return options.allDayRange(start, end);
    }
    const pattern = isSameDay(event.start, event.end) ? patterns.time : patterns.dateTime;

    return `${format(event.start, pattern, {locale})} – ${format(event.end, pattern, {locale})}`;
};

/**
 * Full titles and ranges for a draggable popover row.
 *
 * @param props The original event.
 * @return Readable details with a semantic color dot.
 */
const EventDetails = ({event}: {event: CalendarEvent}) => {
    const {tCalendar, dateLocale} = useCalendarTranslation();
    const shownTitle = displayTitle(event.title, tCalendar);
    const range = eventDetailRange(event, {
        locale: dateLocale,
        allDayLabel: tCalendar(($) => $.common.allDay),
        allDayRange: (start, end) => tCalendar(($) => $.event.allDayRange, {start, end}),
        patterns: {
            day: tCalendar(($) => $.formats.detailDay),
            time: tCalendar(($) => $.formats.detailTime),
            dateTime: tCalendar(($) => $.formats.detailDateTime),
        },
    });
    return (
        <>
            <span aria-hidden={true} className="size-3 shrink-0 rounded-full bg-(--event-dot)" />
            <span className="flex min-w-0 flex-col gap-1">
                <span className="break-words">{shownTitle}</span>
                <span className="text-xs font-normal text-muted-foreground">{range}</span>
            </span>
        </>
    );
};

export {eventDetailRange, EventDetails};
