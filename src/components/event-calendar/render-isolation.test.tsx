import {act, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type * as DndKit from "@dnd-kit/react";
import {useState} from "react";

const counts = vi.hoisted(() => ({
    droppable: 0,
    timedDroppable: 0,
    draggableById: new Map<string, number>(),
}));

vi.mock("@dnd-kit/react", async (importOriginal) => {
    const actual = await importOriginal<typeof DndKit>();
    return {
        ...actual,
        useDroppable: ((...args: Parameters<typeof actual.useDroppable>) => {
            counts.droppable += 1;
            if (String(args[0].id).startsWith("time:")) counts.timedDroppable += 1;
            return actual.useDroppable(...args);
        }) as typeof actual.useDroppable,
        useDraggable: ((...args: Parameters<typeof actual.useDraggable>) => {
            const data = args[0].data as {event?: {id?: string}} | undefined;
            const id = data?.event?.id;
            if (id) counts.draggableById.set(id, (counts.draggableById.get(id) ?? 0) + 1);
            return actual.useDraggable(...args);
        }) as typeof actual.useDraggable,
    };
});

import {EventCalendar, type EventMoveResolver} from "../../index";
import {dateLocaleFor} from "../../i18n/date-locale";
import {resources} from "../../i18n/resources";
import {slotLabel} from "./calendar-drop";
import type {CalendarEvent} from "./types";

const sunday = new Date(2026, 9, 4, 9);
const resetCounts = () => {
    counts.droppable = 0;
    counts.timedDroppable = 0;
    counts.draggableById.clear();
};

const rendersFor = (id: string) => counts.draggableById.get(id) ?? 0;

const accessibleSlotLabel = (locale: "en" | "fr", start: Date, allDay: boolean) =>
    slotLabel(
        start,
        allDay,
        (kind, values) => {
            const template =
                kind === "allDay" ? resources[locale].calendar.slot.addAllDay : resources[locale].calendar.slot.addAt;
            return template.replace("{{date}}", values.date).replace("{{time}}", values.time);
        },
        dateLocaleFor(locale),
    );

beforeEach(resetCounts);
afterEach(() => {
    vi.useRealTimers();
});

describe("render isolation", () => {
    it.each([false, true])("refreshes move config only for a replaced host policy: %s", async (replacePolicy) => {
        const user = userEvent.setup();
        const events: CalendarEvent[] = [
            {id: "meeting", title: "Meeting", start: sunday, end: new Date(2026, 9, 4, 11)},
        ];
        const policies: EventMoveResolver[] = [({defaultResult}) => defaultResult, () => null];
        const Host = () => {
            const [count, setCount] = useState(0);
            return (
                <>
                    <button type="button" onClick={() => setCount((value) => value + 1)}>
                        Host render {count}
                    </button>
                    <EventCalendar
                        events={events}
                        initialDate={sunday}
                        initialView="week"
                        now={sunday}
                        resolveEventMove={policies[replacePolicy ? count % 2 : 0]}
                    />
                </>
            );
        };
        render(<Host />);
        resetCounts();
        await user.click(screen.getByRole("button", {name: "Host render 0"}));
        expect(screen.getByRole("button", {name: "Host render 1"})).toBeInTheDocument();
        if (replacePolicy) expect(rendersFor("meeting")).toBeGreaterThan(0);
        else expect(rendersFor("meeting")).toBe(0);
    });
    it("keeps timed resize work in the affected column and preserves the source", async () => {
        const user = userEvent.setup();
        const metadata = {source: "host"};
        const meeting: CalendarEvent = {
            id: "meeting",
            title: "Meeting",
            start: sunday,
            end: new Date(2026, 9, 4, 11),
            metadata,
        };
        const sameDay: CalendarEvent = {
            id: "same-day",
            title: "Same day",
            start: new Date(2026, 9, 4, 13),
            end: new Date(2026, 9, 4, 15),
        };
        const otherDay: CalendarEvent = {
            id: "other-day",
            title: "Other day",
            start: new Date(2026, 9, 5, 13),
            end: new Date(2026, 9, 5, 15),
        };
        const onEventUpdate = vi.fn();
        const onNotification = vi.fn();
        const {container} = render(
            <EventCalendar
                events={[meeting, sameDay, otherDay]}
                initialDate={sunday}
                initialView="week"
                now={sunday}
                onEventUpdate={onEventUpdate}
                onNotification={onNotification}
            />,
        );
        const source = container.querySelector<HTMLElement>('[data-calendar-event="meeting"]');
        expect(source).not.toBeNull();

        screen.getByRole("button", {name: "Adjust start of Meeting"}).focus();
        await user.keyboard("{ArrowDown}");
        expect(onEventUpdate).not.toHaveBeenCalled();
        resetCounts();
        await user.keyboard("{ArrowDown}");
        expect({timedSlots: counts.timedDroppable, otherDayEvent: rendersFor("other-day")}).toEqual({
            timedSlots: 0,
            otherDayEvent: 0,
        });
        expect(counts.droppable).toBe(0);
        expect(screen.getByRole("button", {name: /Meeting, 9:30am - 11am/})).toBeInTheDocument();
        expect(container.querySelector('[data-calendar-event="meeting"]')).toBe(source);
        expect(onEventUpdate).not.toHaveBeenCalled();

        await user.keyboard("{Escape}");
        expect(container.querySelector('[data-calendar-event="meeting"]')).toBe(source);
        expect(source).toHaveAttribute("aria-label", "Meeting, 9am - 11am");
        expect(onEventUpdate).not.toHaveBeenCalled();
        expect(onNotification).not.toHaveBeenCalled();

        screen.getByRole("button", {name: "Adjust start of Meeting"}).focus();
        await user.keyboard("{ArrowDown}{Enter}");
        expect(onEventUpdate).toHaveBeenCalledTimes(1);
        expect(onEventUpdate.mock.calls[0][0].start).toEqual(new Date(2026, 9, 4, 9, 15));
        expect(onEventUpdate.mock.calls[0][0].end).toBe(meeting.end);
        expect(onEventUpdate.mock.calls[0][0].metadata).toBe(metadata);
        expect(onNotification).toHaveBeenCalledTimes(1);
    });

    it("updates clock consumers across midnight without rerendering Week slot targets", () => {
        vi.useFakeTimers({shouldAdvanceTime: false});
        vi.setSystemTime(new Date(2026, 9, 4, 23, 59));
        const past: CalendarEvent = {
            id: "past",
            title: "Past at midnight",
            start: new Date(2026, 9, 4, 23),
            end: new Date(2026, 9, 5),
        };
        const {container} = render(
            <EventCalendar events={[past]} initialDate={new Date(2026, 9, 4)} initialView="week" />,
        );
        const header = container.querySelector<HTMLElement>('[data-slot="time-header"]');
        expect(header).not.toBeNull();
        const sundayHeader = header!.children[1] as HTMLElement;
        const mondayHeader = header!.children[2] as HTMLElement;
        expect(sundayHeader).toHaveClass("font-medium", "text-foreground");
        expect(mondayHeader).not.toHaveClass("font-medium", "text-foreground");
        expect(container.querySelector('[data-calendar-event="past"]')).toHaveAttribute("data-past", "false");
        const sundayColumn = container.querySelector<HTMLElement>(
            `[data-slot="time-column"][data-day="${new Date(2026, 9, 4).toISOString()}"]`,
        );
        expect(sundayColumn).not.toBeNull();
        expect(sundayColumn?.querySelector('[data-slot="current-time"]')).not.toBeNull();

        resetCounts();
        act(() => {
            vi.advanceTimersByTime(60_000 * 2);
        });
        expect(counts.droppable).toBe(0);
        expect(container.querySelector('[data-calendar-event="past"]')).toHaveAttribute("data-past", "true");
        expect(sundayHeader).not.toHaveClass("font-medium", "text-foreground");
        expect(mondayHeader).toHaveClass("font-medium", "text-foreground");
        expect(sundayColumn?.querySelector('[data-slot="current-time"]')).toBeNull();
        const mondayColumn = container.querySelector<HTMLElement>(
            `[data-slot="time-column"][data-day="${new Date(2026, 9, 5).toISOString()}"]`,
        );
        expect(mondayColumn).not.toBeNull();
        expect(mondayColumn?.querySelector('[data-slot="current-time"]')).not.toBeNull();
    });

    it("refreshes all-day segments and invalidates timed slots by locale/read-only state", async () => {
        const user = userEvent.setup();
        const first: CalendarEvent = {
            id: "all-day",
            title: "Original workshop",
            allDay: true,
            start: new Date(2026, 9, 6),
            end: new Date(2026, 9, 7, 23, 59, 59, 999),
        };
        const replacement: CalendarEvent = {
            ...first,
            title: "Updated workshop",
            start: new Date(2026, 9, 7),
            end: new Date(2026, 9, 8, 23, 59, 59, 999),
        };
        const onEventAdd = vi.fn();
        const calendar = (events: readonly CalendarEvent[], locale: "en" | "fr", readOnly: boolean) => (
            <EventCalendar
                events={events}
                initialDate={sunday}
                initialView="week"
                locale={locale}
                now={sunday}
                onEventAdd={onEventAdd}
                readOnly={readOnly}
            />
        );
        const {container, rerender} = render(calendar([], "en", false));
        rerender(calendar([first], "en", false));
        expect(container.querySelectorAll('[data-calendar-event="all-day"]')).toHaveLength(2);
        expect(screen.getAllByText("Original workshop")).toHaveLength(2);

        rerender(calendar([replacement], "en", false));
        expect(container.querySelectorAll('[data-calendar-event="all-day"]')).toHaveLength(2);
        expect(screen.getAllByText("Updated workshop")).toHaveLength(2);
        expect(screen.queryByText("Original workshop")).not.toBeInTheDocument();

        const start = new Date(2026, 9, 7, 14);
        const enLabel = accessibleSlotLabel("en", start, false);
        const frLabel = accessibleSlotLabel("fr", start, false);
        const enSlot = () => screen.getByRole("button", {name: enLabel});

        rerender(calendar([replacement], "fr", true));
        expect(screen.queryByRole("button", {name: enLabel})).not.toBeInTheDocument();
        expect(screen.getByRole("button", {name: frLabel})).toBeDisabled();
        expect(container.querySelector('[data-calendar-event="all-day"]')).toHaveTextContent("Updated workshop");

        rerender(calendar([replacement], "en", false));
        expect(enSlot()).toBeEnabled();
        await user.click(enSlot());
        await user.click(screen.getByRole("button", {name: resources.en.calendar.editor.actions.save}));
        expect(onEventAdd).toHaveBeenCalledTimes(1);
        expect(onEventAdd.mock.calls[0][0]).toMatchObject({
            start: start,
            end: new Date(2026, 9, 7, 15),
        });
        expect(onEventAdd.mock.calls[0][0].title).toBe("(no title)");
    });

    it("updates all-day endpoint previews across dates and clears them on Escape", async () => {
        const user = userEvent.setup();
        const event: CalendarEvent = {
            id: "all-day-resize",
            title: "All-day review",
            allDay: true,
            start: new Date(2026, 9, 4),
            end: new Date(2026, 9, 5, 23, 59, 59, 999),
            metadata: {source: "host"},
        };
        const onEventUpdate = vi.fn();
        const {container} = render(
            <EventCalendar
                events={[event]}
                initialDate={sunday}
                initialView="week"
                now={sunday}
                onEventUpdate={onEventUpdate}
            />,
        );
        const endHandle = screen.getByRole("button", {name: "Adjust end of All-day review"});
        endHandle.focus();
        await user.keyboard("{ArrowRight}");
        expect(container.querySelectorAll('[data-calendar-event="all-day-resize"]')).toHaveLength(3);
        expect(onEventUpdate).not.toHaveBeenCalled();
        await user.keyboard("{Escape}");
        expect(container.querySelectorAll('[data-calendar-event="all-day-resize"]')).toHaveLength(2);
        expect(onEventUpdate).not.toHaveBeenCalled();
        expect(screen.getByRole("button", {name: "Adjust end of All-day review"})).toBeInTheDocument();
    });

    it("updates preview and clears the exited overnight column at terminal midnight", async () => {
        const user = userEvent.setup();
        const event: CalendarEvent = {
            id: "overnight",
            title: "Overnight review",
            start: new Date(2026, 9, 4, 22, 45),
            end: new Date(2026, 9, 4, 23, 45),
            metadata: {source: "host"},
        };
        const onEventUpdate = vi.fn();
        const {container} = render(
            <EventCalendar
                events={[event]}
                initialDate={sunday}
                initialView="week"
                now={sunday}
                onEventUpdate={onEventUpdate}
            />,
        );
        const sundayColumn = container.querySelector<HTMLElement>(
            `[data-slot="time-column"][data-day="${new Date(2026, 9, 4).toISOString()}"]`,
        );
        const mondayColumn = container.querySelector<HTMLElement>(
            `[data-slot="time-column"][data-day="${new Date(2026, 9, 5).toISOString()}"]`,
        );
        expect(sundayColumn).not.toBeNull();
        expect(mondayColumn).not.toBeNull();
        const source = sundayColumn?.querySelector<HTMLElement>('[data-calendar-event="overnight"]');
        expect(source).not.toBeNull();

        screen.getByRole("button", {name: "Adjust end of Overnight review"}).focus();
        await user.keyboard("{ArrowDown}");
        expect(mondayColumn?.querySelector('[data-calendar-event="overnight"]')).toBeNull();
        await user.keyboard("{ArrowDown}");
        expect(mondayColumn?.querySelector('[data-calendar-event="overnight"]')).not.toBeNull();
        await user.keyboard("{ArrowUp}");
        expect(mondayColumn?.querySelector('[data-calendar-event="overnight"]')).toBeNull();
        expect(sundayColumn?.querySelector('[data-calendar-event="overnight"]')).toBe(source);
        expect(onEventUpdate).not.toHaveBeenCalled();
        await user.keyboard("{Escape}");
        expect(sundayColumn?.querySelector('[data-calendar-event="overnight"]')).toBe(source);
        expect(onEventUpdate).not.toHaveBeenCalled();
    });
});
