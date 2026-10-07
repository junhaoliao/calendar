import {act, renderHook} from "@testing-library/react";
import type {DragEndEvent, DragStartEvent} from "@dnd-kit/react";
import {afterEach, describe, expect, it, vi} from "vitest";

import {useCalendarController} from "./use-calendar-controller";
import {CalendarI18nProvider} from "../../i18n/provider";
import type {CalendarActions} from "./calendar-context";
import type {CalendarEvent, EventCalendarProps, NewCalendarEvent} from "./types";

const acceptedEvent = (outcome: ReturnType<CalendarActions["resolveDrag"]>) =>
    outcome?.status === "accepted" ? outcome.event : null;

const day = new Date(2026, 9, 4);
const fixedNow = new Date(2026, 9, 4, 9);
const meeting: CalendarEvent = {
    end: new Date(2026, 9, 4, 11),
    id: "meeting",
    metadata: {source: "host"},
    start: new Date(2026, 9, 4, 10),
    title: "Team Meeting",
};

interface DragOverrides {
    canceled?: boolean;
    nativeType?: string;
    source?: unknown;
    target?: unknown | null;
}

const dragEnd = (overrides: DragOverrides = {}) =>
    ({
        canceled: overrides.canceled ?? false,
        nativeEvent: overrides.nativeType ? {type: overrides.nativeType} : undefined,
        operation: {
            source: overrides.source === undefined ? {data: {event: meeting, anchor: day}} : overrides.source,
            target:
                overrides.target === null
                    ? null
                    : {data: overrides.target ?? {date: new Date(2026, 9, 5), minute: 600}},
        },
    }) as unknown as DragEndEvent;

const dragStart = (overrides: DragOverrides = {}) =>
    ({
        operation: {source: overrides.source === undefined ? {data: {event: meeting, anchor: day}} : overrides.source},
    }) as unknown as DragStartEvent;

const finishDrag = (actions: CalendarActions, overrides: DragOverrides = {}) => {
    actions.beginDrag(dragStart(overrides));
    actions.endDrag(dragEnd(overrides));
};

const renderController = (options: Partial<EventCalendarProps> = {}) =>
    renderHook(
        () =>
            useCalendarController({
                events: [meeting],
                now: fixedNow,
                ...options,
            }),
        {wrapper: CalendarI18nProvider},
    );

const renderWithProps = (props: EventCalendarProps) =>
    renderHook((current: EventCalendarProps) => useCalendarController(current), {
        initialProps: props,
        wrapper: CalendarI18nProvider,
    });

const ignoredMoves: {name: string; input: DragOverrides; readOnly?: boolean}[] = [
    {name: "a canceled drag", input: {canceled: true}},
    {name: "a resize drag", input: {nativeType: "resize"}},
    {name: "a missing target", input: {target: null}},
    {name: "a read-only calendar", input: {}, readOnly: true},
    {name: "a missing source", input: {source: null}},
    {name: "target data without a Date", input: {target: {date: "2026-10-05"}}},
    {name: "an unchanged move", input: {target: {date: day, minute: 600}}},
];

afterEach(() => {
    vi.useRealTimers();
});

