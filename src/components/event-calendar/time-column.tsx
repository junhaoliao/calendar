import {useMemo, useLayoutEffect, useRef, useState} from "react";

import {useDragOperation} from "@dnd-kit/react";
import {isSameDay} from "date-fns";

import {cn} from "../../lib/utils";
import {CalendarDrop} from "./calendar-drop";
import {useCalendarActions, useCalendarConfig, useCalendarNow} from "./calendar-context";
import {onDay} from "../../core/dates";
import {HOUR_HEIGHT, timedPlacements} from "../../core/timed-layout/placements";
import {readableTimedLayout, type TimedOverflow} from "../../core/timed-layout/lanes";
import {EventItem, EventMovePreview} from "./event-item";
import {useMovePreview} from "./use-move-preview";
import {TimeOverflow} from "./time-overflow-popover";
import {useCalendarResizeSelector} from "./calendar-resize-context";
import type {CalendarEvent} from "./types";

interface TimeColumnProps {
    events: readonly CalendarEvent[];
    day: Date;
    view: "week" | "day";
}

/**
 * Quarter-hour targets, timed events and current-time marker for a day.
 *
 * @param props Date and interaction state.
 * @return A timed day column.
 */
const TimeColumn = ({day, events, view}: TimeColumnProps) => {
    const {create} = useCalendarActions();
    const movePreview = useMovePreview();
    const {readOnly, minimumTimedEventWidth} = useCalendarConfig();
    const now = useCalendarNow();
    const resizing = useCalendarResizeSelector((session) =>
        session && !session.event.allDay && (onDay(session.event, day) || onDay(session.original, day))
            ? session
            : null,
    );
    const columnRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(Number.POSITIVE_INFINITY);
    useLayoutEffect(() => {
        const column = columnRef.current;
        if (!column) {
            return () => {
                // No mounted column to observe.
            };
        }
        const measure = () => {
            const css = getComputedStyle(column);
            const measured =
                column.getBoundingClientRect().width -
                (parseFloat(css.borderLeftWidth) || 0) -
                (parseFloat(css.borderRightWidth) || 0);

            if (measured > 0) {
                setWidth(measured);
            }
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(column);

        return () => {
            observer.disconnect();
        };
    }, []);
    const {source} = useDragOperation();
    const dayKey = day.getTime();
    const slots = useMemo(
        () =>
            Array.from({length: 96}, (_, index) => (
                <CalendarDrop
                    className={cn("h-4", index % 4 === 3 && "border-b border-border/70", index === 95 && "border-b-0")}
                    date={new Date(dayKey)}
                    disabled={readOnly}
                    id={`time:${dayKey}:${index * 15}`}
                    key={index}
                    minute={index * 15}
                    onCreate={create}
                />
            )),
        [dayKey, readOnly, create],
    );
    const placements = useMemo(() => timedPlacements(events, new Date(dayKey)), [events, dayKey]);
    const baseLayout = useMemo(
        () => readableTimedLayout(placements, width, minimumTimedEventWidth),
        [placements, width, minimumTimedEventWidth],
    );
    const layout = {...baseLayout, visible: [...baseLayout.visible], overflow: [...baseLayout.overflow]};
    const movePlacements =
        movePreview && !movePreview.allDay
            ? timedPlacements([...events.filter((event) => event.id !== movePreview.id), movePreview], day)
            : [];
    const projectedLayout = readableTimedLayout(movePlacements, width, minimumTimedEventWidth);
    const moveGeometry = movePlacements
        .filter((item) => item.event.id === movePreview?.id)
        .map((item) => projectedLayout.visible.find((visible) => visible.event.id === item.event.id) ?? item);
    if (resizing && !resizing.event.allDay) {
        const original = layout.visible.find((item) => item.event.id === resizing.original.id);
        const candidate = timedPlacements([resizing.event], day)[0];
        if (candidate) {
            layout.visible = layout.visible.filter((item) => item.event.id !== resizing.original.id);
            layout.visible.push({
                ...candidate,
                left: original?.left ?? resizing.geometry?.left ?? 0,
                width: original?.width ?? resizing.geometry?.width ?? 100,
                lane: original?.lane ?? 0,
            });
        }
    }
    const previousOverflow = useRef<TimedOverflow[]>([]);
    const popupSource = previousOverflow.current.find(
        (coverage) => source?.data.dragScope === `overflow:${view}:${day.getTime()}:${coverage.key}`,
    );

    // Width changes may remove overflow, but a promoted popup source must finish its drag.
    if (popupSource && !layout.overflow.some((coverage) => coverage.key === popupSource.key)) {
        layout.overflow.push(popupSource);
    }
    previousOverflow.current = layout.overflow;
    const active =
        source?.data.dragScope === view &&
        source.data.anchor instanceof Date &&
        source.data.anchor.getTime() === day.getTime()
            ? placements.find((placement) => placement.event.id === source.data.event.id)
            : undefined;

    // Keep an active drag's DOM node alive when resizing makes its lane overflow.
    if (active && !layout.visible.some((placement) => placement.event.id === active.event.id)) {
        layout.visible.push(active);
    }

    return (
        <div
            className="relative min-w-0 border-r border-border/70 last:border-r-0"
            data-day={day.toISOString()}
            data-slot="time-column"
            key={day.getTime()}
            ref={columnRef}
        >
            {slots}
            {movePreview &&
                !movePreview.allDay &&
                moveGeometry.map((placement) => (
                    <div
                        key="move-preview"
                        className="pointer-events-none absolute min-w-0 px-0.5"
                        style={{
                            height: placement.height,
                            top: placement.top,
                            left: `${placement.left}%`,
                            width: `${placement.width}%`,
                            zIndex: 20,
                        }}
                    >
                        <EventMovePreview
                            day={day}
                            event={movePreview}
                            geometry={{left: placement.left, width: placement.width}}
                            continuesAfter={placement.continuesAfter}
                            continuesBefore={placement.continuesBefore}
                            height={placement.height}
                            hostView={view}
                            segmentEnd={placement.segmentEnd}
                            segmentStart={placement.segmentStart}
                            variant="timed"
                        />
                    </div>
                ))}
            {layout.visible.map((placement) => (
                <div
                    className="absolute min-w-0 px-0.5"
                    key={placement.event.id}
                    style={{
                        visibility:
                            resizing?.original.id === placement.event.id &&
                            !timedPlacements([resizing.event], day).length
                                ? "hidden"
                                : undefined,
                        height: placement.height,
                        left: `${placement.left}%`,
                        top: placement.top,
                        width: `${placement.width}%`,
                        zIndex: 10,
                    }}
                >
                    <EventItem
                        day={day}
                        event={placement.event}
                        geometry={{left: placement.left, width: placement.width}}
                        continuesAfter={placement.continuesAfter}
                        continuesBefore={placement.continuesBefore}
                        height={placement.height}
                        hostView={view}
                        segmentEnd={placement.segmentEnd}
                        segmentStart={placement.segmentStart}
                        variant="timed"
                    />
                </div>
            ))}
            {layout.overflow.map((coverage) => (
                <TimeOverflow coverage={coverage} day={day} key={coverage.key} view={view} />
            ))}
            {isSameDay(day, now) && (
                <div
                    className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-primary"
                    data-slot="current-time"
                    style={{
                        top: (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT,
                    }}
                >
                    <div className="absolute -top-[3px] -left-1 size-2 rounded-full bg-primary" />
                </div>
            )}
        </div>
    );
};
export {TimeColumn};
