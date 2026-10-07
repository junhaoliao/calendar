import {format, isSameDay, isSameMonth} from "date-fns";

import {cn} from "../../lib/utils";
import {useCalendarTranslation} from "../../i18n/translations";
import {useCalendarActions, useCalendarConfig, useCalendarNow} from "./calendar-context";
import {Popover, PopoverContent, PopoverTitle, PopoverTrigger} from "../ui/popover";
import {CalendarDrop} from "./calendar-drop";
import type {EventSegment} from "./types";
import {EventItem, EventMovePreview} from "./event-item";

interface MonthCellProps {
    date: Date;
    day: Date;
    items: EventSegment[];
    capacity: number;
    movePreview?: EventSegment;
}

/**
 * A month cell owns segment presentation and the date overflow popover.
 *
 * @param props Date, lanes and user callbacks.
 * @return A date cell.
 */
const MonthCell = ({day, items, capacity, date, movePreview}: MonthCellProps) => {
    const {tCalendar, dateLocale} = useCalendarTranslation();
    const {create} = useCalendarActions();
    const {readOnly} = useCalendarConfig();
    const now = useCalendarNow();
    const laneCount = Math.max(0, ...items.map((item) => item.lane + 1));
    const limit = laneCount > capacity ? Math.max(0, capacity - 1) : capacity;
    const hidden = items.filter((item) => item.lane >= limit).length;
    return (
        <CalendarDrop
            date={day}
            disabled={readOnly}
            id={`month:${day.getTime()}`}
            key={day.getTime()}
            className={cn(
                "border-r border-b border-border/70 px-1 last:border-r-0",
                !isSameMonth(date, day) && "bg-muted/25 text-muted-foreground/70",
            )}
            onCreate={create}
        >
            <div
                className={cn(
                    "pointer-events-none relative mt-1 inline-flex size-6 items-center justify-center rounded-full text-sm",
                    isSameDay(day, now) && "bg-primary text-primary-foreground",
                )}
            >
                {format(day, "d", {locale: dateLocale})}
            </div>
            <div className="pointer-events-none relative grid auto-rows-[28px]">
                {movePreview && (
                    <EventMovePreview
                        day={day}
                        event={movePreview.event}
                        hasLabel={movePreview.hasLabel}
                        hostView="month"
                        isFirst={movePreview.isFirst}
                        isLast={movePreview.isLast}
                        lane={movePreview.lane}
                        variant="bar"
                    />
                )}
                {items
                    .filter((item) => item.lane < limit)
                    .map((item) => (
                        <EventItem
                            key={item.event.id}
                            day={day}
                            event={item.event}
                            className="pointer-events-auto"
                            hasLabel={item.hasLabel}
                            hostView="month"
                            isFirst={item.isFirst}
                            isLast={item.isLast}
                            lane={item.lane}
                            variant="bar"
                        />
                    ))}
                {hidden > 0 && (
                    <Popover modal={true}>
                        <PopoverTrigger
                            className="pointer-events-auto mt-1 flex h-6 w-full items-center truncate rounded px-1 text-left text-[10px] text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:px-2 sm:text-xs"
                            render={<button type="button" />}
                            style={{
                                gridRow: limit + 1,
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                            }}
                        >
                            {tCalendar(($) => $.month.more, {count: hidden})}
                        </PopoverTrigger>
                        <PopoverContent align="center" className="max-w-52 gap-2 p-3">
                            <PopoverTitle>{format(day, "EEE d", {locale: dateLocale})}</PopoverTitle>
                            <div className="flex flex-col gap-1">
                                {items.map((item) => (
                                    <EventItem day={day} event={item.event} key={item.event.id} variant="month-list" />
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                )}
            </div>
        </CalendarDrop>
    );
};
export {MonthCell};
