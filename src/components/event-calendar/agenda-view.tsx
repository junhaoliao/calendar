import {memo} from "react";
import {format} from "date-fns";
import {CalendarIcon} from "lucide-react";
import {useCalendarTranslation} from "../../i18n/translations";

import {Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle} from "../ui/empty";
import {daysFrom, eventsOnDay} from "../../core/dates";
import {EventItem} from "./event-item";
import type {CalendarEvent} from "./types";

interface AgendaProps {
    date: Date;
    events: readonly CalendarEvent[];
}

/**
 * Thirty-day agenda grouped by nonempty local calendar dates.
 */
const AgendaView = memo(({date, events}: AgendaProps) => {
    const {tCalendar, dateLocale} = useCalendarTranslation();
    const groups = daysFrom(date, 30)
        .map((day) => ({
            day: day,
            events: eventsOnDay(events, day).sort((a, b) => a.start.getTime() - b.start.getTime()),
        }))
        .filter((group) => group.events.length > 0);

    return (
        <div
            className="min-h-0 flex-1 overflow-auto overscroll-contain border-t border-border/70 px-4"
            data-slot="calendar-scroll"
        >
            {groups.length === 0 ? (
                <Empty className="h-full py-16">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <CalendarIcon />
                        </EmptyMedia>
                        <EmptyTitle>{tCalendar(($) => $.agenda.empty.title)}</EmptyTitle>
                        <EmptyDescription>{tCalendar(($) => $.agenda.empty.description)}</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                groups.map((group) => (
                    <div className="relative my-12 border-t border-border/70" key={group.day.getTime()}>
                        <span className="absolute -top-3 left-0 flex h-6 items-center bg-background pr-4 text-[10px] uppercase sm:text-xs">
                            {format(
                                group.day,
                                tCalendar(($) => $.formats.agendaDay),
                                {
                                    locale: dateLocale,
                                },
                            )}
                        </span>
                        <div className="mt-6 flex flex-col gap-2">
                            {group.events.map((event) => (
                                <EventItem day={group.day} event={event} key={event.id} variant="agenda" />
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
});
AgendaView.displayName = "AgendaView";

export {AgendaView};
