import {useRef, useState} from "react";

import {useDragDropMonitor} from "@dnd-kit/react";

/**
 * Keeps a popup drag source mounted through dismissal and drop processing.
 *
 * @param scope Unique popup drag namespace.
 * @param close Closes the popover after a completed drop.
 * @return Synchronous and rendered drag flags.
 */
const useOverflowDrag = (scope: string, close: () => void) => {
    const active = useRef(false);
    const [dragging, setDragging] = useState(false);
    useDragDropMonitor({
        onDragStart: (event) => {
            if (event.operation.source?.data.dragScope === scope) {
                active.current = true;
                setDragging(true);
            }
        },
        onDragEnd: (event) => {
            if (!active.current) {
                return;
            }
            active.current = false;
            setDragging(false);
            if (!event.canceled && event.operation.target) {
                close();
            }
        },
    });

    return {active, dragging};
};

export {useOverflowDrag};
