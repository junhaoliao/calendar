import {memo} from "react";
import {format, isSameDay, startOfWeek} from "date-fns";

import {cn} from "../../lib/utils";
import {useCalendarTranslation} from "../../i18n/translations";
import {CalendarDrop} from "./calendar-drop";
import {useCalendarActions, useCalendarConfig, useCalendarNow} from "./calendar-context";
import {daysFrom} from "../../core/dates";
import {HOUR_HEIGHT} from "../../core/timed-layout/placements";
import {EventItem, EventMovePreview} from "./event-item";
import {useMovePreview} from "./use-move-preview";
import {TimeColumn} from "./time-column";
import type {CalendarEvent} from "./types";
import {resizeSegments, weekSegments} from "../../core/month-lanes";
import {useCalendarResizeSelector} from "./calendar-resize-context";

/** Week/day header that subscribes directly to the current calendar time. */
const TimeHeader = ({
    days,
    view,
    dateLocale,
    weekdayPattern,
}: {
    days: Date[];
    view: "week" | "day";
    dateLocale: ReturnType<typeof useCalendarTranslation>["dateLocale"];
    weekdayPattern: string;
}) => {
    const now = useCalendarNow();
    const grid = view === "week" ? {gridTemplateColumns: `repeat(${days.length + 1}, minmax(0, 1fr))`} : {};

    return (
        <div
            className="calendar-time-grid sticky top-0 z-40 grid shrink-0 border-b border-border/70 bg-background/80 backdrop-blur-md"
            data-slot="time-header"
            style={grid}
        >
            <div className="truncate py-2 text-center text-sm text-muted-foreground/70">
                <span className="max-[479px]:sr-only">{format(now, "O", {locale: dateLocale})}</span>
            </div>
            {days.map((day) => (
                <div
                    className={cn(
                        "py-2 text-center text-sm text-muted-foreground/70",
                        isSameDay(day, now) && "font-medium text-foreground",
                    )}
                    key={day.getTime()}
                >
                    <span className="sm:hidden">
                        {format(day, "EEEEE", {locale: dateLocale})} {format(day, "d", {locale: dateLocale})}
                    </span>
                    <span className="max-sm:hidden">
                        {format(day, weekdayPattern, {
                            locale: dateLocale,
                        })}
                    </span>
                </div>
            ))}
        </div>
    );
};

/**
 * Shared week/day time grid; all scrolling stays inside the calendar surface.
 */
const TimeView = memo(({date, events, view}: {date: Date; events: readonly CalendarEvent[]; view: "week" | "day"}) => {
    const {tCalendar, dateLocale} = useCalendarTranslation();
    const {create} = useCalendarActions();
    const {readOnly} = useCalendarConfig();
    const days = view === "week" ? daysFrom(startOfWeek(date, {weekStartsOn: 0}), 7) : daysFrom(date, 1);
    const spanning = events.filter((event) => event.allDay);
    const movePreview = useMovePreview();
    const moveSegments = movePreview?.allDay
        ? weekSegments([...spanning.filter((event) => event.id !== movePreview.id), movePreview], days)
        : null;
    const segments = resizeSegments(
        spanning,
        days,
        useCalendarResizeSelector((session) => (session?.dateOnly ? session : null)),
    );
    const grid =
        view === "week"
            ? {
                  gridTemplateColumns: `repeat(${days.length + 1}, minmax(0, 1fr))`,
              }
            : {};

    return (
        <div className="flex min-h-0 flex-1 flex-col" data-slot={`${view}-view`}>
            <div className="min-h-0 flex-1 overflow-auto overscroll-contain" data-slot="calendar-scroll">
                <TimeHeader
                    dateLocale={dateLocale}
                    days={days}
                    view={view}
                    weekdayPattern={tCalendar(($) => $.formats.weekdayDay)}
                />
                <div
                    className="calendar-time-grid sticky top-9 z-30 grid max-h-40 shrink-0 overflow-y-auto overscroll-contain border-b border-border/70 bg-muted"
                    data-slot="all-day-band"
                    style={grid}
                >
                    <div className="relative flex flex-col justify-end border-r border-border/70">
                        <span
                            data-slot="all-day-label"
                            className="sticky bottom-0 h-6 shrink-0 bg-muted pr-2 text-right text-[10px] text-muted-foreground/70 sm:pr-4 sm:text-xs"
                        >
                            {tCalendar(($) => $.common.allDay)}
                        </span>
                    </div>
                    {days.map((day, index) => (
                        <CalendarDrop
                            allDay={true}
                            className="grid min-h-8 auto-rows-[28px] border-r border-border/70 p-1 last:border-r-0"
                            date={day}
                            disabled={readOnly}
                            id={`all-day:${day.getTime()}`}
                            style={
                                moveSegments
                                    ? {
                                          minHeight: Math.max(
                                              32,
                                              ...moveSegments[index].map((item) => (item.lane + 1) * 28 + 8),
                                          ),
                                      }
                                    : undefined
                            }
                            key={day.getTime()}
                            onCreate={create}
                        >
                            {moveSegments?.[index]
                                .filter((item) => item.event.id === movePreview?.id)
                                .map((item) => (
                                    <EventMovePreview
                                        key="move-preview"
                                        day={day}
                                        event={item.event}
                                        hasLabel={item.hasLabel}
                                        hostView={view}
                                        isFirst={item.isFirst}
                                        isLast={item.isLast}
                                        lane={item.lane}
                                        variant="bar"
                                    />
                                ))}
                            {segments[index].map((item) => (
                                <EventItem
                                    key={item.event.id}
                                    className="relative"
                                    day={day}
                                    event={item.event}
                                    hasLabel={item.hasLabel}
                                    hostView={view}
                                    isFirst={item.isFirst}
                                    isLast={item.isLast}
                                    lane={item.lane}
                                    variant="bar"
                                />
                            ))}
                        </CalendarDrop>
                    ))}
                </div>
                <div className="calendar-time-grid grid" style={grid}>
                    <div aria-hidden="true" className="border-r border-border/70">
                        {Array.from(
                            {
                                length: 24,
                            },
                            (_, hour) => (
                                <div
                                    className="relative border-b border-border/70 last:border-b-0"
                                    key={hour}
                                    style={{
                                        height: HOUR_HEIGHT,
                                    }}
                                >
                                    {hour > 0 && (
                                        <span className="absolute -top-3 right-0 flex h-6 w-16 max-w-full items-center justify-end bg-background pr-2 text-[10px] text-muted-foreground/70 sm:pr-4 sm:text-xs">
                                            {format(
                                                new Date(2000, 0, 1, hour),
                                                tCalendar(($) => $.formats.hourLabel),
                                                {locale: dateLocale},
                                            )}
                                        </span>
                                    )}
                                </div>
                            ),
                        )}
                    </div>
                    {days.map((day) => (
                        <TimeColumn events={events} day={day} key={day.getTime()} view={view} />
                    ))}
                </div>
            </div>
        </div>
    );
});
TimeView.displayName = "TimeView";

export {TimeView};
