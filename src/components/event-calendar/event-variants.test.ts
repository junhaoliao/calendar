import {describe, expect, it} from "vitest";

import {eventCapabilities} from "./event-variants";
import type {EventVariantProps} from "./event-variants";
import type {CalendarEvent} from "./types";

const event: CalendarEvent = {
    end: new Date(2026, 9, 4, 11),
    id: "meeting",
    start: new Date(2026, 9, 4, 10),
    title: "Team Meeting",
};
const day = new Date(2026, 9, 4);
const bar: EventVariantProps = {
    day,
    event,
    hasLabel: true,
    hostView: "week",
    isFirst: true,
    isLast: true,
    lane: 0,
    variant: "bar",
};
const timed: EventVariantProps = {
    continuesAfter: false,
    continuesBefore: false,
    day,
    event,
    geometry: {left: 20, width: 60},
    height: 48,
    hostView: "week",
    segmentEnd: event.end,
    segmentStart: event.start,
    variant: "timed",
};
const popover: EventVariantProps = {
    day,
    dragScope: "overflow:week:day",
    event,
    hostView: "week",
    variant: "popover-row",
};
const monthList: EventVariantProps = {day, event, variant: "month-list"};
const agenda: EventVariantProps = {day, event, variant: "agenda"};

describe("eventCapabilities", () => {
    it.each([
        {
            name: "editable month bar",
            props: {...bar, hostView: "month" as const},
            readOnly: false,
            expected: {
                draggable: true,
                resizable: true,
                resizeAxis: "date",
                labelView: "month",
                renderView: "month",
                dragScope: "month",
            },
        },
        {
            name: "editable week band bar keeps month drag scope",
            props: bar,
            readOnly: false,
            expected: {
                draggable: true,
                resizable: true,
                resizeAxis: "date",
                labelView: "month",
                renderView: "week",
                dragScope: "month",
            },
        },
        {
            name: "read-only bar",
            props: bar,
            readOnly: true,
            expected: {
                draggable: false,
                resizable: false,
                resizeAxis: null,
                labelView: "month",
                renderView: "week",
                dragScope: "month",
            },
        },
        {
            name: "editable tall timed segment",
            props: timed,
            readOnly: false,
            expected: {
                draggable: true,
                resizable: true,
                resizeAxis: "time",
                labelView: "week",
                renderView: "week",
                dragScope: "week",
            },
        },
        {
            name: "editable short timed segment",
            props: {...timed, height: 47},
            readOnly: false,
            expected: {
                draggable: true,
                resizable: false,
                resizeAxis: null,
                labelView: "week",
                renderView: "week",
                dragScope: "week",
            },
        },
        {
            name: "read-only timed segment",
            props: timed,
            readOnly: true,
            expected: {
                draggable: false,
                resizable: false,
                resizeAxis: null,
                labelView: "week",
                renderView: "week",
                dragScope: "week",
            },
        },
        {
            name: "editable popover row",
            props: popover,
            readOnly: false,
            expected: {
                draggable: true,
                resizable: false,
                resizeAxis: null,
                labelView: "week",
                renderView: "week",
                dragScope: "overflow:week:day",
            },
        },
        {
            name: "read-only popover row",
            props: popover,
            readOnly: true,
            expected: {
                draggable: false,
                resizable: false,
                resizeAxis: null,
                labelView: "week",
                renderView: "week",
                dragScope: "overflow:week:day",
            },
        },
        {
            name: "month list",
            props: monthList,
            readOnly: false,
            expected: {
                draggable: false,
                resizable: false,
                resizeAxis: null,
                labelView: "month",
                renderView: "month",
                dragScope: "month",
            },
        },
        {
            name: "read-only month list",
            props: monthList,
            readOnly: true,
            expected: {
                draggable: false,
                resizable: false,
                resizeAxis: null,
                labelView: "month",
                renderView: "month",
                dragScope: "month",
            },
        },
        {
            name: "agenda",
            props: agenda,
            readOnly: false,
            expected: {
                draggable: false,
                resizable: false,
                resizeAxis: null,
                labelView: "agenda",
                renderView: "agenda",
                dragScope: "agenda",
            },
        },
        {
            name: "read-only agenda",
            props: agenda,
            readOnly: true,
            expected: {
                draggable: false,
                resizable: false,
                resizeAxis: null,
                labelView: "agenda",
                renderView: "agenda",
                dragScope: "agenda",
            },
        },
    ])("derives capabilities for $name", ({props, readOnly, expected}) => {
        expect(eventCapabilities(props, readOnly)).toEqual(expected);
    });
    it("keeps the band label layout separate from the host render view", () => {
        const capabilities = eventCapabilities(bar, false);
        expect(capabilities.labelView).toBe("month");
        expect(capabilities.renderView).toBe("week");
    });
});
