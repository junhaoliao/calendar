import type {CSSProperties} from "react";

import {timedPlacements} from "../../core/timed-layout/placements";
import type {CalendarEvent} from "./types";

/**
 * Applies the destination card's geometry to the shared drag surface.
 *
 * @param event Candidate event with its resulting type and range.
 * @param date Destination date for segment clipping.
 * @param original Existing consumer/card style.
 * @param popupWidth Destination width for a full-detail popup source.
 * @return New geometry without mutating event or consumer style.
 */
const eventDragStyle = (
    event: CalendarEvent,
    date: Date,
    original: CSSProperties | undefined,
    popupWidth = 0,
): CSSProperties => {
    let height = 24;
    if (!event.allDay) {
        const placements = timedPlacements([event], date);
        height = placements[0]?.height ?? 16;
        if (event.end.getTime() - event.start.getTime() >= 2700000) {
            height = Math.max(48, height);
        }
    }

    // Overflow hit-area padding belongs to the stationary card, not the drag surface.
    const style = {...original, height: height, marginTop: 0, maxHeight: height, paddingBottom: "", paddingRight: ""};

    if (popupWidth > 0) {
        return {...style, width: Math.max(1, popupWidth - 4)};
    }

    return style;
};

export {eventDragStyle};
