import {describe, expect, it} from "vitest";

import {moveEvent} from "../../core/move";
import {eventDragStyle} from "./event-drag-style";
import type {CalendarEvent} from "./types";

const day = new Date(2026, 9, 5);
const event: CalendarEvent = {
    end: new Date(2026, 9, 5, 13),
    id: "preview",
    start: new Date(2026, 9, 5, 12),
    title: "Preview",
};

describe("shared grid and popup drag geometry", () => {
    it("sizes conversions with configured duration and destination width", () => {
        const converted = moveEvent({...event, allDay: true}, day, {date: day, minute: 840}, 90);
        expect(eventDragStyle(converted, day, {width: 300}, 153)).toMatchObject({
            height: 96,
            width: 149,
        });
    });
    it("clears overflow label padding when a timed card becomes a compact all-day bar", () => {
        const original = {opacity: 0.8, paddingBottom: 28, paddingRight: 32};
        const converted = moveEvent(event, day, {date: day, allDay: true});
        expect(eventDragStyle(converted, day, original)).toMatchObject({
            height: 24,
            opacity: 0.8,
            paddingBottom: "",
            paddingRight: "",
        });
        expect(original).toEqual({opacity: 0.8, paddingBottom: 28, paddingRight: 32});
    });
    it("keeps full-range feedback readable across midnight", () => {
        const overnight = {...event, start: new Date(2026, 9, 5, 23, 45), end: new Date(2026, 9, 6, 2)};

        expect(eventDragStyle(overnight, day, {})).toMatchObject({height: 48});
        expect(eventDragStyle(overnight, new Date(2026, 9, 6), {})).toMatchObject({height: 128});
    });
    it("keeps short feedback proportional and safe outside its segment date", () => {
        const brief = {...event, end: new Date(2026, 9, 5, 12, 15)};
        expect(eventDragStyle(brief, day, {})).toMatchObject({height: 16});
        expect(eventDragStyle(brief, new Date(2026, 9, 6), {}, 2)).toMatchObject({
            height: 16,
            width: 1,
        });
    });
});
