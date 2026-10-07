import {describe, expect, it} from "vitest";

import {timedResizeTarget, wallMinutesAtY, withinVisibleRange} from "./resize-target";

const day = new Date(2026, 9, 4);
const box = {day, top: 100};

describe("resize target geometry", () => {
    it("maps the top, nearest quarter-hour, and bottom of a column", () => {
        expect(timedResizeTarget(box, 100, 0)).toEqual(new Date(2026, 9, 4));
        expect(wallMinutesAtY(100, 124, 0)).toBe(22.5);
        expect(timedResizeTarget(box, 124, 0)).toEqual(new Date(2026, 9, 4, 0, 30));
        expect(timedResizeTarget(box, 2000, 0)).toEqual(new Date(2026, 9, 5));
    });

    it("subtracts the pointer grab offset", () => {
        expect(timedResizeTarget(box, 132, 12)).toEqual(new Date(2026, 9, 4, 0, 15));
    });

    it("uses local wall-clock minutes on a daylight-saving transition date", () => {
        const dstDay = new Date(2026, 2, 8);
        expect(timedResizeTarget({day: dstDay, top: 0}, 8 * 64, 0)).toEqual(new Date(2026, 2, 8, 8));
    });

    it("honors inclusive and exclusive visible range endpoints", () => {
        const first = new Date(2026, 9, 4);
        const last = new Date(2026, 9, 10);
        expect(withinVisibleRange(new Date(2026, 9, 3, 23, 45), first, last, false)).toBe(false);
        expect(withinVisibleRange(first, first, last, false)).toBe(true);
        expect(withinVisibleRange(first, first, last, true)).toBe(true);
        expect(withinVisibleRange(new Date(2026, 9, 10, 23, 45), first, last, false)).toBe(true);
        expect(withinVisibleRange(new Date(2026, 9, 10, 23, 45), first, last, true)).toBe(true);
        expect(withinVisibleRange(new Date(2026, 9, 11), first, last, false)).toBe(true);
        expect(withinVisibleRange(new Date(2026, 9, 11), first, last, true)).toBe(false);
        expect(withinVisibleRange(new Date(2026, 9, 11, 0, 15), first, last, false)).toBe(false);
    });
});
