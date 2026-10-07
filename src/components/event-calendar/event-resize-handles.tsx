import {displayTitle} from "./event-display";
import {isSameDay} from "date-fns";
import {useDragOperation} from "@dnd-kit/react";
import {useCalendarTranslation} from "../../i18n/translations";

import {useCalendarResizeActions, useCalendarResizeSelector} from "./calendar-resize-context";
import {lastOccupiedDay} from "../../core/dates";
import type {ResizeEdge} from "../../core/resize";
import type {CalendarEvent} from "./types";

/** Sibling controls preserve the native event button and its body drag sensor. */
export function EventResizeHandles({
    event,
    day,
    axis,
    gridRow,
    height,
    geometry,
}: {
    event: CalendarEvent;
    day: Date;
    axis: "date" | "time";
    gridRow?: number;
    height?: number;
    geometry?: {left: number; width: number};
}) {
    const {tCalendar} = useCalendarTranslation();
    const resize = useCalendarResizeActions();
    const session = useCalendarResizeSelector((current) => (current?.original.id === event.id ? current : null));
    const {source} = useDragOperation();
    if (source) return null;
    const dateOnly = axis === "date";
    const active = session?.original.id === event.id;
    if (!dateOnly && (height ?? 0) < 48 && !active) return null;
    const original = active ? session!.original : event;
    const shownTitle = displayTitle(event.title, tCalendar);
    const style = undefined === gridRow ? undefined : {gridRow: gridRow};
    const edges: ResizeEdge[] = [];
    if (isSameDay(event.start, day) || (active && session!.edge === "start" && isSameDay(session!.anchor, day)))
        edges.push("start");
    if (
        isSameDay(lastOccupiedDay(event), day) ||
        (active && session!.edge === "end" && isSameDay(session!.anchor, day))
    )
        edges.push("end");
    return edges.map((edge) => (
        <button
            key={edge}
            type="button"
            className="calendar-resize-handle"
            data-edge={edge}
            data-axis={dateOnly ? "date" : "time"}
            data-small={(height ?? 0) < 72}
            data-active={active && session!.edge === edge}
            data-retained={!isSameDay(edge === "start" ? event.start : lastOccupiedDay(event), day)}
            aria-label={
                {
                    start: tCalendar(($) => $.resize.handleLabel.start, {title: shownTitle}),
                    end: tCalendar(($) => $.resize.handleLabel.end, {title: shownTitle}),
                }[edge]
            }
            title={
                dateOnly
                    ? {
                          start: tCalendar(($) => $.resize.hint.startDate),
                          end: tCalendar(($) => $.resize.hint.endDate),
                      }[edge]
                    : {
                          start: tCalendar(($) => $.resize.hint.startTime),
                          end: tCalendar(($) => $.resize.hint.endTime),
                      }[edge]
            }
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
            onPointerDown={(e) => resize.start(original, edge, dateOnly, day, e.currentTarget, style, e, geometry)}
            onKeyDown={(e) => {
                if (e.altKey || e.ctrlKey || e.metaKey) return;
                if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Enter"].includes(e.key)) {
                    e.preventDefault();
                    e.stopPropagation();
                    resize.key(original, edge, dateOnly, day, e.currentTarget, e.key, style, geometry);
                }
            }}
        />
    ));
}
