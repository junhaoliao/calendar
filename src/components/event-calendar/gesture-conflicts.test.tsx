import {act, render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {DragDropProvider, useDragDropManager, useDraggable, useDroppable} from "@dnd-kit/react";
import {describe, expect, it, vi} from "vitest";

vi.hoisted(() => {
    document.elementFromPoint = () => null;
    globalThis.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
            return [];
        }
    } as unknown as typeof IntersectionObserver;
    globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    } as unknown as typeof ResizeObserver;
});

import {CalendarI18nProvider} from "../../i18n/provider";
import {EventCalendar} from "../../event-calendar";
import {useCalendarController} from "./use-calendar-controller";
import type {CalendarEvent} from "./types";

const day = new Date(2026, 9, 4);
const meeting: CalendarEvent = {
    id: "meeting",
    title: "Original",
    start: new Date(2026, 9, 4, 10),
    end: new Date(2026, 9, 4, 11),
    metadata: {source: "initial"},
};
type Manager = NonNullable<ReturnType<typeof useDragDropManager>>;

const RegisteredSource = ({event}: {event: CalendarEvent}) => {
    const {ref} = useDraggable({id: "registered-source", data: {event, anchor: day}});
    return (
        <button ref={ref} type="button">
            Registered source
        </button>
    );
};
const RegisteredTarget = () => {
    const {ref} = useDroppable({id: "registered-target", data: {date: new Date(2026, 9, 5), minute: 600}});
    return <div ref={ref}>Target</div>;
};
const ManagerProbe = ({onManager}: {onManager: (manager: Manager) => void}) => {
    const manager = useDragDropManager();
    if (manager) onManager(manager);
    return null;
};
const ControllerHarness = ({
    event,
    onManager,
    onUpdate,
    onNotification,
}: {
    event: CalendarEvent;
    onManager: (manager: Manager) => void;
    onUpdate: (event: CalendarEvent) => void;
    onNotification: (notification: unknown) => void;
}) => {
    const {actions} = useCalendarController({events: [event], now: day, onEventUpdate: onUpdate, onNotification});
    return (
        <DragDropProvider plugins={[]} onDragStart={actions.beginDrag} onDragEnd={actions.endDrag}>
            <RegisteredSource event={event} />
            <RegisteredTarget />
            <ManagerProbe onManager={onManager} />
        </DragDropProvider>
    );
};
const Harness = (props: Parameters<typeof ControllerHarness>[0]) => (
    <CalendarI18nProvider>
        <ControllerHarness {...props} />
    </CalendarI18nProvider>
);

const pickupOverTarget = async (manager: Manager) => {
    await act(async () => {
        manager.actions.start({source: "registered-source", coordinates: {x: 0, y: 0}});
    });
    await waitFor(() => expect(manager.dragOperation.status.current).toBe("dragging"));
    await act(async () => {
        await manager.actions.setDropTarget("registered-target");
    });
};

describe("actual dnd-kit source registration during a controlled host rerender", () => {
    it("drops a move when dnd-kit refreshes source data after the host changes dates", async () => {
        const onUpdate = vi.fn();
        const onNotification = vi.fn();
        let manager: Manager | undefined;
        const onManager = (value: Manager) => {
            manager = value;
        };
        const renderHarness = (event: CalendarEvent) => (
            <Harness event={event} onManager={onManager} onUpdate={onUpdate} onNotification={onNotification} />
        );
        const {rerender} = render(renderHarness(meeting));
        expect(manager).toBeDefined();
        await pickupOverTarget(manager!);
        expect((manager!.dragOperation.source?.data as {event: CalendarEvent}).event).toBe(meeting);

        const latest = {...meeting, end: new Date(2026, 9, 4, 12)};
        rerender(renderHarness(latest));
        await waitFor(() => expect((manager!.dragOperation.source?.data as {event: CalendarEvent}).event).toBe(latest));
        act(() => manager!.actions.stop());

        expect(onUpdate).not.toHaveBeenCalled();
        expect(onNotification).not.toHaveBeenCalled();
    });

    it("moves fresh host-owned fields after source data refresh when dates stayed fixed", async () => {
        const onUpdate = vi.fn();
        const onNotification = vi.fn();
        let manager: Manager | undefined;
        const onManager = (value: Manager) => {
            manager = value;
        };
        const renderHarness = (event: CalendarEvent) => (
            <Harness event={event} onManager={onManager} onUpdate={onUpdate} onNotification={onNotification} />
        );
        const {rerender} = render(renderHarness(meeting));
        expect(manager).toBeDefined();
        await pickupOverTarget(manager!);

        const metadata = {source: "fresh"};
        const latest = {...meeting, title: "Fresh", metadata};
        rerender(renderHarness(latest));
        await waitFor(() => expect((manager!.dragOperation.source?.data as {event: CalendarEvent}).event).toBe(latest));
        act(() => manager!.actions.stop());

        expect(onUpdate).toHaveBeenCalledTimes(1);
        const updated = onUpdate.mock.calls[0][0];
        expect(updated).toMatchObject({title: "Fresh", start: new Date(2026, 9, 5, 10), end: new Date(2026, 9, 5, 11)});
        expect(updated.metadata).toBe(metadata);
        expect(onNotification).toHaveBeenCalledExactlyOnceWith({action: "moved", event: updated});
    });

    it("freezes the native resize endpoint even when the host mutates its original Date in place", async () => {
        const user = userEvent.setup();
        const onUpdate = vi.fn();
        const onNotification = vi.fn();
        const mutable = {...meeting, start: new Date(2026, 9, 4, 9), end: new Date(2026, 9, 4, 10, 37)};
        render(
            <EventCalendar
                events={[mutable]}
                now={day}
                initialDate={day}
                initialView="day"
                onEventUpdate={onUpdate}
                onNotification={onNotification}
            />,
        );
        screen.getByRole("button", {name: "Adjust end of Original"}).focus();
        await user.keyboard(" ");
        mutable.end.setHours(13);
        await user.keyboard("{ArrowDown}");
        expect(screen.getByRole("button", {name: /Original, 9am - 10:45am/})).toBeInTheDocument();
        await user.keyboard("{Enter}");
        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(onUpdate.mock.calls[0][0].start).toBe(mutable.start);
        expect(onUpdate.mock.calls[0][0].end).toEqual(new Date(2026, 9, 4, 10, 45));
        expect(onUpdate.mock.calls[0][0].metadata).toBe(mutable.metadata);
        expect(onNotification).toHaveBeenCalledExactlyOnceWith({action: "resized", event: onUpdate.mock.calls[0][0]});
    });
});
