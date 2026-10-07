import {overflowTriggerLayout} from "./overflow-trigger";
import type {TimedPlacement} from "../types";

const OVERFLOW_TRIGGER_GAP = 4;

interface TimedOverflow {
    key: string;
    top: number;
    height: number;
    end: Date;
    hidden: TimedPlacement[];
    entries: TimedPlacement[];
    left: number;
    width: number;
    anchor: TimedPlacement | null;
}

/**
 * Builds one exact hidden membership set plus related visible events.
 *
 * @param hidden This control's hidden members.
 * @param visible Rendered cards in the connected overlap group.
 * @return Stable identity, coverage and anchor for a popover.
 */
const makeCoverage = (hidden: TimedPlacement[], visible: TimedPlacement[]): TimedOverflow => {
    const [first] = hidden;
    const {top} = first;
    const bottom = Math.max(...hidden.map((placement) => placement.top + placement.height));
    const end = hidden.reduce(
        (latest, placement) => (placement.segmentEnd > latest ? placement.segmentEnd : latest),
        first.segmentEnd,
    );
    const anchor =
        visible.find(
            (placement) => placement.top < first.top + first.height && first.top < placement.top + placement.height,
        ) ?? visible[0];
    const entries = [
        ...hidden,
        ...visible.filter((placement) =>
            hidden.some(
                (member) => placement.top < member.top + member.height && member.top < placement.top + placement.height,
            ),
        ),
    ].sort((a, b) => a.top - b.top || b.height - a.height || a.event.id.localeCompare(b.event.id));

    return {
        anchor: anchor,
        end: end,
        entries: entries,
        height: bottom - top,
        hidden: hidden,
        key: JSON.stringify(hidden.map((placement) => placement.event.id)),
        left: 0,
        top: top,
        width: 100,
    };
};

/**
 * Checks actual control footprints, not overlapping event durations.
 *
 * @param earlier Earlier control.
 * @param later Later control.
 * @return Whether both can be read and clicked without covering each other.
 */
const fitsBefore = (earlier: TimedOverflow, later: TimedOverflow) => {
    const a = overflowTriggerLayout(earlier);
    const b = overflowTriggerLayout(later);
    if (!a || !b) {
        return false;
    }
    if (a.left + a.width <= b.left || b.left + b.width <= a.left) {
        return true;
    }

    return a.top + a.height + OVERFLOW_TRIGGER_GAP <= b.top;
};

/**
 * Keeps a later event separate when its button fits; merges earlier crowded starts.
 *
 * @param hidden Remaining ordered cluster members.
 * @param visible Rendered anchors.
 * @param next Already placed later control.
 * @return A feasible prefix/tail partition, or null when one button is needed.
 */
const splitTail = (hidden: TimedPlacement[], visible: TimedPlacement[], next: TimedOverflow | null) => {
    for (let cut = hidden.length - 1; cut > 0; cut--) {
        const prefix = hidden.slice(0, cut);
        const earlier = makeCoverage(prefix, visible);
        const tail = makeCoverage(hidden.slice(cut), visible);
        if (fitsBefore(earlier, tail) && (!next || fitsBefore(tail, next))) {
            return {prefix: prefix, tail: tail};
        }
    }

    return null;
};

/**
 * Partitions one connected interval according to available control space.
 *
 * @param cluster Hidden members with connected coverage.
 * @param visible Rendered anchors.
 * @return Disjoint hidden memberships with nonoverlapping control footprints.
 */
const splitCluster = (cluster: TimedPlacement[], visible: TimedPlacement[]) => {
    const result: TimedOverflow[] = [];
    let remaining = cluster;
    let next: TimedOverflow | null = null;
    while (remaining.length > 1) {
        const split = splitTail(remaining, visible, next);
        if (!split) {
            break;
        }
        result.unshift(split.tail);
        next = split.tail;
        remaining = split.prefix;
    }
    result.unshift(makeCoverage(remaining, visible));

    return result;
};

/**
 * Splits hidden members of one overlap group whenever readable controls fit.
 *
 * @param hidden Ordered hidden placements.
 * @param visible Expanded rendered placements.
 * @return Accurate controls and full event lists.
 */
const timedOverflow = (hidden: TimedPlacement[], visible: TimedPlacement[]) =>
    hidden.length > 0 ? splitCluster(hidden, visible) : [];

export {type TimedOverflow, timedOverflow};
