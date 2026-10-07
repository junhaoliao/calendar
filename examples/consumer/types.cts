import {
    EventCalendar,
    type CalendarEvent,
    type EventCalendarProps,
    type EventMoveResolver,
    type EventMoveContext,
    type EventMoveAnchor,
    type EventMoveTarget,
    type EventMoveLane,
    type EventMoveConventions,
    type EventMoveRejection,
    type EventMoveRejected,
} from "@junhaoliao/calendar";
import {moveEvent, resizeEvent} from "@junhaoliao/calendar/date-math";

interface Meeting extends CalendarEvent<{owner: string}> {
    projectId: string;
}
const event: Meeting = {
    id: "type-test",
    title: "Types",
    start: new Date(),
    end: new Date(),
    projectId: "project",
    metadata: {owner: "consumer"},
};
const updated: Meeting = moveEvent(event, event.start, {date: event.start, minute: 600});
const resized: Meeting = resizeEvent(updated, "end", new Date(updated.end.getTime() + 3600000));
void resized;
const props: EventCalendarProps<Meeting> = {
    resolveEventMove: ((context: EventMoveContext<Meeting>) => {
        const conventions: EventMoveConventions = context.conventions;
        const snap: number = conventions.snapMinutes;
        void snap;
        const refusal: EventMoveRejection = {reject: "Closed"};
        if (context.event.projectId === "closed") return refusal;
        const anchor: EventMoveAnchor = context.anchor;
        const target: EventMoveTarget = context.target;
        const lane: EventMoveLane = target.lane;
        void anchor;
        void lane;
        const project: string = context.event.projectId;
        void project;
        return context.defaultResult;
    }) satisfies EventMoveResolver<Meeting>,
    onMoveRejected(rejection: EventMoveRejected<Meeting>) {
        const project: string = rejection.event.projectId;
        const reason: string | null = rejection.reason;
        void project;
        void reason;
    },
    events: [updated],
    onEventUpdate(next) {
        const project: string = next.projectId;
        void project;
    },
    onEventAdd(next) {
        // Creation must not pretend to contain required consumer fields.
        // @ts-expect-error Newly created events require enrichment by the host.
        const incomplete: Meeting = next;
        void incomplete;
    },
};
void EventCalendar(props);