describe("useCalendarController", () => {
    it("reports a host reason only once at drop, without a mutation or success", () => {
        const onMoveRejected = vi.fn();
        const onEventUpdate = vi.fn();
        const onNotification = vi.fn();
        const resolver = vi.fn(() => ({reject: "Room is booked"}));
        const {result} = renderController({resolveEventMove: resolver, onMoveRejected, onEventUpdate, onNotification});
        act(() => result.current.actions.beginDrag(dragStart()));
        const target = {date: new Date(2026, 9, 5), minute: 600};
        const preview = result.current.actions.resolveDrag(target);
        expect(preview).toEqual({status: "rejected", reason: "Room is booked"});
        expect(result.current.actions.resolveDrag(target)).toBe(preview);
        expect(onMoveRejected).not.toHaveBeenCalled();
        act(() => result.current.actions.endDrag(dragEnd()));
        expect(resolver).toHaveBeenCalledTimes(1);
        expect(onMoveRejected).toHaveBeenCalledExactlyOnceWith({event: meeting, reason: "Room is booked"});
        const payload = onMoveRejected.mock.calls[0][0];
        expect(payload.event.start).not.toBe(meeting.start);
        expect(payload.event.metadata).toBe(meeting.metadata);
        expect(result.current.rejection).toEqual({reason: "Room is booked"});
        expect(onEventUpdate).not.toHaveBeenCalled();
        expect(onNotification).not.toHaveBeenCalled();
        act(() => result.current.actions.dismissRejection());
        expect(result.current.rejection).toBeNull();
        expect(onMoveRejected).toHaveBeenCalledTimes(1);
    });
    it("caches a thrown policy as rejection and logs it only once for preview and drop", () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        const error = new Error("Host policy bug");
        const onMoveRejected = vi.fn();
        const onEventUpdate = vi.fn();
        const onNotification = vi.fn();
        const resolver = vi.fn(() => {
            throw error;
        });
        const {result} = renderController({resolveEventMove: resolver, onMoveRejected, onEventUpdate, onNotification});
        act(() => result.current.actions.beginDrag(dragStart()));
        expect(result.current.actions.resolveDrag({date: new Date(2026, 9, 5), minute: 600})).toEqual({
            status: "rejected",
            reason: null,
        });
        act(() => result.current.actions.endDrag(dragEnd()));
        expect(resolver).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenCalledExactlyOnceWith("resolveEventMove threw; the move was rejected.", error);
        expect(onMoveRejected).toHaveBeenCalledExactlyOnceWith({event: meeting, reason: null});
        expect(onEventUpdate).not.toHaveBeenCalled();
        expect(onNotification).not.toHaveBeenCalled();
        log.mockRestore();
    });
    it.each(["deleted", "rescheduled", "read-only", "invalid target"])(
        "treats %s as inapplicable, with no rejection",
        (kind) => {
            const onMoveRejected = vi.fn();
            const onEventUpdate = vi.fn();
            const onNotification = vi.fn();
            const resolver = vi.fn(() => null);
            const initial = {
                events: [meeting],
                now: fixedNow,
                resolveEventMove: resolver,
                onMoveRejected,
                onEventUpdate,
                onNotification,
            };
            const {result, rerender} = renderWithProps(initial);
            act(() => result.current.actions.beginDrag(dragStart()));
            if (kind === "deleted") rerender({...initial, events: []});
            if (kind === "rescheduled") rerender({...initial, events: [{...meeting, end: new Date(2026, 9, 4, 12)}]});
            if (kind === "read-only") rerender({...initial, readOnly: true});
            const target = {date: kind === "invalid target" ? new Date(NaN) : new Date(2026, 9, 5), minute: 600};
            expect(result.current.actions.resolveDrag(target)).toBeNull();
            act(() => result.current.actions.endDrag(dragEnd({target})));
            expect(result.current.rejection).toBeNull();
            expect(onMoveRejected).not.toHaveBeenCalled();
            expect(onEventUpdate).not.toHaveBeenCalled();
            expect(onNotification).not.toHaveBeenCalled();
            expect(resolver).not.toHaveBeenCalled();
        },
    );
    it("clears rejection on the next drag without losing the previous success announcement", () => {
        const {result, rerender} = renderWithProps({events: [meeting], now: fixedNow});
        act(() => finishDrag(result.current.actions));
        const announcement = result.current.announcement;
        rerender({events: [meeting], now: fixedNow, resolveEventMove: () => null});
        act(() => finishDrag(result.current.actions));
        expect(result.current.rejection).not.toBeNull();
        expect(result.current.announcement).toBe(announcement);
        act(() => result.current.actions.beginDrag(dragStart()));
        expect(result.current.rejection).toBeNull();
    });
    it("retains concurrent consumer-field replacements on an otherwise stable event object", () => {
        const original = {...meeting};
        const onEventUpdate = vi.fn();
        const initial = {events: [original], now: fixedNow, onEventUpdate};
        const source = {data: {event: original, anchor: day}};
        const {result, rerender} = renderWithProps(initial);
        act(() => result.current.actions.beginDrag(dragStart({source})));
        const before = acceptedEvent(result.current.actions.resolveDrag({date: new Date(2026, 9, 5), minute: 600}));
        original.title = "Concurrent title";
        original.metadata = {source: "current"};
        rerender({...initial, events: [original]});
        const after = acceptedEvent(result.current.actions.resolveDrag({date: new Date(2026, 9, 5), minute: 600}));
        expect(after?.title).toBe("Concurrent title");
        expect(before?.title).toBe(meeting.title);
        act(() => result.current.actions.endDrag(dragEnd({source})));
        expect(onEventUpdate).toHaveBeenCalledExactlyOnceWith(after);
        expect(after?.metadata).toBe(original.metadata);
    });
    it("refreshes preview resolution when the host replaces its policy", () => {
        const first = vi.fn(({defaultResult}) => defaultResult);
        const next = vi.fn(({event}) => ({...event, start: new Date(2026, 9, 5, 16), end: new Date(2026, 9, 5, 16)}));
        const onEventUpdate = vi.fn();
        const initial = {events: [meeting], now: fixedNow, resolveEventMove: first, onEventUpdate};
        const {result, rerender} = renderWithProps(initial);
        act(() => result.current.actions.beginDrag(dragStart()));
        const previousConfig = result.current.config;
        const before = acceptedEvent(result.current.actions.resolveDrag({date: new Date(2026, 9, 5), minute: 600}));
        rerender({...initial, resolveEventMove: next});
        expect(result.current.config).not.toBe(previousConfig);
        const after = acceptedEvent(result.current.actions.resolveDrag({date: new Date(2026, 9, 5), minute: 600}));
        expect(after).not.toEqual(before);
        act(() => result.current.actions.endDrag(dragEnd()));
        expect(onEventUpdate).toHaveBeenCalledExactlyOnceWith(after);
        expect(next).toHaveBeenCalledTimes(1);
    });
    it("commits the exact cached preview once, with the resolved event in both callbacks", () => {
        const onEventUpdate = vi.fn();
        const onNotification = vi.fn();
        const resolveEventMove = vi.fn(({defaultResult}) => ({
            ...defaultResult,
            start: new Date(2026, 9, 5, 12, 7, 30, 123),
            end: new Date(2026, 9, 7, 14, 23, 40, 456),
        }));
        const {result} = renderController({resolveEventMove, onEventUpdate, onNotification});
        act(() => result.current.actions.beginDrag(dragStart()));
        const preview = acceptedEvent(result.current.actions.resolveDrag({date: new Date(2026, 9, 5), minute: 600}));
        expect(onEventUpdate).not.toHaveBeenCalled();
        expect(acceptedEvent(result.current.actions.resolveDrag({date: new Date(2026, 9, 5), minute: 602}))).toBe(
            preview,
        );
        act(() => result.current.actions.endDrag(dragEnd()));
        expect(resolveEventMove).toHaveBeenCalledTimes(1);
        expect(onEventUpdate).toHaveBeenCalledExactlyOnceWith(preview);
        expect(onNotification).toHaveBeenCalledExactlyOnceWith({action: "moved", event: preview});
    });

    it("refreshes consumer data for resolution with the unconverted schedule", () => {
        const resolveEventMove = vi.fn(({event, defaultResult}) => {
            return {...defaultResult, metadata: event.metadata, title: event.title};
        });
        const onEventUpdate = vi.fn();
        const initial = {events: [meeting], now: fixedNow, resolveEventMove, onEventUpdate};
        const {result, rerender} = renderWithProps(initial);
        act(() => result.current.actions.beginDrag(dragStart()));
        acceptedEvent(result.current.actions.resolveDrag({date: new Date(2026, 9, 5), minute: 600}));
        const fresh = {...meeting, title: "Fresh", metadata: {source: "fresh"}};
        rerender({...initial, events: [fresh]});
        const preview = acceptedEvent(result.current.actions.resolveDrag({date: new Date(2026, 9, 5), minute: 600}));
        act(() => result.current.actions.endDrag(dragEnd()));
        expect(resolveEventMove).toHaveBeenCalledTimes(2);
        expect(onEventUpdate).toHaveBeenCalledExactlyOnceWith(preview);
        expect(preview?.metadata).toBe(fresh.metadata);
    });

    it.each(["reject", "cancel", "unchanged"])("does not mutate for a resolved %s move", (mode) => {
        const onEventUpdate = vi.fn();
        const onNotification = vi.fn();
        const onMoveRejected = vi.fn();
        const resolveEventMove = vi.fn(({event, defaultResult}) =>
            mode === "reject" ? null : mode === "unchanged" ? event : defaultResult,
        );
        const {result} = renderController({resolveEventMove, onEventUpdate, onNotification, onMoveRejected});
        act(() => result.current.actions.beginDrag(dragStart()));
        acceptedEvent(result.current.actions.resolveDrag({date: new Date(2026, 9, 5), minute: 600}));
        act(() => result.current.actions.endDrag(dragEnd({canceled: mode === "cancel"})));
        expect(onEventUpdate).not.toHaveBeenCalled();
        expect(onNotification).not.toHaveBeenCalled();
        if (mode === "reject") expect(onMoveRejected).toHaveBeenCalledExactlyOnceWith({event: meeting, reason: null});
        else expect(onMoveRejected).not.toHaveBeenCalled();
        expect(result.current.rejection !== null).toBe(mode === "reject");
    });
    it("endDrag commits a changed move once and reports the updated event", () => {
        const onEventUpdate = vi.fn();
        const onNotification = vi.fn();
        const {result} = renderController({onEventUpdate, onNotification});

        act(() => finishDrag(result.current.actions));

        expect(onEventUpdate).toHaveBeenCalledTimes(1);
        const updated = onEventUpdate.mock.calls[0][0];
        expect(updated).toMatchObject({
            start: new Date(2026, 9, 5, 10),
            end: new Date(2026, 9, 5, 11),
        });
        expect(updated.metadata).toBe(meeting.metadata);
        expect(onNotification).toHaveBeenCalledTimes(1);
        expect(onNotification).toHaveBeenCalledWith({action: "moved", event: updated});
    });

    it.each(ignoredMoves)("endDrag ignores $name", ({input, readOnly}) => {
        const onEventUpdate = vi.fn();
        const onNotification = vi.fn();
        const {result} = renderController({onEventUpdate, onNotification, readOnly});

        act(() => finishDrag(result.current.actions, input));

        expect(onEventUpdate).not.toHaveBeenCalled();
        expect(onNotification).not.toHaveBeenCalled();
    });

    it("moves the latest host title and metadata while keeping the pickup anchor", () => {
        const onEventUpdate = vi.fn();
        const onNotification = vi.fn();
        const initial: EventCalendarProps = {events: [meeting], now: fixedNow, onEventUpdate, onNotification};
        const {result, rerender} = renderWithProps(initial);
        const actions = result.current.actions;
        const metadata = {source: "fresh"};
        const latest = {...meeting, title: "Fresh", metadata};

        act(() => actions.beginDrag(dragStart()));
        rerender({...initial, events: [latest]});
        act(() => actions.endDrag(dragEnd({source: {data: {event: latest, anchor: day}}})));

        expect(onEventUpdate).toHaveBeenCalledTimes(1);
        const updated = onEventUpdate.mock.calls[0][0];
        expect(updated).toMatchObject({title: "Fresh", start: new Date(2026, 9, 5, 10), end: new Date(2026, 9, 5, 11)});
        expect(updated.metadata).toBe(metadata);
        expect(onNotification).toHaveBeenCalledExactlyOnceWith({action: "moved", event: updated});
    });

    it("drops a move when host dates change after pickup, despite refreshed release source data", () => {
        const onEventUpdate = vi.fn();
        const onNotification = vi.fn();
        const initial: EventCalendarProps = {events: [meeting], now: fixedNow, onEventUpdate, onNotification};
        const {result, rerender} = renderWithProps(initial);
        const actions = result.current.actions;
        const latest = {...meeting, end: new Date(2026, 9, 4, 12)};

        act(() => actions.beginDrag(dragStart()));
        rerender({...initial, events: [latest]});
        act(() => actions.endDrag(dragEnd({source: {data: {event: latest, anchor: day}}})));

        expect(onEventUpdate).not.toHaveBeenCalled();
        expect(onNotification).not.toHaveBeenCalled();
    });

    it("drops moves after a type flip, deletion or missing pickup", () => {
        const onEventUpdate = vi.fn();
        const onNotification = vi.fn();
        const initial: EventCalendarProps = {events: [meeting], now: fixedNow, onEventUpdate, onNotification};
        const {result, rerender} = renderWithProps(initial);
        const actions = result.current.actions;

        act(() => actions.endDrag(dragEnd()));
        act(() => actions.beginDrag(dragStart()));
        rerender({...initial, events: [{...meeting, allDay: true}]});
        act(() => actions.endDrag(dragEnd()));
        act(() => actions.beginDrag(dragStart()));
        rerender({...initial, events: []});
        act(() => actions.endDrag(dragEnd()));

        expect(onEventUpdate).not.toHaveBeenCalled();
        expect(onNotification).not.toHaveBeenCalled();
    });

    it("keeps pickup timestamps and anchor immutable when a host mutates Date instances in place", () => {
        const onEventUpdate = vi.fn();
        const onNotification = vi.fn();
        const mutable = {...meeting, start: new Date(meeting.start), end: new Date(meeting.end)};
        const originalAnchor = new Date(day);
        const {result} = renderController({events: [mutable], onEventUpdate, onNotification});
        const actions = result.current.actions;
        const source = {data: {event: mutable, anchor: originalAnchor}};

        act(() => actions.beginDrag(dragStart({source})));
        mutable.end.setHours(12);
        act(() => actions.endDrag(dragEnd({source})));
        expect(onEventUpdate).not.toHaveBeenCalled();
        expect(onNotification).not.toHaveBeenCalled();

        mutable.end.setHours(11);
        act(() => actions.beginDrag(dragStart({source})));
        originalAnchor.setDate(6);
        act(() => actions.endDrag(dragEnd({source})));
        expect(onEventUpdate).toHaveBeenCalledTimes(1);
        expect(onEventUpdate.mock.calls[0][0].start).toEqual(new Date(2026, 9, 5, 10));
        expect(onNotification).toHaveBeenCalledTimes(1);
    });

    it("suppresses a click immediately after a drag", () => {
        vi.useFakeTimers();
        const onEventClick = vi.fn();
        const {result} = renderController({onEventClick});

        act(() => finishDrag(result.current.actions, {canceled: true}));
        act(() => result.current.actions.select(meeting));
        expect(onEventClick).not.toHaveBeenCalled();

        act(() => vi.runAllTimers());
        act(() => result.current.actions.select(meeting));
        expect(onEventClick).toHaveBeenCalledTimes(1);
    });

    it("blocks select and create during resize and briefly after it ends", () => {
        vi.useFakeTimers();
        const onEventClick = vi.fn();
        const onSlotClick = vi.fn();
        const {result} = renderController({onEventClick, onSlotClick});
        const start = new Date(2026, 9, 5, 10);

        act(() => result.current.actions.resizeActive(true));
        act(() => {
            result.current.actions.select(meeting);
            result.current.actions.create(start);
        });
        expect(onEventClick).not.toHaveBeenCalled();
        expect(onSlotClick).not.toHaveBeenCalled();

        act(() => result.current.actions.resizeActive(false));
        act(() => {
            result.current.actions.select(meeting);
            result.current.actions.create(start);
        });
        expect(onEventClick).not.toHaveBeenCalled();
        expect(onSlotClick).not.toHaveBeenCalled();

        act(() => vi.runAllTimers());
        act(() => {
            result.current.actions.select(meeting);
            result.current.actions.create(start);
        });
        expect(onEventClick).toHaveBeenCalledTimes(1);
        expect(onSlotClick).toHaveBeenCalledTimes(1);
    });

    it("commitResize keeps original event data and reports only changed dates", () => {
        const onEventUpdate = vi.fn();
        const onNotification = vi.fn();
        const {result} = renderController({onEventUpdate, onNotification});
        const unchanged = {...meeting, title: "Candidate title"};

        act(() => {
            result.current.actions.commitResize({
                original: {...meeting, id: "unknown"},
                event: {...meeting, id: "unknown", end: new Date(2026, 9, 4, 11, 30)},
                edge: "end",
            });
            result.current.actions.commitResize({original: meeting, event: unchanged, edge: "end"});
        });
        const readOnly = renderController({onEventUpdate, onNotification, readOnly: true});
        act(() =>
            readOnly.result.current.actions.commitResize({
                original: meeting,
                event: {...meeting, end: new Date(2026, 9, 4, 11, 15)},
                edge: "end",
            }),
        );
        expect(onEventUpdate).not.toHaveBeenCalled();
        expect(onNotification).not.toHaveBeenCalled();

        const candidate = {
            ...meeting,
            end: new Date(2026, 9, 4, 11, 30),
            metadata: {source: "candidate"},
            start: new Date(2026, 9, 4, 10, 15),
            title: "Candidate title",
        };
        act(() => result.current.actions.commitResize({original: meeting, event: candidate, edge: "end"}));

        expect(onEventUpdate).toHaveBeenCalledTimes(1);
        const updated = onEventUpdate.mock.calls[0][0];
        expect(updated).toMatchObject({
            end: candidate.end,
            start: meeting.start,
            title: meeting.title,
        });
        expect(updated.metadata).toBe(meeting.metadata);
        expect(onNotification).toHaveBeenCalledTimes(1);
        expect(onNotification).toHaveBeenCalledWith({action: "resized", event: updated});
    });

    it("rebases only a resized start edge onto the latest opposite endpoint and host fields", () => {
        const onEventUpdate = vi.fn();
        const onNotification = vi.fn();
        const metadata = {source: "latest"};
        const latest = {...meeting, end: new Date(2026, 9, 4, 13), title: "Fresh title", metadata};
        const {result} = renderController({events: [latest], onEventUpdate, onNotification});

        act(() =>
            result.current.actions.commitResize({
                original: meeting,
                event: {...meeting, start: new Date(2026, 9, 4, 9), title: "Stale title"},
                edge: "start",
            }),
        );

        expect(onEventUpdate).toHaveBeenCalledTimes(1);
        const updated = onEventUpdate.mock.calls[0][0];
        expect(updated.start).toEqual(new Date(2026, 9, 4, 9));
        expect(updated.end).toBe(latest.end);
        expect(updated.title).toBe("Fresh title");
        expect(updated.metadata).toBe(metadata);
        expect(onNotification).toHaveBeenCalledExactlyOnceWith({action: "resized", event: updated});
    });

    it("ignores Enter without moving the resized edge after a host update", () => {
        const onEventUpdate = vi.fn();
        const onNotification = vi.fn();
        const latest = {...meeting, end: new Date(2026, 9, 4, 13)};
        const {result} = renderController({events: [latest], onEventUpdate, onNotification});
        act(() => result.current.actions.commitResize({original: meeting, event: meeting, edge: "end"}));
        expect(onEventUpdate).not.toHaveBeenCalled();
        expect(onNotification).not.toHaveBeenCalled();
    });

    it.each([
        {name: "inverted", start: new Date(2026, 9, 4, 11, 30), end: new Date(2026, 9, 4, 11, 15)},
        {
            name: "non-inverted but under 15 minutes",
            start: new Date(2026, 9, 4, 11, 10),
            end: new Date(2026, 9, 4, 11, 20),
        },
    ])("drops a $name timed resize against the latest opposite edge", ({start, end}) => {
        const onEventUpdate = vi.fn();
        const onNotification = vi.fn();
        const latest = {...meeting, start, end: new Date(2026, 9, 4, 12)};
        const {result} = renderController({events: [latest], onEventUpdate, onNotification});
        act(() => result.current.actions.commitResize({original: meeting, event: {...meeting, end}, edge: "end"}));
        expect(onEventUpdate).not.toHaveBeenCalled();
        expect(onNotification).not.toHaveBeenCalled();
    });

    it("drops a resized event after a type flip or deletion", () => {
        const onEventUpdate = vi.fn();
        const onNotification = vi.fn();
        const candidate = {...meeting, end: new Date(2026, 9, 4, 11, 30)};
        const flipped = renderController({events: [{...meeting, allDay: true}], onEventUpdate, onNotification});
        act(() => flipped.result.current.actions.commitResize({original: meeting, event: candidate, edge: "end"}));
        const deleted = renderController({events: [], onEventUpdate, onNotification});
        act(() => deleted.result.current.actions.commitResize({original: meeting, event: candidate, edge: "end"}));
        expect(onEventUpdate).not.toHaveBeenCalled();
        expect(onNotification).not.toHaveBeenCalled();
    });

    it("drops an all-day resize inverted by a latest host endpoint", () => {
        const onEventUpdate = vi.fn();
        const onNotification = vi.fn();
        const original = {
            ...meeting,
            allDay: true,
            start: new Date(2026, 9, 4),
            end: new Date(2026, 9, 5, 23, 59, 59, 999),
        };
        const latest = {...original, start: new Date(2026, 9, 8), end: new Date(2026, 9, 9, 23, 59, 59, 999)};
        const {result} = renderController({events: [latest], onEventUpdate, onNotification});
        act(() =>
            result.current.actions.commitResize({
                original,
                event: {...original, end: new Date(2026, 9, 7, 23, 59, 59, 999)},
                edge: "end",
            }),
        );
        expect(onEventUpdate).not.toHaveBeenCalled();
        expect(onNotification).not.toHaveBeenCalled();
    });

    it("creates editable drafts or reports timed slots to the host", () => {
        const start = new Date(2026, 9, 5, 10);
        const onSlotClick = vi.fn();
        const readOnly = renderController({onSlotClick, readOnly: true});
        act(() => readOnly.result.current.actions.create(start));
        expect(onSlotClick).not.toHaveBeenCalled();
        expect(readOnly.result.current.draft).toBeNull();

        const controlled = renderController({onSlotClick});
        act(() => controlled.result.current.actions.create(start, false));
        expect(onSlotClick).toHaveBeenCalledTimes(1);
        expect(onSlotClick).toHaveBeenCalledWith({
            allDay: false,
            end: new Date(2026, 9, 5, 11),
            start,
        });

        const editable = renderController();
        act(() => editable.result.current.actions.create(start));
        const draft = editable.result.current.draft;
        expect(draft?.mode).toBe("create");
        if (draft?.mode !== "create") {
            throw new Error("Expected a create-mode draft");
        }
        expect(draft.event).toMatchObject({
            end: new Date(2026, 9, 5, 11),
            start,
            title: "",
        });
        expect("id" in draft.event).toBe(false);
    });

    it("gives the host click callback precedence over read-only draft handling", () => {
        const onEventClick = vi.fn();
        const controlled = renderController({onEventClick, readOnly: true});
        act(() => controlled.result.current.actions.select(meeting));
        expect(onEventClick).toHaveBeenCalledExactlyOnceWith(meeting);
        expect(controlled.result.current.draft).toBeNull();

        const readOnly = renderController({readOnly: true});
        act(() => readOnly.result.current.actions.select(meeting));
        expect(readOnly.result.current.draft).toBeNull();

        const editable = renderController();
        act(() => editable.result.current.actions.select(meeting));
        expect(editable.result.current.draft).toEqual({mode: "edit", event: meeting});
    });

    it("supports controlled and uncontrolled date and view navigation", () => {
        const nextDate = new Date(2026, 9, 5);
        const onDateChange = vi.fn();
        const controlledDate = renderController({date: day, onDateChange});
        act(() => controlledDate.result.current.actions.changeDate(nextDate));
        expect(onDateChange).toHaveBeenCalledExactlyOnceWith(nextDate);
        expect(controlledDate.result.current.date).toBe(day);

        const uncontrolledDate = renderController({initialDate: day});
        act(() => uncontrolledDate.result.current.actions.changeDate(nextDate));
        expect(uncontrolledDate.result.current.date).toBe(nextDate);

        const onViewChange = vi.fn();
        const controlledView = renderController({onViewChange, view: "week"});
        act(() => controlledView.result.current.actions.changeView("day"));
        expect(onViewChange).toHaveBeenCalledExactlyOnceWith("day");
        expect(controlledView.result.current.view).toBe("week");

        const uncontrolledView = renderController({initialView: "week"});
        act(() => uncontrolledView.result.current.actions.changeView("day"));
        expect(uncontrolledView.result.current.view).toBe("day");
    });

    it("installs a clock interval only when now is uncontrolled", () => {
        vi.useFakeTimers();
        const fixed = renderController({now: fixedNow});
        expect(vi.getTimerCount()).toBe(0);
        fixed.unmount();

        const dynamic = renderController({now: undefined});
        const previousNow = dynamic.result.current.now;
        act(() => vi.advanceTimersByTime(60000));
        expect(dynamic.result.current.now).not.toBe(previousNow);
        dynamic.unmount();
    });

    it("keeps command identities and uses the latest callbacks and event data", () => {
        vi.useFakeTimers();
        vi.setSystemTime(fixedNow);
        const firstUpdate = vi.fn();
        const nextUpdate = vi.fn();
        const nextMetadata = {source: "latest"};
        const nextEvent = {...meeting, metadata: nextMetadata};
        const initialProps: EventCalendarProps = {events: [meeting], onEventUpdate: firstUpdate};
        const {result, rerender, unmount} = renderHook((props: EventCalendarProps) => useCalendarController(props), {
            initialProps: initialProps,
            wrapper: CalendarI18nProvider,
        });
        const actions = result.current.actions;
        const config = result.current.config;

        try {
            act(() => vi.advanceTimersByTime(60000));
            expect(result.current.actions).toBe(actions);
            expect(result.current.config).toBe(config);

            rerender({...initialProps, events: [nextEvent], onEventUpdate: nextUpdate});
            expect(result.current.actions).toBe(actions);
            expect(result.current.config).toBe(config);

            const candidate = {
                ...nextEvent,
                end: new Date(2026, 9, 4, 11, 30),
                start: new Date(2026, 9, 4, 10, 15),
            };
            act(() => actions.commitResize({original: meeting, event: candidate, edge: "end"}));

            expect(firstUpdate).not.toHaveBeenCalled();
            expect(nextUpdate).toHaveBeenCalledTimes(1);
            expect(nextUpdate.mock.calls[0][0].metadata).toBe(nextMetadata);
        } finally {
            unmount();
            vi.useRealTimers();
        }
    });

    it("tracks controlled and uncontrolled navigation through stable actions", () => {
        const initialProps: EventCalendarProps = {
            events: [],
            initialDate: day,
            initialView: "week",
            now: fixedNow,
        };
        const {result, rerender} = renderHook((props: EventCalendarProps) => useCalendarController(props), {
            initialProps: initialProps,
            wrapper: CalendarI18nProvider,
        });
        const actions = result.current.actions;
        const localDate = new Date(2026, 9, 5);

        act(() => {
            actions.changeDate(localDate);
            actions.changeView("day");
        });
        expect(result.current.date).toBe(localDate);
        expect(result.current.view).toBe("day");

        const controlledDate = new Date(2026, 9, 6);
        const onDateChange = vi.fn();
        const onViewChange = vi.fn();
        rerender({...initialProps, date: controlledDate, view: "month", onDateChange, onViewChange});
        expect(result.current.actions).toBe(actions);
        const requestedDate = new Date(2026, 9, 7);
        act(() => {
            actions.changeDate(requestedDate);
            actions.changeView("agenda");
        });
        expect(onDateChange).toHaveBeenCalledExactlyOnceWith(requestedDate);
        expect(onViewChange).toHaveBeenCalledExactlyOnceWith("agenda");
        expect(result.current.date).toBe(controlledDate);
        expect(result.current.view).toBe("month");

        rerender(initialProps);
        const nextLocalDate = new Date(2026, 9, 8);
        act(() => {
            actions.changeDate(nextLocalDate);
            actions.changeView("agenda");
        });
        expect(result.current.date).toBe(nextLocalDate);
        expect(result.current.view).toBe("agenda");
    });

    it("routes draft mutations once and blocks them under the current readOnly setting", () => {
        const onEventAdd = vi.fn();
        const onEventUpdate = vi.fn();
        const onEventDelete = vi.fn();
        const onNotification = vi.fn();
        const props: EventCalendarProps = {
            events: [meeting],
            now: fixedNow,
            onEventAdd: onEventAdd,
            onEventDelete: onEventDelete,
            onEventUpdate: onEventUpdate,
            onNotification: onNotification,
        };
        const {result, rerender} = renderHook((nextProps: EventCalendarProps) => useCalendarController(nextProps), {
            initialProps: props,
            wrapper: CalendarI18nProvider,
        });
        const actions = result.current.actions;
        const newEvent: NewCalendarEvent = {
            end: new Date(2026, 9, 5, 11),
            start: new Date(2026, 9, 5, 10),
            title: "New event",
        };

        act(() => actions.addDraft(newEvent));
        expect(onEventAdd).toHaveBeenCalledExactlyOnceWith(newEvent);
        expect(onNotification.mock.calls[0][0]).toEqual({action: "added", event: newEvent});

        const updatedEvent = {...meeting, title: "Updated meeting"};
        act(() => actions.updateDraft(updatedEvent));
        expect(onEventUpdate).toHaveBeenCalledExactlyOnceWith(updatedEvent);
        expect(onNotification.mock.calls[1][0]).toEqual({action: "updated", event: updatedEvent});

        act(() => actions.select(meeting));
        expect(result.current.draft?.mode).toBe("edit");
        act(() => actions.deleteDraft(meeting.id));
        expect(onEventDelete).toHaveBeenCalledExactlyOnceWith(meeting.id);
        expect(onNotification.mock.calls[2][0]).toEqual({action: "deleted", event: meeting});

        rerender({...props, readOnly: true});
        act(() => actions.closeDraft());
        act(() => actions.select(meeting));
        act(() => {
            actions.addDraft(newEvent);
            actions.updateDraft(updatedEvent);
            actions.deleteDraft(meeting.id);
            actions.create(new Date(2026, 9, 7, 10));
        });
        expect(result.current.draft).toBeNull();
        expect(onEventAdd).toHaveBeenCalledTimes(1);
        expect(onEventUpdate).toHaveBeenCalledTimes(1);
        expect(onEventDelete).toHaveBeenCalledTimes(1);
        expect(onNotification).toHaveBeenCalledTimes(3);
    });
});
