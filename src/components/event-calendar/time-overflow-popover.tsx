import {useState} from "react";

import {format} from "date-fns";

import {cn} from "../../lib/utils";
import {useCalendarTranslation} from "../../i18n/translations";
import {useCalendarActions} from "./calendar-context";
import {Button} from "../ui/button";
import {Popover, PopoverContent, PopoverTitle, PopoverTrigger} from "../ui/popover";
import type {TimedOverflow} from "../../core/timed-layout/lanes";
import {EventItem} from "./event-item";
import {overflowTriggerLayout} from "../../core/timed-layout/overflow-trigger";
import {useOverflowDrag} from "./use-overflow-drag";

interface TimeOverflowProps {
    day: Date;
    coverage: TimedOverflow;
    view: "week" | "day";
}

/**
 * Anchors overflow inside a visible card and offers draggable full-detail rows.
 *
 * @param props Hidden coverage and the existing calendar interactions.
 * @return A sibling control visually inside the card, with no nested buttons.
 */
const TimeOverflow = ({day, coverage, view}: TimeOverflowProps) => {
    const {tCalendar, dateLocale} = useCalendarTranslation();
    const {select, openDay} = useCalendarActions();
    const [open, setOpen] = useState(false);
    const scope = `overflow:${view}:${day.getTime()}:${coverage.key}`;
    const {active, dragging} = useOverflowDrag(scope, () => {
        setOpen(false);
    });
    const trigger = overflowTriggerLayout(coverage);
    if (!trigger) {
        return null;
    }
    const {compact, top} = trigger;
    const hiddenCount = coverage.hidden.length;
    return (
        <div
            className={cn("pointer-events-none absolute z-20 flex px-2", dragging && "invisible")}
            data-anchor-event={coverage.anchor?.event.id}
            data-compact={compact}
            data-coverage-end={coverage.end.toISOString()}
            data-hidden-count={hiddenCount}
            data-slot="time-overflow"
            style={{top: top, left: `${coverage.left}%`, width: `${coverage.width}%`}}
        >
            <Popover
                open={open}
                onOpenChange={(next, details) => {
                    if (active.current) {
                        details.cancel();
                        details.allowPropagation();
                    } else {
                        setOpen(next);
                    }
                }}
            >
                <PopoverTrigger
                    aria-label={tCalendar(($) => $.timeOverflow.triggerLabel, {
                        count: hiddenCount,
                        date: format(
                            day,
                            tCalendar(($) => $.formats.overflowTriggerDay),
                            {
                                locale: dateLocale,
                            },
                        ),
                    })}
                    className={cn("pointer-events-auto h-6 w-full min-w-0 rounded-full px-1", compact && "h-4")}
                    render={<Button variant="outline" />}
                    onClick={(event) => {
                        event.stopPropagation();
                    }}
                >
                    {compact
                        ? tCalendar(($) => $.timeOverflow.compact, {count: hiddenCount})
                        : tCalendar(($) => $.timeOverflow.more, {count: hiddenCount})}
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    className={cn("w-80 max-w-[calc(100vw-2rem)] gap-3 p-3", dragging && "pointer-events-none")}
                >
                    <PopoverTitle>
                        {tCalendar(($) => $.timeOverflow.title, {
                            date: format(
                                day,
                                tCalendar(($) => $.formats.overflowTitleDay),
                                {
                                    locale: dateLocale,
                                },
                            ),
                            count: coverage.entries.length,
                        })}
                    </PopoverTitle>
                    <div className="flex max-h-64 flex-col gap-1 overflow-y-auto" data-slot="time-overflow-events">
                        {coverage.entries.map(({event}) => (
                            <EventItem
                                day={day}
                                dragScope={scope}
                                event={event}
                                hostView={view}
                                key={event.id}
                                onSelectOverride={(selected) => {
                                    if (!active.current) {
                                        setOpen(false);
                                        select(selected);
                                    }
                                }}
                                variant="popover-row"
                            />
                        ))}
                    </div>
                    <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => {
                            setOpen(false);
                            openDay(day);
                        }}
                    >
                        {tCalendar(($) => $.timeOverflow.openDay)}
                    </Button>
                </PopoverContent>
            </Popover>
        </div>
    );
};

export {TimeOverflow};
