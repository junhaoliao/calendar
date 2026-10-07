import {describe, expect, it, vi} from "vitest";
import {format} from "date-fns";
import {fr} from "date-fns/locale/fr";
import {enUS} from "date-fns/locale/en-US";

import {eventDetailRange} from "./event-details";
import type {CalendarEvent} from "./types";

const event: CalendarEvent = {
    end: new Date(2026, 9, 5, 13),
    id: "details",
    start: new Date(2026, 9, 5, 12),
    title: "Event details",
};

const englishOptions = {
    locale: enUS,
    allDayLabel: "All day",
    allDayRange: (start: string, end: string) => `${start} – ${end} · All day`,
    patterns: {day: "MMM d", time: "h:mm a", dateTime: "MMM d h:mm a"},
};
const frenchOptions = {
    locale: fr,
    allDayLabel: "Toute la journée",
    allDayRange: (start: string, end: string) => `${start} – ${end} · Toute la journée`,
    patterns: {day: "PP", time: "p", dateTime: "PP p"},
};

describe("popover full ranges", () => {
    it("omits repeated dates for same-day events", () => {
        expect(eventDetailRange(event, englishOptions)).toBe("12:00 PM – 1:00 PM");
    });
    it("includes both dates across midnight", () => {
        expect(
            eventDetailRange({...event, start: new Date(2026, 9, 5, 22), end: new Date(2026, 9, 6, 2)}, englishOptions),
        ).toBe("Oct 5 10:00 PM – Oct 6 2:00 AM");
    });
    it("labels single-day and multi-day all-day events", () => {
        expect(eventDetailRange({...event, allDay: true}, englishOptions)).toBe("All day");
        expect(eventDetailRange({...event, allDay: true, end: new Date(2026, 9, 7, 23, 59)}, englishOptions)).toBe(
            "Oct 5 – Oct 7 · All day",
        );
    });
    it("honors a supplied localized all-day label and full-sentence callback across dates", () => {
        const spanning = {...event, allDay: true, end: new Date(2026, 9, 7, 23, 59)};
        const start = format(spanning.start, "PP", {locale: fr});
        const end = format(spanning.end, "PP", {locale: fr});
        expect(eventDetailRange(spanning, {...frenchOptions, ...{locale: fr, allDayLabel: "Toute la journée"}})).toBe(
            `${start} – ${end} · Toute la journée`,
        );
        const wholeSentence = vi.fn((from: string, to: string) => `${to} après ${from}`);
        expect(
            eventDetailRange(spanning, {
                ...frenchOptions,
                ...{locale: fr, allDayLabel: "Toute la journée", allDayRange: wholeSentence},
            }),
        ).toBe(`${end} après ${start}`);
        expect(wholeSentence).toHaveBeenCalledExactlyOnceWith(start, end);
    });
});
