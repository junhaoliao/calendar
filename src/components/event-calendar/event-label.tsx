import {displayTitle} from "./event-display";
import {isSameDay} from "date-fns";

import {cn} from "../../lib/utils";
import {useCalendarTranslation} from "../../i18n/translations";
import {eventTime} from "../../core/dates";
import {EventDetails} from "./event-details";
import type {CalendarEvent, CalendarView, EventCalendarProps} from "./types";

interface EventLabelProps {
    event: CalendarEvent;
    labelView: CalendarView;
    renderView: CalendarView;
    isDragging: boolean;
    hasLabel: boolean;
    hasTime: boolean;
    segmentStart: Date;
    segmentEnd: Date;
    isResizing: boolean;
    details: boolean;
    renderEvent?: EventCalendarProps["renderEvent"];
}

/**
 * Renders shared event details without coupling labels to drag lifecycle.
 *
 * @param props Presentation data.
 * @return The event label for the requested view.
 */
const StandardEventLabel = (props: EventLabelProps) => {
    const {tCalendar, dateLocale} = useCalendarTranslation();
    const {event, labelView, hasLabel, hasTime, segmentStart = event.start, segmentEnd = event.end, isDragging} = props;
    const shownTitle = displayTitle(event.title, tCalendar);

    const time = `${eventTime(event.start, dateLocale)} - ${eventTime(event.end, dateLocale)}`;
    if (labelView === "agenda") {
        return (
            <>
                <div className="text-sm font-medium">{shownTitle}</div>
                <div className="text-xs opacity-70">
                    <span className={cn(!event.allDay && "uppercase")}>
                        {event.allDay ? tCalendar(($) => $.common.allDay) : time}
                    </span>
                    {event.location && (
                        <>
                            <span className="px-1 opacity-35"> · </span>
                            <span>{event.location}</span>
                        </>
                    )}
                </div>
                {event.description && <div className="my-1 text-xs opacity-90">{event.description}</div>}
            </>
        );
    }
    if (labelView === "month") {
        return (
            <span aria-hidden={!hasLabel} className={cn("truncate", !hasLabel && "invisible")}>
                {hasTime && !event.allDay && (
                    <span className="font-normal opacity-70">{eventTime(event.start, dateLocale)} </span>
                )}
                {shownTitle}
            </span>
        );
    }
    const duration = (segmentEnd.getTime() - segmentStart.getTime()) / 60000;
    const ending =
        isDragging || isSameDay(segmentStart, segmentEnd)
            ? eventTime(segmentEnd, dateLocale)
            : tCalendar(($) => $.event.midnight);
    const segmentTime = `${eventTime(segmentStart, dateLocale)} - ${ending}`;

    if (duration < 45) {
        return (
            <span className="truncate">
                {shownTitle}{" "}
                <span className="font-normal opacity-70">
                    {props.isResizing ? segmentTime : eventTime(segmentStart, dateLocale)}
                </span>
            </span>
        );
    }

    return (
        <>
            <div className="truncate font-medium">{shownTitle}</div>
            <div className="truncate font-normal opacity-70">
                {event.allDay ? tCalendar(($) => $.common.allDay) : segmentTime}
            </div>
        </>
    );
};

/**
 * Selects consumer, full-detail or shared calendar labels independently of sensors.
 *
 * @param props Event presentation options.
 * @return The event's label content.
 */
const EventLabel = (props: EventLabelProps) => {
    const {event, renderView, renderEvent, details, isDragging} = props;
    if (renderEvent) {
        return renderEvent(event, renderView);
    }
    if (details && !isDragging) {
        return <EventDetails event={event} />;
    }

    return <StandardEventLabel {...props} />;
};

export {type EventLabelProps, EventLabel};
