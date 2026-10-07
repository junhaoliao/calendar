import {type TimedOverflow, timedOverflow} from "./overflow-groups";
import type {TimedPlacement} from "../types";

const DEFAULT_MINIMUM_TIMED_EVENT_WIDTH = 90;
const TIMED_CARD_GUTTER = 4;

interface TimedGroup {
    placements: TimedPlacement[];
    bottom: number;
}

/**
 * Tests intersection of visible time intervals, excluding touching ends.
 *
 * @param a First segment.
 * @param b Second segment.
 * @return Whether both would occupy the same vertical pixels.
 */
const overlaps = (a: TimedPlacement, b: TimedPlacement): boolean =>
    a.top < b.top + b.height && b.top < a.top + a.height;

/**
 * Groups connected intervals deterministically, independent of input order or width.
 *
 * @param placements Day-clipped timed segments.
 * @return Disjoint overlap groups.
 */
const timedGroups = (placements: readonly TimedPlacement[]): TimedGroup[] => {
    const sorted = [...placements].sort(
        (a, b) => a.top - b.top || b.height - a.height || a.event.id.localeCompare(b.event.id),
    );
    const groups: TimedGroup[] = [];
    for (const placement of sorted) {
        const previous = groups[groups.length - 1];
        if (groups.length === 0 || placement.top >= previous.bottom) {
            groups.push({bottom: placement.top + placement.height, placements: [placement]});
        } else {
            previous.placements.push(placement);
            previous.bottom = Math.max(previous.bottom, placement.top + placement.height);
        }
    }

    return groups;
};

/**
 * Finds rightward spare lanes without changing a card's left edge during its duration.
 *
 * @param placement The card being placed.
 * @param visible Rendered group members.
 * @param laneCount Number of available columns.
 * @return Percentage coordinates for a nonoverlapping card.
 */
const expandPlacement = (
    placement: TimedPlacement,
    visible: readonly TimedPlacement[],
    laneCount: number,
): TimedPlacement => {
    let span = 1;
    for (let lane = placement.lane + 1; lane < laneCount; lane++) {
        if (visible.some((other) => other.lane === lane && overlaps(placement, other))) {
            break;
        }
        span++;
    }

    return {...placement, left: (placement.lane / laneCount) * 100, width: (span / laneCount) * 100};
};

/**
 * Assigns stable lanes before considering column width or overflow.
 *
 * @param placements Raw segment geometry.
 * @return Segments with deterministic lanes and spare-space expansion.
 */
const placeTimedLanes = (placements: readonly TimedPlacement[]): TimedPlacement[] =>
    timedGroups(placements).flatMap((group) => {
        const laneEnds: number[] = [];
        const assigned = group.placements.map((placement) => {
            let lane = laneEnds.findIndex((end) => end <= placement.top);
            if (lane === -1) {
                lane = laneEnds.length;
            }
            laneEnds[lane] = placement.top + placement.height;

            return {...placement, lane};
        });

        return assigned.map((placement) => expandPlacement(placement, assigned, laneEnds.length));
    });

/**
 * Adapts stable lanes to readable card width and exposes all hidden coverage.
 *
 * @param placements Segments with preassigned lanes.
 * @param columnWidth Measured column width in CSS pixels.
 * @param minimumWidth Minimum card content width in CSS pixels.
 * @return Visible cards and overflow coverage, without changing times or identities.
 */
const readableTimedLayout = (
    placements: readonly TimedPlacement[],
    columnWidth: number,
    minimumWidth = DEFAULT_MINIMUM_TIMED_EVENT_WIDTH,
) => {
    const minimum =
        Number.isFinite(minimumWidth) && minimumWidth > 0 ? minimumWidth : DEFAULT_MINIMUM_TIMED_EVENT_WIDTH;
    const capacity = Math.max(1, Math.floor(columnWidth / (minimum + TIMED_CARD_GUTTER)));
    const visible: TimedPlacement[] = [];
    const overflow: TimedOverflow[] = [];
    for (const group of timedGroups(placements)) {
        const laneCount = Math.max(...group.placements.map((item) => item.lane)) + 1;
        const count = Math.min(laneCount, capacity);
        const shown = group.placements.filter((placement) => placement.lane < count);
        const expanded = shown.map((placement) => expandPlacement(placement, shown, count));
        visible.push(...expanded);
        const hidden = group.placements.filter((placement) => placement.lane >= count);
        overflow.push(...timedOverflow(hidden, expanded));
    }

    return {overflow, visible};
};

export {DEFAULT_MINIMUM_TIMED_EVENT_WIDTH, placeTimedLanes, readableTimedLayout, type TimedOverflow};
