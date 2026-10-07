import {startOfDay} from "date-fns";
import {HOUR_HEIGHT} from "./placements";
import {RESIZE_STEP_MINUTES} from "../resize";

interface ColumnBox {
    day: Date;
    top: number;
}

/** Raw wall-clock minutes for a pointer coordinate, before resize snapping. */
const wallMinutesAtY = (top: number, y: number, grabOffset = 0): number => ((y - grabOffset - top) / HOUR_HEIGHT) * 60;

/** Map a pointer coordinate to the nearest quarter-hour on its local date. */
const timedResizeTarget = (column: ColumnBox, y: number, grabOffset: number): Date => {
    const raw = wallMinutesAtY(column.top, y, grabOffset);
    const minute = Math.max(0, Math.min(1440, Math.round(raw / RESIZE_STEP_MINUTES) * RESIZE_STEP_MINUTES));
    const target = startOfDay(column.day);
    target.setMinutes(minute);
    return target;
};

/** Keep keyboard resize steps inside the visible date range. */
const withinVisibleRange = (target: Date, first: Date, last: Date, exclusiveEnd: boolean): boolean => {
    const rangeStart = startOfDay(first);
    const rangeEnd = startOfDay(last);
    rangeEnd.setDate(rangeEnd.getDate() + 1);
    return target >= rangeStart && target <= rangeEnd && !(exclusiveEnd && target.getTime() === rangeEnd.getTime());
};

export {timedResizeTarget, wallMinutesAtY, withinVisibleRange};
export type {ColumnBox};
