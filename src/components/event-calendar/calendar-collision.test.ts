import {pointerIntersection} from "@dnd-kit/collision";
import {afterEach, describe, expect, it, vi} from "vitest";

import {calendarCollision} from "./calendar-collision";

vi.mock("@dnd-kit/collision", () => ({pointerIntersection: vi.fn()}));

const input = {dragOperation: {position: {current: {x: 20, y: 30}}}} as Parameters<typeof pointerIntersection>[0];

afterEach(() => vi.restoreAllMocks());

describe("visible calendar drop targeting", () => {
    it("chooses the sticky all-day target rather than a timed slot underneath it", () => {
        const band = document.createElement("div");
        const underneath = document.createElement("div");
        band.dataset.slot = "calendar-drop";
        underneath.dataset.slot = "calendar-drop";
        const stack = vi.fn(() => [band, underneath]);

        Object.defineProperty(document, "elementsFromPoint", {configurable: true, value: stack});
        const result = {id: "band", value: 1, priority: 0, type: 0};
        vi.mocked(pointerIntersection).mockReturnValue(result);
        expect(calendarCollision(input, band)).toBe(result);
        expect(calendarCollision(input, underneath)).toBeNull();
    });
    it("ignores the promoted drag surface but rejects headers and outside drops", () => {
        const slot = document.createElement("div");
        slot.dataset.slot = "calendar-drop";
        const promoted = document.createElement("button");
        promoted.dataset.dndDragging = "true";
        const elements = vi.fn<() => Element[]>(() => [promoted, slot]);

        Object.defineProperty(document, "elementsFromPoint", {configurable: true, value: elements});
        const result = {id: "slot", value: 1, priority: 0, type: 0};
        vi.mocked(pointerIntersection).mockReturnValue(result);
        expect(calendarCollision(input, slot)).toBe(result);
        elements.mockReturnValue([document.createElement("header")]);
        expect(calendarCollision(input, slot)).toBeNull();
        vi.mocked(pointerIntersection).mockReturnValue(null);
        expect(calendarCollision(input, slot)).toBeNull();
    });
});
