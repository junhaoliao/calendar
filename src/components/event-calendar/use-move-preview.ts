import {useDragOperation} from "@dnd-kit/react";
import {useCalendarActions} from "./calendar-context";
import type {DropData} from "./types";

/** All destination surfaces share the controller's cached resolution. */
const useMovePreview = () => {
    const {source, target} = useDragOperation();
    const {resolveDrag} = useCalendarActions();
    const destination = target?.data as DropData | undefined;
    const outcome = source && destination?.date instanceof Date ? resolveDrag(destination) : null;
    return outcome?.status === "accepted" ? outcome.event : null;
};

export {useMovePreview};
