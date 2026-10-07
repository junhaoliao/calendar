import {useState} from "react";
import {createRoot} from "react-dom/client";
import {
    EventCalendar,
    type CalendarEvent,
    type CalendarView,
    type EventMoveResolver,
    type EventMoveAnchor,
    type EventMoveTarget,
    type EventMoveContext,
    type EventMoveLane,
    type EventMoveConventions,
    type EventMoveRejection,
    type EventMoveRejected,
} from "@junhaoliao/calendar";
import {calendarHeading, moveEvent, resizeEvent} from "@junhaoliao/calendar/date-math";
import "@junhaoliao/calendar/styles.css";

let nextHostId = 0;

// Required top-level metadata and typed nested metadata both survive updates.
interface Meeting extends CalendarEvent<{source: string}> {
    projectId: string;
}
const date = new Date(2026, 9, 4, 9);
const resolveMove: EventMoveResolver<Meeting> = (context: EventMoveContext<Meeting>) => {
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
    return context.defaultResult;
};
const original: Meeting = {
    id: "meeting:a|b]",
    title: "Package meeting",
    start: new Date(2026, 9, 5, 10),
    end: new Date(2026, 9, 5, 11, 30),
    projectId: "calendar-demo",
    metadata: {source: "packed-host"},
    color: "violet",
};
// Exercise the pure runtime subpath and its generic return type.
const moved: Meeting = moveEvent(original, original.start, {date: original.start});
if (moved.metadata !== original.metadata || moved.projectId !== original.projectId) throw new Error("Metadata lost");
const resized: Meeting = resizeEvent(original, "end", new Date(2026, 9, 5, 12));
if (resized.start !== original.start || resized.metadata !== original.metadata)
    throw new Error("Resize changed fixed data");

function App() {
    const [events, setEvents] = useState<Meeting[]>([original]);
    const [theme, setTheme] = useState<"light" | "dark">("light");
    const [view, setView] = useState<CalendarView>("week");
    const [selectedDate, setDate] = useState(date);
    const [readOnly, setReadOnly] = useState(false);
    return (
        <>
            <button onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}>Host theme</button>
            <button onClick={() => setReadOnly((current) => !current)}>Host read only</button>
            <output data-host-heading>{calendarHeading(selectedDate, view)}</output>
            <div className="calendar-frame" data-host-events={JSON.stringify(events)}>
                <EventCalendar
                    events={events}
                    resolveEventMove={resolveMove}
                    date={selectedDate}
                    view={view}
                    now={date}
                    readOnly={readOnly}
                    theme={theme}
                    style={{height: "100%", "--radius": "0.75rem"} as React.CSSProperties}
                    onMoveRejected={(rejection: EventMoveRejected<Meeting>) => {
                        const project: string = rejection.event.projectId;
                        void project;
                    }}
                    onDateChange={setDate}
                    onViewChange={setView}
                    onEventAdd={(event) => {
                        const created: Meeting = {
                            ...event,
                            id: `host-${++nextHostId}`,
                            projectId: "calendar-demo",
                            metadata: {source: "packed-host"},
                        };
                        setEvents((current) => [...current, created]);
                    }}
                    onEventUpdate={(event) => {
                        // These assignments check generic callback inference.
                        const project: string = event.projectId;
                        const source: string | undefined = event.metadata?.source;
                        if (project !== "calendar-demo" || source !== "packed-host") throw new Error("Metadata lost");
                        setEvents((current) => current.map((item) => (item.id === event.id ? event : item)));
                    }}
                    onNotification={(notification) => {
                        if (notification.action !== "added") {
                            // Existing-event notifications infer the host type.
                            const project: string = notification.event.projectId;
                            void project;
                        }
                    }}
                    onEventDelete={(id) => setEvents((current) => current.filter((item) => item.id !== id))}
                />
            </div>
        </>
    );
}

createRoot(document.getElementById("root")!).render(<App />);
