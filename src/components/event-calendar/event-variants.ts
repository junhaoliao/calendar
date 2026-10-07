import type {CalendarEvent, CalendarView} from "./types";

type HourlyView = "week" | "day";

interface EventBase {
    event: CalendarEvent;
    day: Date;
}

/** Month cells and the week/day all-day band: a spanning bar in a lane. */
interface BarVariant extends EventBase {
    variant: "bar";
    hostView: "month" | HourlyView;
    lane: number;
    isFirst: boolean;
    isLast: boolean;
    hasLabel: boolean;
}

/** A clipped timed segment inside a week/day column. */
interface TimedVariant extends EventBase {
    variant: "timed";
    hostView: HourlyView;
    segmentStart: Date;
    segmentEnd: Date;
    continuesBefore: boolean;
    continuesAfter: boolean;
    height: number;
    geometry: {left: number; width: number};
}

/** Full-detail draggable row inside a timed overflow popover. */
interface PopoverRowVariant extends EventBase {
    variant: "popover-row";
    hostView: HourlyView;
    dragScope: string;
    onSelectOverride?: (event: CalendarEvent) => void;
}

/** Static rows in the month overflow list. */
interface MonthListVariant extends EventBase {
    variant: "month-list";
}

/** Static rows in the agenda. */
interface AgendaVariant extends EventBase {
    variant: "agenda";
}

type EventVariantProps = BarVariant | TimedVariant | PopoverRowVariant | MonthListVariant | AgendaVariant;

interface EventCapabilities {
    draggable: boolean;
    resizable: boolean;
    resizeAxis: "date" | "time" | null;
    labelView: CalendarView;
    renderView: CalendarView;
    dragScope: string;
}

const eventCapabilities = (props: EventVariantProps, readOnly: boolean): EventCapabilities => {
    switch (props.variant) {
        case "bar":
            return {
                draggable: !readOnly,
                resizable: !readOnly,
                resizeAxis: readOnly ? null : "date",
                labelView: "month",
                renderView: props.hostView,
                dragScope: "month",
            };
        case "timed":
            return {
                draggable: !readOnly,
                resizable: !readOnly && props.height >= 48,
                resizeAxis: !readOnly && props.height >= 48 ? "time" : null,
                labelView: props.hostView,
                renderView: props.hostView,
                dragScope: props.hostView,
            };
        case "popover-row":
            return {
                draggable: !readOnly,
                resizable: false,
                resizeAxis: null,
                labelView: props.hostView,
                renderView: props.hostView,
                dragScope: props.dragScope,
            };
        case "month-list":
            return {
                draggable: false,
                resizable: false,
                resizeAxis: null,
                labelView: "month",
                renderView: "month",
                dragScope: "month",
            };
        case "agenda":
            return {
                draggable: false,
                resizable: false,
                resizeAxis: null,
                labelView: "agenda",
                renderView: "agenda",
                dragScope: "agenda",
            };
    }
};

export {eventCapabilities};
export type {EventCapabilities, EventVariantProps};
