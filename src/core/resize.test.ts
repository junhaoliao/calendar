import {describe, expect, it} from "vitest";
import {resizeEvent} from "./resize";

const event = {
    id: "meeting:a|b]",
    title: "Meeting",
    allDay: false,
    start: new Date(2026, 9, 5, 9, 7),
    end: new Date(2026, 9, 5, 10, 37),
    metadata: {project: "calendar"},
};

describe("endpoint resizing", () => {
    it("snaps only the changed endpoint and preserves identity/metadata and the other instant", () => {
        const result = resizeEvent(event, "start", new Date(2026, 9, 5, 9, 22));
        expect(result.start).toEqual(new Date(2026, 9, 5, 9, 15));
        expect(result.end).toBe(event.end);
        expect(result.metadata).toBe(event.metadata);
        expect(result.id).toBe(event.id);
        expect(result.allDay).toBe(false);
        expect(event.start.getMinutes()).toBe(7);
    });
    it("clamps without swapping edges, even with an off-grid fixed endpoint", () => {
        expect(resizeEvent(event, "start", new Date(2026, 9, 6)).start).toEqual(new Date(2026, 9, 5, 10, 15));
        expect(resizeEvent(event, "end", new Date(2026, 9, 4)).end).toEqual(new Date(2026, 9, 5, 9, 30));
    });
    it("extends across midnight while preserving the opposite endpoint", () => {
        const overnight = {...event, start: new Date(2026, 9, 5, 22), end: new Date(2026, 9, 6, 2)};
        const result = resizeEvent(overnight, "end", new Date(2026, 9, 7, 0));
        expect(result.start).toBe(overnight.start);
        expect(result.end).toEqual(new Date(2026, 9, 7));
        expect(result.allDay).toBe(false);
    });
    it("uses inclusive dates and a minimum of one date for all-day events", () => {
        const allDay = {...event, allDay: true};
        expect(resizeEvent(allDay, "end", new Date(2026, 9, 4)).end).toEqual(new Date(2026, 9, 5, 23, 59, 59, 999));
        expect(resizeEvent(allDay, "start", new Date(2026, 9, 8)).start).toEqual(new Date(2026, 9, 5));
    });
    it("date-only timed resizing retains wall-clock times and exclusive midnight coverage", () => {
        const midnight = {...event, start: new Date(2026, 9, 5, 22, 7), end: new Date(2026, 9, 6)};
        expect(resizeEvent(midnight, "end", new Date(2026, 9, 6), true).end).toEqual(new Date(2026, 9, 7));
        expect(resizeEvent(midnight, "start", new Date(2026, 9, 7), true).start).toEqual(midnight.start);
    });
    it("retains an explicit repeated-hour occurrence when snapping a DST instant", () => {
        const later = new Date("2026-11-01T01:22:00-05:00");
        const earlier = new Date("2026-11-01T01:00:00-04:00");
        const result = resizeEvent({...event, start: earlier, end: later}, "end", later);
        expect(result.end.getTime()).toBe(new Date("2026-11-01T01:15:00-05:00").getTime());
        expect(result.start).toBe(earlier);
    });
});
