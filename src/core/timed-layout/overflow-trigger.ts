import type {TimedOverflow} from "./overflow-groups";

/**
 * Computes the same button footprint used for grouping and rendering.
 *
 * @param coverage Hidden events and their visible anchor.
 * @return Trigger bounds, or null without an anchor.
 */
const overflowTriggerLayout = (coverage: TimedOverflow) => {
    const {anchor} = coverage;
    if (!anchor) {
        return null;
    }
    const compact = anchor.height < 64;
    let top = compact
        ? anchor.top + anchor.height + 4
        : Math.min(Math.max(coverage.top, anchor.top + 36), anchor.top + anchor.height - 28);
    // The floating pill crosses every lane: keep it clear of visible labels and
    // true resize edges, not just its former anchor's label/footer.
    const hidden = new Set(coverage.hidden.map((item) => item.event.id));
    const protectedAreas = coverage.entries
        .filter((item) => !hidden.has(item.event.id))
        .flatMap((item) => [
            {start: item.top - 4, end: item.top + Math.min(item.height, item.height < 48 ? 20 : 36)},
            {start: item.top + item.height - (item.height >= 72 ? 24 : 3), end: item.top + item.height + 3},
        ])
        .sort((a, b) => a.start - b.start);
    const height = compact ? 16 : 24;
    for (const area of protectedAreas) {
        if (top < area.end && top + height > area.start) top = area.end;
    }

    return {compact: compact, height, left: coverage.left, top: top, width: coverage.width};
};

export {overflowTriggerLayout};
