import {useState} from "react";
import type {CSSProperties} from "react";

import {fireEvent, render, screen, within, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {describe, expect, it, vi} from "vitest";

const calendarObservers = vi.hoisted(() => {
    const observe = vi.fn<(element: Element) => void>();
    globalThis.ResizeObserver = class {
        observe = observe;

        unobserve = vi.fn();

        disconnect = vi.fn();
    };

    return {observe};
});

import {EventCalendar} from "../../event-calendar";
import {CalendarStyleProvider, useCalendarStyle} from "../../lib/calendar-style";
import {CalendarContextProvider, useCalendarActions, useCalendarConfig, useCalendarNow} from "./calendar-context";
import {CalendarResizeProvider, useCalendarResizeActions, useCalendarResizeSession} from "./calendar-resize-context";
import {monthDays} from "../../core/dates";
import {useCalendarController} from "./use-calendar-controller";
import type {CalendarEvent, CalendarNotification, CalendarView} from "./types";

const now = new Date(2026, 9, 4, 9);
const meeting: CalendarEvent = {
    color: "sky",
    end: new Date(2026, 9, 4, 11),
    id: "meeting",
    start: new Date(2026, 9, 4, 10),
    title: "Team Meeting",
};

/**
 * Supplies realistic column widths to jsdom, which does not perform CSS layout.
 *
 * @return A restorable rectangle spy.
 */
const narrowWeekColumns = () => {
    const original = HTMLElement.prototype.getBoundingClientRect;
    return vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function measuredColumn(
        this: HTMLElement,
    ) {
        if (this.dataset.slot === "time-column") {
            return new DOMRect(0, 0, this.closest('[data-slot="day-view"]') ? 600 : 150, 1536);
        }

        return original.call(this);
    });
};

const overlaps = [
    {...meeting, end: new Date(2026, 9, 5, 13), id: "sync", start: new Date(2026, 9, 5, 12), title: "Team sync"},
    {
        ...meeting,
        end: new Date(2026, 9, 5, 12, 45),
        id: "call",
        start: new Date(2026, 9, 5, 12, 15),
        title: "Client call with a full untruncated title",
    },
    {
        ...meeting,
        end: new Date(2026, 9, 5, 13, 30),
        id: "review",
        start: new Date(2026, 9, 5, 12, 30),
        title: "Design review",
    },
];

/**
 * Consumer-owned data for editor interactions.
 *
 * @return The test calendar.
 */
const Harness = ({
    onNotification,
    initialView,
}: {
    onNotification?: (notification: CalendarNotification) => void;
    initialView?: CalendarView;
}) => {
    const [events, setEvents] = useState([meeting]);
    return (
        <EventCalendar
            events={events}
            initialDate={now}
            initialView={initialView}
            now={now}
            onEventAdd={(item) => {
                setEvents((current) => [...current, {...item, id: `new-${current.length}`}]);
            }}
            onEventDelete={(id) => {
                setEvents((current) => current.filter((item) => item.id !== id));
            }}
            onEventUpdate={(item) => {
                setEvents((current) => current.map((other) => (other.id === item.id ? item : other)));
            }}
            onNotification={onNotification}
        />
    );
};

const CalendarStyleProbe = ({onRead}: {onRead: (style: CSSProperties | undefined) => void}) => {
    const {scopeProps} = useCalendarStyle();
    onRead(scopeProps.style);
    return null;
};

interface ResizeContextSnapshot {
    resizeActions: unknown;
    resizeSession: unknown;
    actions: unknown;
    config: unknown;
    now: Date;
}

const ResizeContextProbe = ({onRead}: {onRead: (snapshot: ResizeContextSnapshot) => void}) => {
    onRead({
        actions: useCalendarActions(),
        config: useCalendarConfig(),
        now: useCalendarNow(),
        resizeActions: useCalendarResizeActions(),
        resizeSession: useCalendarResizeSession(),
    });
    return null;
};

const ResizeContextHarness = ({
    clock,
    events,
    onRead,
}: {
    clock: Date;
    events: readonly CalendarEvent[];
    onRead: (snapshot: ResizeContextSnapshot) => void;
}) => {
    const controller = useCalendarController({events, now: clock});
    return (
        <CalendarContextProvider actions={controller.actions} config={controller.config} now={controller.now}>
            <CalendarResizeProvider
                date={controller.date}
                readOnly={controller.config.readOnly}
                rootRef={controller.rootRef}
                visibleDates={monthDays(controller.date)}
                view={controller.view}
                onActiveChange={controller.actions.resizeActive}
                onCommit={controller.actions.commitResize}
            >
                <ResizeContextProbe onRead={onRead} />
            </CalendarResizeProvider>
        </CalendarContextProvider>
    );
};

