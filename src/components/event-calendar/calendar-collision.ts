import {pointerIntersection} from "@dnd-kit/collision";

/**
 * Rejects destinations hidden under sticky headers or clipped scroll content.
 *
 * @param input dnd-kit collision input.
 * @param element The registered destination element.
 * @return A collision only for the visible slot underneath the drag point.
 */
const calendarCollision = (
    input: Parameters<typeof pointerIntersection>[0],
    element: HTMLElement | null,
): ReturnType<typeof pointerIntersection> => {
    const collision = pointerIntersection(input);
    if (!collision || !element) {
        return null;
    }
    const {x, y} = input.dragOperation.position.current;
    const stack = element.ownerDocument.elementsFromPoint(x, y);
    for (const hit of stack) {
        if (hit.closest("[data-dnd-dragging]")) {
            continue;
        }
        const drop = hit.closest('[data-slot="calendar-drop"]');
        if (drop) {
            return drop === element ? collision : null;
        }
    }

    return null;
};

export {calendarCollision};
