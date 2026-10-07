import {act, renderHook} from "@testing-library/react";
import {startOfDay} from "date-fns";
import {describe, expect, it, vi} from "vitest";

import {lastOccupiedDay} from "../../core/dates";
import {CalendarI18nProvider} from "../../i18n/provider";
import {useEventDraft} from "./use-event-draft";
import type {CalendarEvent, EventDraft, NewCalendarEvent} from "./types";

type Draft = ReturnType<typeof useEventDraft>;

const offGridEvent: CalendarEvent = {
    end: new Date(2026, 9, 5, 10, 37, 45),
    id: "off-grid",
    start: new Date(2026, 9, 5, 10, 7, 30, 250),
    title: "Original title",
};

const importedAllDay: CalendarEvent = {
    allDay: true,
    end: new Date(2026, 9, 5, 17, 37, 45, 123),
    id: "imported",
    start: new Date(2026, 9, 4, 9, 7, 30, 250),
    title: "Imported event",
};

const saveWith = (event: CalendarEvent | NewCalendarEvent, mode: EventDraft["mode"], edit?: (draft: Draft) => void) => {
    const onSave = vi.fn();
    const {result} = renderHook(() => useEventDraft(event, onSave, mode), {wrapper: CalendarI18nProvider});

    if (edit) {
        act(() => edit(result.current));
    }
    act(() => result.current.save());

    const call = onSave.mock.calls[0];
    if (!call) {
        throw new Error("Expected a valid draft to save");
    }

    return call[0];
};

