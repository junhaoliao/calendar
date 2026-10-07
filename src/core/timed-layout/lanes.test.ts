import {describe, expect, it} from "vitest";

import {timedPlacements} from "./placements";
import {readableTimedLayout} from "./lanes";
import type {CalendarEvent} from "../types";

const day = new Date(2026, 9, 5);

/**
 * Creates an immutable local timed fixture.
 *
 * @param id Stable identity.
 * @param start Start minute of day.
 * @param end End minute of day.
 * @return The consumer event.
 */
const event = (id: string, start: number, end: number): CalendarEvent => ({
    end: new Date(2026, 9, 5, 0, end),
    id: id,
    start: new Date(2026, 9, 5, 0, start),
    title: id,
});

const trio = [event("sync", 720, 780), event("call", 735, 765), event("review", 750, 810)];

describe("stable nonoverlapping timed lanes", () => {
    it("groups transitive overlaps and separates cards without changing time or duration", () => {
        const placements = timedPlacements(trio, day);
        expect(placements.map((item) => item.lane)).toEqual([0, 1, 2]);
        expect(placements[0].left).toBe(0);
        expect(placements[1].left).toBeCloseTo(100 / 3);
        expect(placements[2].left).toBeCloseTo(200 / 3);
        expect(placements.every((item) => Math.abs(item.width - 100 / 3) < 0.001)).toBe(true);
        const geometry = placements.map((item) => ({top: item.top, height: item.height}));
        expect(geometry).toEqual([
            {top: 768, height: 64},
            {top: 784, height: 32},
            {top: 800, height: 64},
        ]);
        for (let index = 0; index < trio.length; index++) {
            expect(placements[index].event).toBe(trio[index]);
        }
    });
    it("keeps lane identity stable through input reordering and narrow/wide resizing", () => {
        const first = timedPlacements(trio, day);
        const reordered = timedPlacements([...trio].reverse(), day);
        expect(reordered.map((item) => [item.event.id, item.lane])).toEqual(
            first.map((item) => [item.event.id, item.lane]),
        );
        const narrow = readableTimedLayout(first, 150);
        const wide = readableTimedLayout(first, 400);
        expect(narrow.visible.map((item) => [item.event.id, item.lane])).toEqual([["sync", 0]]);
        expect(wide.visible.map((item) => item.lane)).toEqual([0, 1, 2]);
        expect(narrow.overflow[0].hidden.map((item) => item.event.id)).toEqual(["call", "review"]);
        expect(wide.overflow).toEqual([]);
    });
    it("reuses lanes for touching ends and resets disconnected groups to full width", () => {
        const placements = timedPlacements([event("a", 600, 660), event("b", 660, 720)], day);

        expect(placements.map((item) => [item.lane, item.left, item.width])).toEqual([
            [0, 0, 100],
            [0, 0, 100],
        ]);
    });
    it("expands rightward into spare lanes only when free for the whole interval", () => {
        const placements = timedPlacements(
            [event("long", 600, 660), event("early", 600, 630), event("brief", 615, 625), event("later", 630, 645)],
            day,
        );
        const later = placements.find((item) => item.event.id === "later");
        expect(later?.lane).toBe(1);
        expect(later?.width).toBeCloseTo(200 / 3);
        const early = placements.find((item) => item.event.id === "early");
        expect(early?.width).toBeCloseTo(100 / 3);
    });
});

describe("responsive overflow and hidden coverage", () => {
    it("counts only hidden events and covers the tail beyond a visible event", () => {
        const placements = timedPlacements(trio, day);
        const layout = readableTimedLayout(placements, 150);
        expect(layout.visible[0].width).toBe(100);
        const [overflow] = layout.overflow;
        expect(overflow.hidden).toHaveLength(2);
        expect(overflow.entries.map((item) => item.event.id)).toEqual(["sync", "call", "review"]);
        expect(overflow.top).toBe(784);
        expect(overflow.top + overflow.height).toBe(864);
        expect(overflow.end).toEqual(new Date(2026, 9, 5, 13, 30));
        expect(overflow.top + overflow.height).toBeGreaterThan(layout.visible[0].top + layout.visible[0].height);
    });
    it("keeps hidden coverage gaps separate with accurate per-range counts", () => {
        const placements = timedPlacements(
            [event("bridge", 600, 840), event("early", 615, 645), event("late", 780, 810)],
            day,
        );
        const {overflow} = readableTimedLayout(placements, 150);
        expect(overflow).toHaveLength(2);
        expect(overflow.map((range) => range.hidden.length)).toEqual([1, 1]);
        expect(overflow[0].top + overflow[0].height).toBeLessThan(overflow[1].top);
        expect(overflow[0].entries.map((item) => item.event.id)).toEqual(["bridge", "early"]);
        expect(overflow[1].entries.map((item) => item.event.id)).toEqual(["bridge", "late"]);
    });
    it("keeps one full-width card below the minimum, honors custom widths, and handles empty columns", () => {
        const placements = timedPlacements(trio, day);
        expect(readableTimedLayout(placements, 80).visible).toHaveLength(1);
        expect(readableTimedLayout(placements, 80).visible[0].width).toBe(100);
        expect(readableTimedLayout(placements, 80).overflow[0].hidden).toHaveLength(2);
        expect(readableTimedLayout(placements, 250, 70).visible).toHaveLength(3);
        expect(readableTimedLayout(placements, 300, 120).visible).toHaveLength(2);
        expect(readableTimedLayout(placements, 150, NaN)).toEqual(readableTimedLayout(placements, 150));
        expect(readableTimedLayout([], 20)).toEqual({overflow: [], visible: []});
    });
});

describe("narrow columns and midnight", () => {
    it("never collapses a lone event or unrelated events in a narrow column", () => {
        for (const width of [20, 80, 90, 150]) {
            const single = readableTimedLayout(timedPlacements([trio[0]], day), width, 120);
            expect(single.visible).toHaveLength(1);
            expect(single.visible[0].width).toBe(100);
            expect(single.overflow).toEqual([]);
            const separate = readableTimedLayout(
                timedPlacements([event("a", 600, 615), event("b", 660, 675)], day),
                width,
            );

            expect(separate.visible).toHaveLength(2);
            expect(separate.overflow).toEqual([]);
        }
    });
    it("anchors overflow to a visible short card without changing start or duration", () => {
        const layout = readableTimedLayout(timedPlacements([event("a", 600, 615), event("b", 605, 620)], day), 80);

        expect(layout.visible[0].top).toBe(640);
        expect(layout.visible[0].height).toBe(16);
        expect(layout.overflow[0].anchor).toBe(layout.visible[0]);
        expect(layout.overflow[0].left).toBe(0);
        expect(layout.overflow[0].width).toBe(100);
        expect(layout.overflow[0].hidden[0].event.id).toBe("b");
    });
    it("clips midnight coverage without counting a timed event on its exclusive end date", () => {
        const overnight = event("overnight", 1380, 1500);
        const untilMidnight = event("midnight", 1395, 1440);
        const final = readableTimedLayout(timedPlacements([overnight, untilMidnight], day), 80);

        expect(final.overflow[0].end).toEqual(new Date(2026, 9, 6));
        const nextDay = new Date(2026, 9, 6);
        const continued = readableTimedLayout(timedPlacements([overnight, untilMidnight], nextDay), 80);

        expect(continued.overflow).toEqual([]);
        expect(continued.visible[0].event.id).toBe("overnight");
        expect(continued.visible[0].segmentEnd).toEqual(new Date(2026, 9, 6, 1));
    });
});
