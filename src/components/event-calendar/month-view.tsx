import {memo, useEffect, useRef, useState} from "react";
import {format} from "date-fns";

import {useCalendarTranslation} from "../../i18n/translations";
import {monthDays} from "../../core/dates";
import type {CalendarEvent} from "./types";
import {MonthCell} from "./month-cell";
import {resizeSegments, weekSegments} from "../../core/month-lanes";
import {useMovePreview} from "./use-move-preview";
import {useCalendarResizeSelector} from "./calendar-resize-context";

/**
 * Responsive month rows with aligned multi-day lanes and a complete overflow list.
 */
const MonthView = memo(({date, events}: {date: Date; events: readonly CalendarEvent[]}) => {
    const {dateLocale} = useCalendarTranslation();
    const resizeSession = useCalendarResizeSelector((session) => (session?.dateOnly ? session : null));
    const days = monthDays(date);
    const movePreview = useMovePreview();
    const firstDayKey = days[0].getTime();
    const rowRef = useRef<HTMLDivElement>(null);
    const [capacity, setCapacity] = useState(4);
    useEffect(() => {
        const row = rowRef.current;
        if (!row) {
            return () => {
                // No mounted row to observe.
            };
        }
        const measure = () => {
            setCapacity(Math.max(1, Math.floor((row.getBoundingClientRect().height - 34) / 28)));
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(row);

        return () => {
            observer.disconnect();
        };
    }, [firstDayKey]);

    return (
        <div className="flex min-h-0 flex-1 flex-col" data-slot="month-view">
            <div className="grid shrink-0 grid-cols-7 border-b border-border/70">
                {days.slice(0, 7).map((day) => (
                    <div className="py-2 text-center text-sm text-muted-foreground/70" key={day.getTime()}>
                        {format(day, "EEE", {locale: dateLocale})}
                    </div>
                ))}
            </div>
            <div className="min-h-0 flex-1 overflow-auto overscroll-contain" data-slot="calendar-scroll">
                <div
                    className="grid min-h-full auto-rows-fr"
                    style={{
                        gridTemplateRows: `repeat(${days.length / 7}, minmax(128px, 1fr))`,
                    }}
                >
                    {Array.from(
                        {
                            length: days.length / 7,
                        },
                        (_, week) => {
                            const weekDays = days.slice(week * 7, week * 7 + 7);
                            const segments = resizeSegments(events, weekDays, resizeSession);
                            const previews = movePreview
                                ? weekSegments(
                                      [...events.filter((event) => event.id !== movePreview.id), movePreview],
                                      weekDays,
                                  )
                                : null;
                            return (
                                <div
                                    className="grid grid-cols-7 [&:last-child>*]:border-b-0"
                                    key={weekDays[0].getTime()}
                                    ref={week === 0 ? rowRef : null}
                                >
                                    {weekDays.map((day, index) => {
                                        return (
                                            <MonthCell
                                                capacity={capacity}
                                                date={date}
                                                day={day}
                                                items={segments[index]}
                                                movePreview={previews?.[index].find(
                                                    (item) => item.event.id === movePreview?.id,
                                                )}
                                                key={day.getTime()}
                                            />
                                        );
                                    })}
                                </div>
                            );
                        },
                    )}
                </div>
            </div>
        </div>
    );
});
MonthView.displayName = "MonthView";

export {MonthView};
