import {useDragOperation} from "@dnd-kit/react";
import {useCalendarActions} from "./calendar-context";
import type {CalendarEvent, DropData} from "./types";

/** All destination surfaces share the controller's cached resolution. */
const useMoveState = () => {
    const {source, target} = useDragOperation();
    const {resolveDrag, getDragEvent} = useCalendarActions();
    const destination = target?.data as DropData | undefined;
    const outcome = source && destination?.date instanceof Date ? resolveDrag(destination) : null;
    return {source, outcome, getDragEvent};
};

const useMoveResolution = () => useMoveState().outcome;

/** Show accepted destinations, or the valid grid source at its origin while refused/off-grid. */
const useMovePreview = (): CalendarEvent | null => {
    const {source, outcome, getDragEvent} = useMoveState();
    if (outcome?.status === "accepted") return outcome.event;
    // A mounted dnd-kit source can outlive a host deletion or schedule change.
    return source?.data.moveSource === "grid" ? getDragEvent() : null;
};

export {useMovePreview, useMoveResolution};
