import {describe, expect, it} from "vitest";

import {timedPlacements} from "./placements";
import {readableTimedLayout} from "./lanes";
import {overflowTriggerLayout} from "./overflow-trigger";
import type {CalendarEvent} from "../types";

const day = new Date(2026, 9, 9);

/**
 * Builds original consumer events behind a long visible calendar card.
 *
 * @param id Identity and full title.
 * @param start Local start minute.
 * @param end Local end minute.
 * @return A reusable event fixture.
 */
const event = (id: string, start: number, end: number): CalendarEvent => ({
    end: new Date(2026, 9, 9, 0, end),
    id: id,
    start: new Date(2026, 9, 9, 0, start),
    title: id,
});

const contracts = [
    event("sales", 0, 885),
    event("orange", 540, 630),
    event("amber", 585, 660),
    event("review", 600, 690),
];

describe("overflow identities", () => {
    it("merges conflicting full-column controls even when their former anchors differed", () => {
        const inputs = [
            event("early-host", 0, 590),
            event("right-host", 540, 720),
            event("left-host", 590, 840),
            event("early-hidden", 585, 750),
            event("late-hidden", 590, 690),
        ];
        const {overflow} = readableTimedLayout(timedPlacements(inputs, day), 240);
        expect(overflow.map((coverage) => coverage.hidden.length)).toEqual([2]);
        expect(overflow.map((coverage) => coverage.left)).toEqual([0]);
        expect(overflow[0].width).toBe(100);
        expect(overflow[0].hidden.map((item) => item.event.id)).toEqual(["early-hidden", "late-hidden"]);
    });
    it("keeps distinct controls for event IDs containing delimiters", () => {
        const inputs = [
            contracts[0],
            event("a:b", 540, 600),
            event("c", 545, 605),
            event("a", 720, 780),
            event("b:c", 725, 785),
        ];
        const {overflow} = readableTimedLayout(timedPlacements(inputs, day), 150);
        expect(overflow).toHaveLength(2);
        expect(new Set(overflow.map((coverage) => coverage.key)).size).toBe(2);
        expect(overflow.flatMap((coverage) => coverage.hidden.map((item) => item.event.id))).toEqual([
            "a:b",
            "c",
            "a",
            "b:c",
        ]);
    });
});

describe("overflow control space", () => {
    it("leaves the full touch resize target clear on a 75-minute anchor", () => {
        const layout = readableTimedLayout(
            timedPlacements([event("host", 540, 615), event("hidden", 600, 615)], day),
            150,
        );
        const card = layout.visible[0];
        const trigger = overflowTriggerLayout(layout.overflow[0])!;
        expect(card.height).toBe(80);
        expect(trigger.top).toBeGreaterThanOrEqual(card.top + card.height + 3);
        expect(trigger.width).toBe(100);
        expect(layout.overflow[0].hidden.map((item) => item.event.id)).toEqual(["hidden"]);
    });
    it("keeps the 10 AM review separate from earlier overlapping meetings", () => {
        const layout = readableTimedLayout(timedPlacements(contracts, day), 150);
        expect(layout.overflow.map((coverage) => coverage.hidden.map((item) => item.event.id))).toEqual([
            ["orange", "amber"],
            ["review"],
        ]);
        expect(layout.overflow.map((coverage) => coverage.entries.map((item) => item.event.id))).toEqual([
            ["sales", "orange", "amber"],
            ["sales", "review"],
        ]);
        const [earlier, later] = layout.overflow.map(overflowTriggerLayout);
        expect(earlier?.top).toBe(576);
        expect(later?.top).toBe(640);
        const earlierBottom = (earlier?.top ?? 0) + (earlier?.height ?? 0);
        expect(earlierBottom + 4).toBeLessThanOrEqual(later?.top ?? 0);
        expect(layout.overflow[1].hidden[0].event).toBe(contracts[3]);
    });
    it("merges crowded controls rather than creating overlapping buttons", () => {
        const dense = [contracts[0], event("a", 540, 660), event("b", 545, 665), event("c", 550, 670)];
        const layout = readableTimedLayout(timedPlacements(dense, day), 150);
        expect(layout.overflow).toHaveLength(1);
        expect(layout.overflow[0].hidden).toHaveLength(3);
        const shortAnchor = readableTimedLayout(
            timedPlacements([event("host", 540, 600), event("a", 555, 610), event("b", 585, 615)], day),
            150,
        );

        expect(shortAnchor.overflow).toHaveLength(1);
        expect(shortAnchor.overflow[0].hidden).toHaveLength(2);
        const gaps = readableTimedLayout(
            timedPlacements([event("host", 540, 600), event("a", 545, 550), event("b", 570, 575)], day),
            150,
        );

        expect(gaps.overflow).toHaveLength(1);
        expect(gaps.overflow[0].hidden).toHaveLength(2);
    });
    it("retains exact counts and membership through reorder and resize", () => {
        const placements = timedPlacements(contracts, day);
        const narrow = readableTimedLayout(placements, 150);
        const resized = readableTimedLayout(timedPlacements([...contracts].reverse(), day), 180);
        expect(resized.overflow.map((coverage) => coverage.key)).toEqual(
            narrow.overflow.map((coverage) => coverage.key),
        );
        expect(narrow.overflow.flatMap((coverage) => coverage.hidden.map((item) => item.event.id))).toEqual([
            "orange",
            "amber",
            "review",
        ]);
        expect(readableTimedLayout(placements, 400).overflow).toEqual([]);
    });
});

describe("overnight overflow controls", () => {
    it("splits late controls without creating an empty exclusive-midnight segment", () => {
        const late = [
            event("host", 0, 1440),
            event("a", 1320, 1380),
            event("b", 1365, 1395),
            event("last", 1380, 1440),
        ];
        const layout = readableTimedLayout(timedPlacements(late, day), 150);
        expect(layout.overflow.map((coverage) => coverage.hidden.length)).toEqual([2, 1]);
        expect(layout.overflow[1].end).toEqual(new Date(2026, 9, 10));
        expect(timedPlacements(late, new Date(2026, 9, 10))).toEqual([]);
    });
});