describe("useEventDraft", () => {
    it("preserves off-grid timed endpoints when the fields are untouched", () => {
        const saved = saveWith(offGridEvent, "edit");

        expect(saved.start.getTime()).toBe(offGridEvent.start.getTime());
        expect(saved.end.getTime()).toBe(offGridEvent.end.getTime());
        expect(saved.start).toBe(offGridEvent.start);
        expect(saved.end).toBe(offGridEvent.end);
    });

    it("preserves both endpoints when only the title changes", () => {
        const saved = saveWith(offGridEvent, "edit", (draft) => draft.setTitle("Renamed"));

        expect(saved.title).toBe("Renamed");
        expect(saved.start).toBe(offGridEvent.start);
        expect(saved.end).toBe(offGridEvent.end);
    });

    it("preserves the untouched end when the start time changes", () => {
        const saved = saveWith(offGridEvent, "edit", (draft) => draft.setStartMinute(9 * 60));

        expect(saved.start).toEqual(new Date(2026, 9, 5, 9));
        expect(saved.end).toBe(offGridEvent.end);
    });

    it("converts an exclusive-midnight timed end to its last occupied all-day date", () => {
        const timed: CalendarEvent = {
            end: new Date(2026, 9, 6),
            id: "midnight",
            start: new Date(2026, 9, 5, 22),
            title: "Overnight",
        };
        const saved = saveWith(timed, "edit", (draft) => draft.setAllDay(true));

        expect(saved.allDay).toBe(true);
        expect(saved.start).toEqual(new Date(2026, 9, 5));
        expect(saved.end).toEqual(new Date(2026, 9, 5, 23, 59, 59, 999));
    });

    it("clears all-day on a one-day event without moving its end to the next day", () => {
        const oneDay: CalendarEvent = {
            allDay: true,
            end: new Date(2026, 9, 4, 23, 59, 59, 999),
            id: "all-day",
            start: new Date(2026, 9, 4),
            title: "One day",
        };
        const saved = saveWith(oneDay, "edit", (draft) => draft.setAllDay(false));

        expect(saved.allDay).toBe(false);
        expect(saved.start).toEqual(new Date(2026, 9, 4));
        expect(saved.end).toEqual(new Date(2026, 9, 4, 23, 59, 59, 999));
    });

    it("preserves multi-day all-day endpoints and occupied dates when switching to timed", () => {
        const multiDay: CalendarEvent = {
            allDay: true,
            end: new Date(2026, 9, 6, 23, 59, 59, 999),
            id: "multi-day",
            start: new Date(2026, 9, 4),
            title: "Several days",
        };
        const saved = saveWith(multiDay, "edit", (draft) => draft.setAllDay(false));

        expect(saved.start).toEqual(new Date(2026, 9, 4));
        expect(saved.end).toEqual(new Date(2026, 9, 6, 23, 59, 59, 999));
        expect(lastOccupiedDay(saved)).toEqual(new Date(2026, 9, 6));
    });

    it("keeps absent optional text and color fields absent", () => {
        const minimal: CalendarEvent = {
            end: new Date(2026, 9, 5, 11),
            id: "minimal",
            start: new Date(2026, 9, 5, 10),
            title: "Minimal event",
        };
        const saved = saveWith(minimal, "edit");

        expect("description" in saved).toBe(false);
        expect("location" in saved).toBe(false);
        expect("color" in saved).toBe(false);
    });

    it("preserves an explicit clear of an existing optional field", () => {
        const described = {...offGridEvent, description: "x"};
        const saved = saveWith(described, "edit", (draft) => draft.setDescription(""));

        expect("description" in saved).toBe(true);
        expect(saved.description).toBe("");
    });

    it("preserves metadata by reference and retains extra host fields", () => {
        const metadata = {source: "host"};
        const hosted = {...offGridEvent, metadata, projectId: "p1"};
        const saved = saveWith(hosted, "edit");

        expect(saved.metadata).toBe(metadata);
        expect(saved.projectId).toBe("p1");
    });

    it("preserves noncanonical imported all-day endpoints on a title-only edit", () => {
        const saved = saveWith(importedAllDay, "edit", (draft) => draft.setTitle("Renamed import"));

        expect(saved.title).toBe("Renamed import");
        expect(saved.start.getTime()).toBe(importedAllDay.start.getTime());
        expect(saved.end.getTime()).toBe(importedAllDay.end.getTime());
        expect(saved.start).toBe(importedAllDay.start);
        expect(saved.end).toBe(importedAllDay.end);
    });

    it("normalizes only the changed all-day end date", () => {
        const saved = saveWith(importedAllDay, "edit", (draft) => draft.setEndDate(new Date(2026, 9, 6)));

        expect(saved.start).toBe(importedAllDay.start);
        expect(saved.end).toEqual(new Date(2026, 9, 6, 23, 59, 59, 999));
    });

    it("normalizes only the changed all-day start date", () => {
        const saved = saveWith(importedAllDay, "edit", (draft) => draft.setStartDate(new Date(2026, 9, 5)));

        expect(saved.start).toEqual(new Date(2026, 9, 5));
        expect(saved.end).toBe(importedAllDay.end);
    });

    it("normalizes a new all-day draft to local day boundaries", () => {
        const newAllDay: NewCalendarEvent = {
            allDay: true,
            end: new Date(2026, 9, 4, 10),
            start: new Date(2026, 9, 4, 9),
            title: "New all-day event",
        };
        const saved = saveWith(newAllDay, "create");

        expect(saved.start).toEqual(new Date(2026, 9, 4));
        expect(saved.end).toEqual(new Date(2026, 9, 4, 23, 59, 59, 999));
    });

    it("defaults an imported all-day event to midnight and end of day when converted to timed", () => {
        const onSave = vi.fn();
        const {result} = renderHook(() => useEventDraft(importedAllDay, onSave, "edit"), {
            wrapper: CalendarI18nProvider,
        });

        act(() => result.current.setAllDay(false));
        expect(result.current.startMinute).toBe(0);
        expect(result.current.endMinute).toBe(1439);
        act(() => result.current.save());

        const saved = onSave.mock.calls[0][0];
        expect(saved.allDay).toBe(false);
        expect(saved.start).toEqual(new Date(2026, 9, 4));
        expect(saved.end).toEqual(new Date(2026, 9, 5, 23, 59, 59, 999));
    });

    it("uses an edited timed end date when converting the effective draft to all-day", () => {
        const timed: CalendarEvent = {
            end: new Date(2026, 9, 6),
            id: "edited-overnight",
            start: new Date(2026, 9, 5, 22),
            title: "Edited overnight",
        };
        const saved = saveWith(timed, "edit", (draft) => {
            draft.setEndMinute(2 * 60);
            draft.setAllDay(true);
        });

        expect(saved.allDay).toBe(true);
        expect(saved.start).toEqual(new Date(2026, 9, 5));
        expect(saved.end).toEqual(new Date(2026, 9, 6, 23, 59, 59, 999));
    });

    it("shows the inclusive last occupied date when switching a midnight-ended timed event to all-day", () => {
        const timed = {...offGridEvent, start: new Date(2026, 9, 5, 22), end: new Date(2026, 9, 6)};
        const {result} = renderHook(() => useEventDraft(timed, vi.fn(), "edit"), {wrapper: CalendarI18nProvider});
        act(() => result.current.setAllDay(true));
        expect(result.current.endDate.toDateString()).toBe(new Date(2026, 9, 5).toDateString());
    });

    it("keeps an end date explicitly picked in all-day mode inclusive", () => {
        const timed = {...offGridEvent, start: new Date(2026, 9, 5, 22), end: new Date(2026, 9, 6)};
        const onSave = vi.fn();
        const {result} = renderHook(() => useEventDraft(timed, onSave, "edit"), {wrapper: CalendarI18nProvider});
        act(() => result.current.setAllDay(true));
        act(() => result.current.setEndDate(new Date(2026, 9, 8)));
        expect(result.current.endDate.toDateString()).toBe(new Date(2026, 9, 8).toDateString());
        act(() => result.current.save());
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave.mock.calls[0][0].end).toEqual(new Date(2026, 9, 8, 23, 59, 59, 999));
    });

    it("uses a timed end-date edit's occupied day before switching to all-day", () => {
        const timed = {...offGridEvent, start: new Date(2026, 9, 5, 22), end: new Date(2026, 9, 6)};
        const onSave = vi.fn();
        const {result} = renderHook(() => useEventDraft(timed, onSave, "edit"), {wrapper: CalendarI18nProvider});
        act(() => result.current.setEndDate(new Date(2026, 9, 8)));
        act(() => result.current.setAllDay(true));
        expect(result.current.endDate.toDateString()).toBe(new Date(2026, 9, 7).toDateString());
        act(() => result.current.save());
        expect(onSave.mock.calls[0][0].end).toEqual(new Date(2026, 9, 7, 23, 59, 59, 999));
    });

    it("keeps an all-day end pick through toggles until a later explicit timed edit", () => {
        const timed = {...offGridEvent, start: new Date(2026, 9, 5, 22), end: new Date(2026, 9, 6, 10)};
        const onSave = vi.fn();
        const {result} = renderHook(() => useEventDraft(timed, onSave, "edit"), {wrapper: CalendarI18nProvider});
        act(() => result.current.setAllDay(true));
        act(() => result.current.setEndDate(new Date(2026, 9, 8)));
        act(() => result.current.setAllDay(false));
        act(() => result.current.setAllDay(true));
        expect(result.current.endDate.toDateString()).toBe(new Date(2026, 9, 8).toDateString());
        act(() => result.current.setAllDay(false));
        act(() => result.current.setEndMinute(0));
        act(() => result.current.setAllDay(true));
        expect(result.current.endDate.toDateString()).toBe(new Date(2026, 9, 7).toDateString());
        act(() => result.current.save());
        expect(onSave.mock.calls[0][0].end).toEqual(new Date(2026, 9, 7, 23, 59, 59, 999));
    });

    it("pushes an all-day end date forward when the start date moves beyond the displayed end", () => {
        const timed = {...offGridEvent, start: new Date(2026, 9, 5, 22), end: new Date(2026, 9, 6)};
        const onSave = vi.fn();
        const {result} = renderHook(() => useEventDraft(timed, onSave, "edit"), {wrapper: CalendarI18nProvider});
        act(() => result.current.setAllDay(true));
        const newStart = new Date(2026, 9, 8);
        expect(result.current.endDate.toDateString()).toBe(new Date(2026, 9, 5).toDateString());
        act(() => {
            result.current.setStartDate(newStart);
            // Match the editor's start-date onChange: its comparison uses the returned inclusive date.
            if (startOfDay(result.current.endDate) < newStart) result.current.setEndDate(newStart);
        });
        expect(result.current.endDate.toDateString()).toBe(newStart.toDateString());
        act(() => result.current.save());
        expect(onSave.mock.calls[0][0]).toMatchObject({start: newStart, end: new Date(2026, 9, 8, 23, 59, 59, 999)});
    });

    it("substitutes blank titles and preserves non-blank title spacing", () => {
        const blank = saveWith({...offGridEvent, title: "   "}, "edit");
        expect(blank.title).toBe("(no title)");

        const exactTitle = "  Keep these spaces  ";
        const spaced = saveWith({...offGridEvent, title: exactTitle}, "edit");
        expect(spaced.title).toBe(exactTitle);
    });

    it("rejects an end before the start date and reports the validation error", () => {
        const onSave = vi.fn();
        const {result} = renderHook(() => useEventDraft(offGridEvent, onSave, "edit"), {wrapper: CalendarI18nProvider});

        act(() => result.current.setEndMinute(9 * 60));
        act(() => result.current.save());

        expect(result.current.error).toBe("End date cannot be before start date");
        expect(onSave).not.toHaveBeenCalled();
    });

    it("allows an end equal to the start", () => {
        const onGrid: CalendarEvent = {
            end: new Date(2026, 9, 5, 11),
            id: "equal-end",
            start: new Date(2026, 9, 5, 10),
            title: "Equal end",
        };
        const saved = saveWith(onGrid, "edit", (draft) => draft.setEndMinute(10 * 60));

        expect(saved.start).toEqual(new Date(2026, 9, 5, 10));
        expect(saved.end).toEqual(new Date(2026, 9, 5, 10));
    });

    it("creates a non-empty accessible id prefix", () => {
        const {result} = renderHook(() => useEventDraft(offGridEvent, vi.fn(), "edit"), {
            wrapper: CalendarI18nProvider,
        });

        expect(result.current.prefix).toEqual(expect.any(String));
        expect(result.current.prefix.length).toBeGreaterThan(0);
    });
});