describe("event calendar consumer interactions", () => {
    it("characterizes event DOM across all four views", () => {
        const snapshotEvents: CalendarEvent[] = [
            {
                ...meeting,
                allDay: true,
                end: new Date(2026, 9, 5, 23, 59, 59, 999),
                id: "all-day",
                start: new Date(2026, 9, 5),
                title: "All-day event",
            },
            {
                ...meeting,
                end: new Date(2026, 9, 5, 11),
                id: "timed",
                start: new Date(2026, 9, 5, 10),
                title: "Timed event",
            },
            {
                ...meeting,
                end: new Date(2026, 9, 5, 2),
                id: "overnight",
                start: new Date(2026, 9, 4, 23),
                title: "Overnight event",
            },
            ...overlaps,
        ];
        const localDateTime = (raw: string | undefined) => {
            if (undefined === raw) {
                return raw;
            }
            const date = new Date(raw);
            if (date.toISOString() !== raw) {
                throw new Error(`Non-canonical segment timestamp: ${raw}`);
            }
            const pad = (value: number) => String(value).padStart(2, "0");

            return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, "0")}`;
        };
        const views: CalendarView[] = ["month", "week", "day", "agenda"];
        const snapshots = views.map((view) => {
            const {unmount} = render(
                <EventCalendar
                    events={snapshotEvents}
                    initialDate={new Date(2026, 9, 5, 9)}
                    initialView={view}
                    now={new Date(2026, 9, 5, 9)}
                />,
            );
            const calendar = screen.getByLabelText("Event calendar");
            const events = Array.from(calendar.querySelectorAll<HTMLButtonElement>("[data-calendar-event]"))
                .map((element) => {
                    const wrapper = element.closest<HTMLElement>(".calendar-event-wrap");
                    return {
                        id: element.dataset.calendarEvent,
                        className: element.className,
                        view: element.dataset.view,
                        compact: element.dataset.compact,
                        continuationBefore: element.dataset.continuationBefore,
                        continuationAfter: element.dataset.continuationAfter,
                        ariaLabel: element.getAttribute("aria-label"),
                        segmentStart: localDateTime(element.dataset.segmentStart),
                        segmentEnd: localDateTime(element.dataset.segmentEnd),
                        past: element.dataset.past,
                        resizing: element.dataset.resizing,
                        color: element.dataset.color,
                        style: element.getAttribute("style"),
                        wrapper: wrapper
                            ? {
                                  tag: wrapper.tagName,
                                  className: wrapper.className,
                                  resizing: wrapper.dataset.resizing,
                                  style: wrapper.getAttribute("style"),
                              }
                            : null,
                    };
                })
                .sort((left, right) =>
                    `${left.id}:${left.segmentStart}`.localeCompare(`${right.id}:${right.segmentStart}`),
                );
            const handles = Array.from(calendar.querySelectorAll<HTMLButtonElement>(".calendar-resize-handle"))
                .map((element) => ({
                    label: element.getAttribute("aria-label"),
                    title: element.getAttribute("title"),
                    edge: element.dataset.edge,
                    axis: element.dataset.axis,
                    small: element.dataset.small,
                    active: element.dataset.active,
                    retained: element.dataset.retained,
                }))
                .sort((left, right) => `${left.label}:${left.edge}`.localeCompare(`${right.label}:${right.edge}`));
            const snapshot = {
                view: view,
                eventCount: events.length,
                wrapperCount: calendar.querySelectorAll(".calendar-event-wrap").length,
                handleCount: handles.length,
                events: events,
                handles: handles,
            };
            unmount();
            return snapshot;
        });

        expect(snapshots).toMatchInlineSnapshot(`
          [
            {
              "eventCount": 1,
              "events": [
                {
                  "ariaLabel": "Overnight event, 11pm - 2am",
                  "className": "calendar-event calendar-event-bar calendar-event-first pointer-events-auto",
                  "color": "sky",
                  "compact": "false",
                  "continuationAfter": "false",
                  "continuationBefore": "false",
                  "id": "overnight",
                  "past": "true",
                  "resizing": undefined,
                  "segmentEnd": "2026-10-05T02:00:00.000",
                  "segmentStart": "2026-10-04T23:00:00.000",
                  "style": "grid-row: 1;",
                  "view": "month",
                  "wrapper": {
                    "className": "calendar-event-wrap",
                    "resizing": undefined,
                    "style": "grid-row: 1;",
                    "tag": "DIV",
                  },
                },
              ],
              "handleCount": 1,
              "handles": [
                {
                  "active": "false",
                  "axis": "date",
                  "edge": "start",
                  "label": "Adjust start of Overnight event",
                  "retained": "false",
                  "small": "true",
                  "title": "Adjust start; arrow keys change date, Enter saves, Escape cancels",
                },
              ],
              "view": "month",
              "wrapperCount": 1,
            },
            {
              "eventCount": 7,
              "events": [
                {
                  "ariaLabel": "All-day event, All day",
                  "className": "calendar-event calendar-event-bar calendar-event-first calendar-event-last relative",
                  "color": "sky",
                  "compact": "false",
                  "continuationAfter": "false",
                  "continuationBefore": "false",
                  "id": "all-day",
                  "past": "false",
                  "resizing": undefined,
                  "segmentEnd": "2026-10-05T23:59:59.999",
                  "segmentStart": "2026-10-05T00:00:00.000",
                  "style": "grid-row: 1;",
                  "view": "month",
                  "wrapper": {
                    "className": "calendar-event-wrap",
                    "resizing": undefined,
                    "style": "grid-row: 1;",
                    "tag": "DIV",
                  },
                },
                {
                  "ariaLabel": "Client call with a full untruncated title, 12:15pm - 12:45pm",
                  "className": "calendar-event calendar-event-bar calendar-event-timed calendar-event-first calendar-event-last",
                  "color": "sky",
                  "compact": "true",
                  "continuationAfter": "false",
                  "continuationBefore": "false",
                  "id": "call",
                  "past": "false",
                  "resizing": undefined,
                  "segmentEnd": "2026-10-05T12:45:00.000",
                  "segmentStart": "2026-10-05T12:15:00.000",
                  "style": null,
                  "view": "week",
                  "wrapper": {
                    "className": "calendar-event-wrap",
                    "resizing": undefined,
                    "style": null,
                    "tag": "DIV",
                  },
                },
                {
                  "ariaLabel": "Overnight event, 11pm - 2am",
                  "className": "calendar-event calendar-event-bar calendar-event-timed calendar-event-first calendar-event-last",
                  "color": "sky",
                  "compact": "false",
                  "continuationAfter": "true",
                  "continuationBefore": "false",
                  "id": "overnight",
                  "past": "true",
                  "resizing": undefined,
                  "segmentEnd": "2026-10-05T00:00:00.000",
                  "segmentStart": "2026-10-04T23:00:00.000",
                  "style": null,
                  "view": "week",
                  "wrapper": {
                    "className": "calendar-event-wrap",
                    "resizing": undefined,
                    "style": null,
                    "tag": "DIV",
                  },
                },
                {
                  "ariaLabel": "Overnight event, 11pm - 2am, continued",
                  "className": "calendar-event calendar-event-bar calendar-event-timed calendar-event-first calendar-event-last",
                  "color": "sky",
                  "compact": "false",
                  "continuationAfter": "false",
                  "continuationBefore": "true",
                  "id": "overnight",
                  "past": "true",
                  "resizing": undefined,
                  "segmentEnd": "2026-10-05T02:00:00.000",
                  "segmentStart": "2026-10-05T00:00:00.000",
                  "style": null,
                  "view": "week",
                  "wrapper": {
                    "className": "calendar-event-wrap",
                    "resizing": undefined,
                    "style": null,
                    "tag": "DIV",
                  },
                },
                {
                  "ariaLabel": "Design review, 12:30pm - 1:30pm",
                  "className": "calendar-event calendar-event-bar calendar-event-timed calendar-event-first calendar-event-last",
                  "color": "sky",
                  "compact": "false",
                  "continuationAfter": "false",
                  "continuationBefore": "false",
                  "id": "review",
                  "past": "false",
                  "resizing": undefined,
                  "segmentEnd": "2026-10-05T13:30:00.000",
                  "segmentStart": "2026-10-05T12:30:00.000",
                  "style": null,
                  "view": "week",
                  "wrapper": {
                    "className": "calendar-event-wrap",
                    "resizing": undefined,
                    "style": null,
                    "tag": "DIV",
                  },
                },
                {
                  "ariaLabel": "Team sync, 12pm - 1pm",
                  "className": "calendar-event calendar-event-bar calendar-event-timed calendar-event-first calendar-event-last",
                  "color": "sky",
                  "compact": "false",
                  "continuationAfter": "false",
                  "continuationBefore": "false",
                  "id": "sync",
                  "past": "false",
                  "resizing": undefined,
                  "segmentEnd": "2026-10-05T13:00:00.000",
                  "segmentStart": "2026-10-05T12:00:00.000",
                  "style": null,
                  "view": "week",
                  "wrapper": {
                    "className": "calendar-event-wrap",
                    "resizing": undefined,
                    "style": null,
                    "tag": "DIV",
                  },
                },
                {
                  "ariaLabel": "Timed event, 10am - 11am",
                  "className": "calendar-event calendar-event-bar calendar-event-timed calendar-event-first calendar-event-last",
                  "color": "sky",
                  "compact": "false",
                  "continuationAfter": "false",
                  "continuationBefore": "false",
                  "id": "timed",
                  "past": "false",
                  "resizing": undefined,
                  "segmentEnd": "2026-10-05T11:00:00.000",
                  "segmentStart": "2026-10-05T10:00:00.000",
                  "style": null,
                  "view": "week",
                  "wrapper": {
                    "className": "calendar-event-wrap",
                    "resizing": undefined,
                    "style": null,
                    "tag": "DIV",
                  },
                },
              ],
              "handleCount": 10,
              "handles": [
                {
                  "active": "false",
                  "axis": "date",
                  "edge": "end",
                  "label": "Adjust end of All-day event",
                  "retained": "false",
                  "small": "true",
                  "title": "Adjust end; arrow keys change date, Enter saves, Escape cancels",
                },
                {
                  "active": "false",
                  "axis": "time",
                  "edge": "end",
                  "label": "Adjust end of Design review",
                  "retained": "false",
                  "small": "true",
                  "title": "Adjust end; arrow keys change time, Enter saves, Escape cancels",
                },
                {
                  "active": "false",
                  "axis": "time",
                  "edge": "end",
                  "label": "Adjust end of Overnight event",
                  "retained": "false",
                  "small": "false",
                  "title": "Adjust end; arrow keys change time, Enter saves, Escape cancels",
                },
                {
                  "active": "false",
                  "axis": "time",
                  "edge": "end",
                  "label": "Adjust end of Team sync",
                  "retained": "false",
                  "small": "true",
                  "title": "Adjust end; arrow keys change time, Enter saves, Escape cancels",
                },
                {
                  "active": "false",
                  "axis": "time",
                  "edge": "end",
                  "label": "Adjust end of Timed event",
                  "retained": "false",
                  "small": "true",
                  "title": "Adjust end; arrow keys change time, Enter saves, Escape cancels",
                },
                {
                  "active": "false",
                  "axis": "date",
                  "edge": "start",
                  "label": "Adjust start of All-day event",
                  "retained": "false",
                  "small": "true",
                  "title": "Adjust start; arrow keys change date, Enter saves, Escape cancels",
                },
                {
                  "active": "false",
                  "axis": "time",
                  "edge": "start",
                  "label": "Adjust start of Design review",
                  "retained": "false",
                  "small": "true",
                  "title": "Adjust start; arrow keys change time, Enter saves, Escape cancels",
                },
                {
                  "active": "false",
                  "axis": "time",
                  "edge": "start",
                  "label": "Adjust start of Overnight event",
                  "retained": "false",
                  "small": "true",
                  "title": "Adjust start; arrow keys change time, Enter saves, Escape cancels",
                },
                {
                  "active": "false",
                  "axis": "time",
                  "edge": "start",
                  "label": "Adjust start of Team sync",
                  "retained": "false",
                  "small": "true",
                  "title": "Adjust start; arrow keys change time, Enter saves, Escape cancels",
                },
                {
                  "active": "false",
                  "axis": "time",
                  "edge": "start",
                  "label": "Adjust start of Timed event",
                  "retained": "false",
                  "small": "true",
                  "title": "Adjust start; arrow keys change time, Enter saves, Escape cancels",
                },
              ],
              "view": "week",
              "wrapperCount": 7,
            },
            {
              "eventCount": 6,
              "events": [
                {
                  "ariaLabel": "All-day event, All day",
                  "className": "calendar-event calendar-event-bar calendar-event-first calendar-event-last relative",
                  "color": "sky",
                  "compact": "false",
                  "continuationAfter": "false",
                  "continuationBefore": "false",
                  "id": "all-day",
                  "past": "false",
                  "resizing": undefined,
                  "segmentEnd": "2026-10-05T23:59:59.999",
                  "segmentStart": "2026-10-05T00:00:00.000",
                  "style": "grid-row: 1;",
                  "view": "month",
                  "wrapper": {
                    "className": "calendar-event-wrap",
                    "resizing": undefined,
                    "style": "grid-row: 1;",
                    "tag": "DIV",
                  },
                },
                {
                  "ariaLabel": "Client call with a full untruncated title, 12:15pm - 12:45pm",
                  "className": "calendar-event calendar-event-bar calendar-event-timed calendar-event-first calendar-event-last",
                  "color": "sky",
                  "compact": "true",
                  "continuationAfter": "false",
                  "continuationBefore": "false",
                  "id": "call",
                  "past": "false",
                  "resizing": undefined,
                  "segmentEnd": "2026-10-05T12:45:00.000",
                  "segmentStart": "2026-10-05T12:15:00.000",
                  "style": null,
                  "view": "day",
                  "wrapper": {
                    "className": "calendar-event-wrap",
                    "resizing": undefined,
                    "style": null,
                    "tag": "DIV",
                  },
                },
                {
                  "ariaLabel": "Overnight event, 11pm - 2am, continued",
                  "className": "calendar-event calendar-event-bar calendar-event-timed calendar-event-first calendar-event-last",
                  "color": "sky",
                  "compact": "false",
                  "continuationAfter": "false",
                  "continuationBefore": "true",
                  "id": "overnight",
                  "past": "true",
                  "resizing": undefined,
                  "segmentEnd": "2026-10-05T02:00:00.000",
                  "segmentStart": "2026-10-05T00:00:00.000",
                  "style": null,
                  "view": "day",
                  "wrapper": {
                    "className": "calendar-event-wrap",
                    "resizing": undefined,
                    "style": null,
                    "tag": "DIV",
                  },
                },
                {
                  "ariaLabel": "Design review, 12:30pm - 1:30pm",
                  "className": "calendar-event calendar-event-bar calendar-event-timed calendar-event-first calendar-event-last",
                  "color": "sky",
                  "compact": "false",
                  "continuationAfter": "false",
                  "continuationBefore": "false",
                  "id": "review",
                  "past": "false",
                  "resizing": undefined,
                  "segmentEnd": "2026-10-05T13:30:00.000",
                  "segmentStart": "2026-10-05T12:30:00.000",
                  "style": null,
                  "view": "day",
                  "wrapper": {
                    "className": "calendar-event-wrap",
                    "resizing": undefined,
                    "style": null,
                    "tag": "DIV",
                  },
                },
                {
                  "ariaLabel": "Team sync, 12pm - 1pm",
                  "className": "calendar-event calendar-event-bar calendar-event-timed calendar-event-first calendar-event-last",
                  "color": "sky",
                  "compact": "false",
                  "continuationAfter": "false",
                  "continuationBefore": "false",
                  "id": "sync",
                  "past": "false",
                  "resizing": undefined,
                  "segmentEnd": "2026-10-05T13:00:00.000",
                  "segmentStart": "2026-10-05T12:00:00.000",
                  "style": null,
                  "view": "day",
                  "wrapper": {
                    "className": "calendar-event-wrap",
                    "resizing": undefined,
                    "style": null,
                    "tag": "DIV",
                  },
                },
                {
                  "ariaLabel": "Timed event, 10am - 11am",
                  "className": "calendar-event calendar-event-bar calendar-event-timed calendar-event-first calendar-event-last",
                  "color": "sky",
                  "compact": "false",
                  "continuationAfter": "false",
                  "continuationBefore": "false",
                  "id": "timed",
                  "past": "false",
                  "resizing": undefined,
                  "segmentEnd": "2026-10-05T11:00:00.000",
                  "segmentStart": "2026-10-05T10:00:00.000",
                  "style": null,
                  "view": "day",
                  "wrapper": {
                    "className": "calendar-event-wrap",
                    "resizing": undefined,
                    "style": null,
                    "tag": "DIV",
                  },
                },
              ],
              "handleCount": 9,
              "handles": [
                {
                  "active": "false",
                  "axis": "date",
                  "edge": "end",
                  "label": "Adjust end of All-day event",
                  "retained": "false",
                  "small": "true",
                  "title": "Adjust end; arrow keys change date, Enter saves, Escape cancels",
                },
                {
                  "active": "false",
                  "axis": "time",
                  "edge": "end",
                  "label": "Adjust end of Design review",
                  "retained": "false",
                  "small": "true",
                  "title": "Adjust end; arrow keys change time, Enter saves, Escape cancels",
                },
                {
                  "active": "false",
                  "axis": "time",
                  "edge": "end",
                  "label": "Adjust end of Overnight event",
                  "retained": "false",
                  "small": "false",
                  "title": "Adjust end; arrow keys change time, Enter saves, Escape cancels",
                },
                {
                  "active": "false",
                  "axis": "time",
                  "edge": "end",
                  "label": "Adjust end of Team sync",
                  "retained": "false",
                  "small": "true",
                  "title": "Adjust end; arrow keys change time, Enter saves, Escape cancels",
                },
                {
                  "active": "false",
                  "axis": "time",
                  "edge": "end",
                  "label": "Adjust end of Timed event",
                  "retained": "false",
                  "small": "true",
                  "title": "Adjust end; arrow keys change time, Enter saves, Escape cancels",
                },
                {
                  "active": "false",
                  "axis": "date",
                  "edge": "start",
                  "label": "Adjust start of All-day event",
                  "retained": "false",
                  "small": "true",
                  "title": "Adjust start; arrow keys change date, Enter saves, Escape cancels",
                },
                {
                  "active": "false",
                  "axis": "time",
                  "edge": "start",
                  "label": "Adjust start of Design review",
                  "retained": "false",
                  "small": "true",
                  "title": "Adjust start; arrow keys change time, Enter saves, Escape cancels",
                },
                {
                  "active": "false",
                  "axis": "time",
                  "edge": "start",
                  "label": "Adjust start of Team sync",
                  "retained": "false",
                  "small": "true",
                  "title": "Adjust start; arrow keys change time, Enter saves, Escape cancels",
                },
                {
                  "active": "false",
                  "axis": "time",
                  "edge": "start",
                  "label": "Adjust start of Timed event",
                  "retained": "false",
                  "small": "true",
                  "title": "Adjust start; arrow keys change time, Enter saves, Escape cancels",
                },
              ],
              "view": "day",
              "wrapperCount": 6,
            },
            {
              "eventCount": 6,
              "events": [
                {
                  "ariaLabel": "All-day event, All day",
                  "className": "calendar-event calendar-event-agenda calendar-event-first calendar-event-last",
                  "color": "sky",
                  "compact": "false",
                  "continuationAfter": "false",
                  "continuationBefore": "false",
                  "id": "all-day",
                  "past": "false",
                  "resizing": undefined,
                  "segmentEnd": "2026-10-05T23:59:59.999",
                  "segmentStart": "2026-10-05T00:00:00.000",
                  "style": null,
                  "view": "agenda",
                  "wrapper": null,
                },
                {
                  "ariaLabel": "Client call with a full untruncated title, 12:15pm - 12:45pm",
                  "className": "calendar-event calendar-event-agenda calendar-event-first calendar-event-last",
                  "color": "sky",
                  "compact": "true",
                  "continuationAfter": "false",
                  "continuationBefore": "false",
                  "id": "call",
                  "past": "false",
                  "resizing": undefined,
                  "segmentEnd": "2026-10-05T12:45:00.000",
                  "segmentStart": "2026-10-05T12:15:00.000",
                  "style": null,
                  "view": "agenda",
                  "wrapper": null,
                },
                {
                  "ariaLabel": "Overnight event, 11pm - 2am, continued",
                  "className": "calendar-event calendar-event-agenda calendar-event-first calendar-event-last",
                  "color": "sky",
                  "compact": "false",
                  "continuationAfter": "false",
                  "continuationBefore": "false",
                  "id": "overnight",
                  "past": "true",
                  "resizing": undefined,
                  "segmentEnd": "2026-10-05T02:00:00.000",
                  "segmentStart": "2026-10-04T23:00:00.000",
                  "style": null,
                  "view": "agenda",
                  "wrapper": null,
                },
                {
                  "ariaLabel": "Design review, 12:30pm - 1:30pm",
                  "className": "calendar-event calendar-event-agenda calendar-event-first calendar-event-last",
                  "color": "sky",
                  "compact": "false",
                  "continuationAfter": "false",
                  "continuationBefore": "false",
                  "id": "review",
                  "past": "false",
                  "resizing": undefined,
                  "segmentEnd": "2026-10-05T13:30:00.000",
                  "segmentStart": "2026-10-05T12:30:00.000",
                  "style": null,
                  "view": "agenda",
                  "wrapper": null,
                },
                {
                  "ariaLabel": "Team sync, 12pm - 1pm",
                  "className": "calendar-event calendar-event-agenda calendar-event-first calendar-event-last",
                  "color": "sky",
                  "compact": "false",
                  "continuationAfter": "false",
                  "continuationBefore": "false",
                  "id": "sync",
                  "past": "false",
                  "resizing": undefined,
                  "segmentEnd": "2026-10-05T13:00:00.000",
                  "segmentStart": "2026-10-05T12:00:00.000",
                  "style": null,
                  "view": "agenda",
                  "wrapper": null,
                },
                {
                  "ariaLabel": "Timed event, 10am - 11am",
                  "className": "calendar-event calendar-event-agenda calendar-event-first calendar-event-last",
                  "color": "sky",
                  "compact": "false",
                  "continuationAfter": "false",
                  "continuationBefore": "false",
                  "id": "timed",
                  "past": "false",
                  "resizing": undefined,
                  "segmentEnd": "2026-10-05T11:00:00.000",
                  "segmentStart": "2026-10-05T10:00:00.000",
                  "style": null,
                  "view": "agenda",
                  "wrapper": null,
                },
              ],
              "handleCount": 0,
              "handles": [],
              "view": "agenda",
              "wrapperCount": 0,
            },
          ]
        `);
    });
    it("passes the all-day band host view to custom renderers", () => {
        const allDay: CalendarEvent = {
            ...meeting,
            allDay: true,
            end: new Date(2026, 9, 4, 23, 59, 59, 999),
            id: "renderer-all-day",
            start: new Date(2026, 9, 4),
        };
        const timed: CalendarEvent = {...meeting, id: "renderer-timed"};
        const renderEvent = vi.fn((event: CalendarEvent, view: CalendarView) => <span>{`${event.id}:${view}`}</span>);
        const cases: [CalendarView, CalendarView][] = [
            ["week", "week"],
            ["day", "day"],
            ["month", "month"],
        ];

        cases.forEach(([view, expectedView]) => {
            renderEvent.mockClear();
            const {unmount} = render(
                <EventCalendar
                    events={[allDay, timed]}
                    initialDate={now}
                    initialView={view}
                    now={now}
                    renderEvent={renderEvent}
                />,
            );
            expect(
                renderEvent.mock.calls.some(
                    ([event, calledView]) => event.id === allDay.id && calledView === expectedView,
                ),
            ).toBe(true);
            unmount();
        });
    });
    it("retains CSS variable style identity for equal content and excludes root layout", () => {
        const styles: (CSSProperties | undefined)[] = [];
        const onRead = (style: CSSProperties | undefined) => styles.push(style);
        const renderProbe = (style: CSSProperties) => (
            <CalendarStyleProvider style={style}>
                <CalendarStyleProbe onRead={onRead} />
            </CalendarStyleProvider>
        );
        const {rerender} = render(renderProbe({height: 700, "--radius": "1rem"} as CSSProperties));
        const initial = styles[styles.length - 1];
        expect(initial).toEqual({"--radius": "1rem"});
        expect(initial).not.toHaveProperty("height");

        rerender(renderProbe({"--radius": "1rem", height: 900} as CSSProperties));
        expect(styles[styles.length - 1]).toBe(initial);

        rerender(renderProbe({height: 900, "--radius": "0.75rem"} as CSSProperties));
        expect(styles[styles.length - 1]).not.toBe(initial);
        expect(styles[styles.length - 1]).toEqual({"--radius": "0.75rem"});
    });
    it("keeps action/config and idle resize values stable across clock and host rerenders", () => {
        const snapshots: ResizeContextSnapshot[] = [];
        const onRead = (snapshot: ResizeContextSnapshot) => snapshots.push(snapshot);
        const events = [meeting];
        const {rerender} = render(<ResizeContextHarness clock={now} events={events} onRead={onRead} />);
        const initial = snapshots[0];
        expect(initial.resizeActions).not.toBeNull();
        expect(initial.resizeSession).toBeNull();

        const nextClock = new Date(now.getTime() + 60000);
        rerender(<ResizeContextHarness clock={nextClock} events={events} onRead={onRead} />);
        const ticked = snapshots[snapshots.length - 1];
        expect(ticked.now).toEqual(nextClock);
        expect(ticked.actions).toBe(initial.actions);
        expect(ticked.config).toBe(initial.config);
        expect(ticked.resizeActions).toBe(initial.resizeActions);
        expect(ticked.resizeSession).toBe(initial.resizeSession);

        const nextEvents = [{...meeting, title: "Changed by host"}];
        rerender(<ResizeContextHarness clock={nextClock} events={nextEvents} onRead={onRead} />);
        const hostUpdate = snapshots[snapshots.length - 1];
        expect(hostUpdate.actions).toBe(initial.actions);
        expect(hostUpdate.config).toBe(initial.config);
        expect(hostUpdate.resizeActions).toBe(initial.resizeActions);
        expect(hostUpdate.resizeSession).toBe(initial.resizeSession);
    });
    // The four-worker baseline measured this full overflow-to-editor interaction at 5.626 s.
    it("offers full overlap titles/ranges and the existing edit action through overflow", async () => {
        const rect = narrowWeekColumns();
        try {
            const user = userEvent.setup();
            const onUpdate = vi.fn();
            render(
                <EventCalendar
                    events={overlaps}
                    initialDate={now}
                    initialView="week"
                    now={now}
                    onEventUpdate={onUpdate}
                />,
            );
            const more = screen.getByRole("button", {name: /\+2 more events/});
            const column = more.closest<HTMLElement>('[data-slot="time-column"]');
            expect(column).not.toBeNull();
            expect(within(column!).queryByText(/^through\b/i)).not.toBeInTheDocument();
            expect(column!.querySelector(".border-dashed")).toBeNull();
            more.focus();
            await user.keyboard("{Enter}");
            const fullTitle = await screen.findByText("Client call with a full untruncated title");
            expect(fullTitle).toBeVisible();
            expect(screen.getByText("12:15 PM – 12:45 PM")).toBeVisible();
            const popup = fullTitle.closest<HTMLElement>('[data-slot="popover-content"]');
            expect(popup).not.toBeNull();
            expect(within(popup!).getByText("Mon, Oct 5 ·3 events")).toBeVisible();
            expect(within(popup!).queryByText(/^\d+\s+hidden(?:\s+events)?$/i)).not.toBeInTheDocument();
            expect(more.closest("button button")).toBeNull();
            await user.click(screen.getByRole("button", {name: /^Edit Client call/}));
            expect(await screen.findByRole("heading", {name: "Edit Event"})).toBeVisible();
            expect(screen.getByRole("textbox", {name: "Title"})).toHaveValue(
                "Client call with a full untruncated title",
            );
            await user.click(screen.getByRole("button", {name: "Save"}));
            expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({id: "call"}));
        } finally {
            rect.mockRestore();
        }
    }, 10000);
    it("opens the selected date in day view and reports controlled-navigation callbacks", async () => {
        const rect = narrowWeekColumns();
        try {
            const user = userEvent.setup();
            const onDate = vi.fn();
            const onView = vi.fn();
            render(
                <EventCalendar
                    events={overlaps}
                    initialDate={now}
                    initialView="week"
                    now={now}
                    onDateChange={onDate}
                    onViewChange={onView}
                />,
            );
            await user.click(screen.getByRole("button", {name: /\+2 more events/}));
            await user.click(await screen.findByRole("button", {name: "Open day view"}));
            expect(onDate).toHaveBeenLastCalledWith(new Date(2026, 9, 5));
            expect(onView).toHaveBeenLastCalledWith("day");
            expect(screen.getByRole("button", {name: "Day"})).toBeVisible();
            expect(screen.getByRole("heading", {level: 2})).toHaveTextContent("October 5, 2026");
            expect(screen.getByRole("button", {name: /^Design review, /})).toBeVisible();
            expect(screen.queryByRole("button", {name: /more events/})).not.toBeInTheDocument();
        } finally {
            rect.mockRestore();
        }
    });
    it("recalculates readable lanes when the consumer changes the configured minimum width", () => {
        const rect = narrowWeekColumns();
        try {
            const {rerender} = render(
                <EventCalendar
                    events={overlaps}
                    initialDate={now}
                    initialView="week"
                    minimumTimedEventWidth={90}
                    now={now}
                />,
            );

            expect(screen.getByRole("button", {name: /\+2 more events/})).toBeVisible();
            rerender(
                <EventCalendar
                    events={overlaps}
                    initialDate={now}
                    initialView="week"
                    minimumTimedEventWidth={45}
                    now={now}
                />,
            );
            expect(screen.queryByRole("button", {name: /more events/})).not.toBeInTheDocument();
            expect(screen.getByRole("button", {name: /^Design review, /})).toBeVisible();
        } finally {
            rect.mockRestore();
        }
    });
    it("reconnects responsive row measurement after month navigation", async () => {
        const user = userEvent.setup();
        calendarObservers.observe.mockClear();
        render(<EventCalendar events={[]} initialDate={now} now={now} />);
        const firstRow = calendarObservers.observe.mock.lastCall?.[0];
        await user.click(screen.getByRole("button", {name: "Next"}));
        const nextRow = calendarObservers.observe.mock.lastCall?.[0];
        expect(nextRow).not.toBe(firstRow);
        expect(nextRow?.isConnected).toBe(true);
        expect(firstRow?.isConnected).toBe(false);
    });
    it("keeps agenda events actionable and preserves host metadata when editing", async () => {
        const user = userEvent.setup();
        const onUpdate = vi.fn();
        const tagged = {...meeting, providerId: "external-source"};
        render(
            <EventCalendar
                events={[tagged]}
                initialDate={now}
                initialView="agenda"
                now={now}
                onEventUpdate={onUpdate}
            />,
        );
        const eventButton = screen.getByRole("button", {name: "Team Meeting, 10am - 11am"});
        expect(eventButton).not.toHaveAttribute("aria-disabled", "true");
        await user.click(eventButton);
        await user.click(screen.getByRole("button", {name: "Save"}));
        expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({providerId: "external-source"}));
    });
    it("opens overflow events without creating a draft for the underlying cell", async () => {
        const user = userEvent.setup();
        const onAdd = vi.fn();
        const crowded = Array.from({length: 3}, (_, index) => ({
            ...meeting,
            id: String(index),
            title: `Crowded ${index}`,
        }));
        render(<EventCalendar events={crowded} initialDate={now} now={now} onEventAdd={onAdd} />);
        await user.click(screen.getByRole("button", {name: "+ 3 more"}));
        const eventButton = screen.getByRole("button", {name: "Crowded 2, 10am - 11am"});
        expect(eventButton).not.toHaveAttribute("aria-disabled", "true");
        await user.click(eventButton);
        expect(screen.getByRole("heading", {name: "Edit Event"})).toBeVisible();
        expect(screen.getByRole("textbox", {name: "Title"})).toHaveValue("Crowded 2");
        expect(onAdd).not.toHaveBeenCalled();
    });
    it("lets read-only hosts select custom-rendered events without enabling mutations", async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        render(
            <EventCalendar
                events={[meeting]}
                initialDate={now}
                now={now}
                readOnly={true}
                renderEvent={(event) => <span>{`Custom ${event.title}`}</span>}
                onEventClick={onSelect}
            />,
        );
        await user.click(screen.getByText("Custom Team Meeting"));
        expect(onSelect).toHaveBeenCalledWith(meeting);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Add event October 4, 2026 at 9:00 AM"})).toBeDisabled();
    });
    it("creates from an empty cell with the correct date, times, fields and color", async () => {
        const user = userEvent.setup();
        const onAdd = vi.fn();
        render(<EventCalendar events={[]} initialDate={now} now={now} onEventAdd={onAdd} />);
        await user.click(
            screen.getByRole("button", {
                name: "Add event October 6, 2026 at 9:00 AM",
            }),
        );
        expect(
            screen.getByRole("heading", {
                name: "Create Event",
            }),
        ).toBeVisible();
        expect(
            screen.getByRole("button", {
                name: /Start Date/,
            }),
        ).toHaveTextContent("October 6th, 2026");
        expect(
            screen.getByRole("combobox", {
                name: "Start Time",
            }),
        ).toHaveTextContent("9:00 AM");
        expect(
            screen.getByRole("combobox", {
                name: "End Time",
            }),
        ).toHaveTextContent("10:00 AM");
        await user.type(
            screen.getByRole("textbox", {
                name: "Title",
            }),
            "New meeting",
        );
        await user.type(
            screen.getByRole("textbox", {
                name: "Description",
            }),
            "Notes",
        );
        await user.type(
            screen.getByRole("textbox", {
                name: "Location",
            }),
            "Office",
        );
        await user.click(
            screen.getByRole("radio", {
                name: "Rose",
            }),
        );
        await user.click(
            screen.getByRole("button", {
                name: "Save",
            }),
        );
        expect(onAdd.mock.calls[0][0]).not.toHaveProperty("id");
        expect(onAdd).toHaveBeenCalledWith(
            expect.objectContaining({
                color: "rose",
                description: "Notes",
                end: new Date(2026, 9, 6, 10),
                location: "Office",
                start: new Date(2026, 9, 6, 9),
                title: "New meeting",
            }),
        );
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    it("shows and preserves an off-grid start time when saving an existing event", async () => {
        const user = userEvent.setup();
        const onUpdate = vi.fn();
        const offGrid = {
            ...meeting,
            end: new Date(2026, 9, 4, 10, 37),
            start: new Date(2026, 9, 4, 10, 7),
        };
        render(
            <EventCalendar events={[offGrid]} initialDate={now} initialView="day" now={now} onEventUpdate={onUpdate} />,
        );

        await user.click(screen.getByRole("button", {name: /^Team Meeting, /}));
        expect(screen.getByRole("combobox", {name: "Start Time"})).toHaveTextContent("10:07 AM");
        await user.click(screen.getByRole("button", {name: "Save"}));

        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(onUpdate.mock.calls[0][0].start.getTime()).toBe(offGrid.start.getTime());
    });
    it("shows the end-of-day default after clearing All day", async () => {
        const user = userEvent.setup();
        const allDay = {
            ...meeting,
            allDay: true,
            end: new Date(2026, 9, 4, 23, 59, 59, 999),
            start: new Date(2026, 9, 4),
        };
        render(<EventCalendar events={[allDay]} initialDate={now} initialView="day" now={now} />);

        await user.click(screen.getByRole("button", {name: /^Team Meeting, /}));
        await user.click(screen.getByRole("checkbox", {name: "All day"}));

        expect(screen.getByRole("combobox", {name: "End Time"})).toHaveTextContent("11:59 PM");
    });
    it("edits and deletes using consumer-owned state", async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await user.click(
            screen.getByRole("button", {
                name: "Team Meeting, 10am - 11am",
            }),
        );
        await user.clear(
            screen.getByRole("textbox", {
                name: "Title",
            }),
        );
        await user.type(
            screen.getByRole("textbox", {
                name: "Title",
            }),
            "Updated meeting",
        );
        await user.click(
            screen.getByRole("button", {
                name: "Save",
            }),
        );
        await user.click(
            screen.getByRole("button", {
                name: "Updated meeting, 10am - 11am",
            }),
        );
        await user.click(
            screen.getByRole("button", {
                name: "Delete event",
            }),
        );
        expect(
            screen.queryByRole("button", {
                name: /Updated meeting/,
            }),
        ).not.toBeInTheDocument();
        expect(screen.getByText('Event "Updated meeting" deleted')).toBeInTheDocument();
    });
    it("notifies typed actions for create, update and delete", async () => {
        const user = userEvent.setup();
        const notify = vi.fn<(notification: CalendarNotification) => void>();
        render(<Harness initialView="day" onNotification={notify} />);

        await user.click(screen.getByRole("button", {name: "New event"}));
        await user.type(screen.getByRole("textbox", {name: "Title"}), "Created meeting");
        await user.click(screen.getByRole("button", {name: "Save"}));

        const added = notify.mock.calls[0][0];
        expect(added).toMatchObject({action: "added", event: {title: "Created meeting"}});
        if (added.action !== "added") {
            throw new Error("Expected an added notification");
        }
        expect(added.event).not.toHaveProperty("id");

        await user.click(screen.getByRole("button", {name: /^Created meeting, /}));
        await user.clear(screen.getByRole("textbox", {name: "Title"}));
        await user.type(screen.getByRole("textbox", {name: "Title"}), "Renamed meeting");
        await user.click(screen.getByRole("button", {name: "Save"}));
        expect(notify.mock.calls[1][0]).toMatchObject({
            action: "updated",
            event: {id: "new-1", title: "Renamed meeting"},
        });

        await user.click(screen.getByRole("button", {name: /^Renamed meeting, /}));
        await user.click(screen.getByRole("button", {name: "Delete event"}));
        expect(notify).toHaveBeenCalledTimes(3);
        expect(notify.mock.calls[2][0]).toMatchObject({
            action: "deleted",
            event: {id: "new-1", title: "Renamed meeting"},
        });
        expect(screen.getByText('Event "Renamed meeting" deleted')).toBeInTheDocument();
    });
    it("shows Delete only for edit-mode drafts", async () => {
        const user = userEvent.setup();
        render(<EventCalendar events={[meeting]} initialDate={now} now={now} />);

        await user.click(screen.getByRole("button", {name: "Team Meeting, 10am - 11am"}));
        expect(screen.getByRole("button", {name: "Delete event"})).toBeVisible();
        await user.click(screen.getByRole("button", {name: "Cancel"}));
        await waitFor(() => expect(screen.queryByRole("button", {name: "Delete event"})).not.toBeInTheDocument());

        await user.click(screen.getByRole("button", {name: "New event"}));
        expect(screen.queryByRole("button", {name: "Delete event"})).not.toBeInTheDocument();
    });
    it("cancels drafts and saves blank all-day titles with inclusive time boundaries", async () => {
        const user = userEvent.setup();
        const onAdd = vi.fn();
        render(<EventCalendar events={[]} initialDate={now} now={now} onEventAdd={onAdd} />);
        await user.click(
            screen.getByRole("button", {
                name: "New event",
            }),
        );
        await user.type(
            screen.getByRole("textbox", {
                name: "Title",
            }),
            "discard",
        );
        await user.click(
            screen.getByRole("button", {
                name: "Cancel",
            }),
        );
        expect(onAdd).not.toHaveBeenCalled();
        await user.click(
            screen.getByRole("button", {
                name: "New event",
            }),
        );
        expect(
            screen.getByRole("textbox", {
                name: "Title",
            }),
        ).toHaveValue("");
        await user.click(
            screen.getByRole("checkbox", {
                name: "All day",
            }),
        );
        expect(
            screen.queryByRole("combobox", {
                name: "Start Time",
            }),
        ).not.toBeInTheDocument();
        await user.click(
            screen.getByRole("button", {
                name: "Save",
            }),
        );
        expect(onAdd).toHaveBeenCalledWith(
            expect.objectContaining({
                allDay: true,
                end: new Date(2026, 9, 4, 23, 59, 59, 999),
                start: new Date(2026, 9, 4),
                title: "(no title)",
            }),
        );
    });
    it("scopes shortcuts and supports controlled date/view callbacks", async () => {
        const user = userEvent.setup();
        const onDate = vi.fn();
        const onView = vi.fn();
        render(
            <>
                <input aria-label="Host input" />
                <EventCalendar
                    date={now}
                    events={[meeting]}
                    now={now}
                    view="month"
                    onDateChange={onDate}
                    onViewChange={onView}
                />
            </>,
        );
        const calendar = screen.getByLabelText("Event calendar");
        fireEvent.keyDown(calendar, {
            key: "w",
        });
        expect(onView).toHaveBeenLastCalledWith("week");
        expect(
            screen.getByRole("button", {
                name: "Month",
            }),
        ).toBeVisible();
        fireEvent.keyDown(
            screen.getByRole("textbox", {
                name: "Host input",
            }),
            {
                key: "d",
            },
        );
        fireEvent.keyDown(calendar, {
            ctrlKey: true,
            key: "d",
        });
        expect(onView).toHaveBeenCalledTimes(1);
        await user.click(
            screen.getByRole("button", {
                name: "Next",
            }),
        );
        expect(onDate).toHaveBeenLastCalledWith(new Date(2026, 10, 4, 9));
        await user.click(
            screen.getByRole("button", {
                name: "Month",
            }),
        );
        await user.click(
            await screen.findByRole("menuitem", {
                name: /Agenda/,
            }),
        );
        expect(onView).toHaveBeenLastCalledWith("agenda");
    });
    it("uses quarter-hour slots and lets hosts replace the editor", async () => {
        const user = userEvent.setup();
        const onSlot = vi.fn();
        const onSelect = vi.fn();
        render(
            <EventCalendar
                events={[meeting]}
                initialDate={now}
                initialView="day"
                now={now}
                onEventClick={onSelect}
                onSlotClick={onSlot}
            />,
        );
        await user.click(
            screen.getByRole("button", {
                name: "Add event October 4, 2026 at 9:45 AM",
            }),
        );
        expect(onSlot).toHaveBeenCalledWith({
            allDay: false,
            end: new Date(2026, 9, 4, 10, 45),
            start: new Date(2026, 9, 4, 9, 45),
        });
        await user.click(
            screen.getByRole("button", {
                name: "Team Meeting, 10am - 11am",
            }),
        );
        expect(onSelect).toHaveBeenCalledWith(meeting);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    it("reports all-day band slots as full inclusive days", async () => {
        const user = userEvent.setup();
        const onSlot = vi.fn();
        render(<EventCalendar events={[]} initialDate={now} initialView="week" now={now} onSlotClick={onSlot} />);

        await user.click(screen.getByRole("button", {name: "Add event October 6, 2026 all day"}));

        expect(onSlot).toHaveBeenCalledTimes(1);
        expect(onSlot).toHaveBeenCalledWith({
            allDay: true,
            end: new Date(2026, 9, 6, 23, 59, 59, 999),
            start: new Date(2026, 9, 6),
        });
    });
    it("saves built-in all-day band drafts with full inclusive dates", async () => {
        const user = userEvent.setup();
        const onAdd = vi.fn();
        render(<EventCalendar events={[]} initialDate={now} initialView="week" now={now} onEventAdd={onAdd} />);

        await user.click(screen.getByRole("button", {name: "Add event October 6, 2026 all day"}));
        await user.click(screen.getByRole("button", {name: "Save"}));

        expect(onAdd).toHaveBeenCalledWith(
            expect.objectContaining({
                allDay: true,
                end: new Date(2026, 9, 6, 23, 59, 59, 999),
                start: new Date(2026, 9, 6),
            }),
        );
    });
    it("has a 30-day agenda empty state and read-only navigation", async () => {
        const user = userEvent.setup();
        render(<EventCalendar events={[]} initialDate={now} initialView="agenda" now={now} readOnly={true} />);
        expect(screen.getByText("No events found")).toBeVisible();
        expect(
            screen.queryByRole("button", {
                name: "New event",
            }),
        ).not.toBeInTheDocument();
        await user.click(
            screen.getByRole("button", {
                name: "Next",
            }),
        );
        expect(
            screen.getByRole("heading", {
                level: 2,
            }),
        ).toHaveTextContent("November 2026");
    });
    it("rejects end-before-start and suppresses editor typing shortcuts", async () => {
        const user = userEvent.setup();
        const onAdd = vi.fn();
        render(<EventCalendar events={[]} initialDate={now} now={now} onEventAdd={onAdd} />);
        await user.click(
            screen.getByRole("button", {
                name: "New event",
            }),
        );
        await user.type(
            screen.getByRole("textbox", {
                name: "Title",
            }),
            "wday",
        );
        await user.click(
            screen.getByRole("combobox", {
                name: "End Time",
            }),
        );
        await user.click(
            await screen.findByRole("option", {
                name: "8:00 AM",
            }),
        );
        await user.click(
            screen.getByRole("button", {
                name: "Save",
            }),
        );
        expect(within(screen.getByRole("alert")).getByText("End date cannot be before start date")).toBeVisible();
        expect(onAdd).not.toHaveBeenCalled();
        await user.keyboard("{Escape}");
        expect(
            screen.getByRole("button", {
                name: "Month",
            }),
        ).toBeVisible();
    });
});
