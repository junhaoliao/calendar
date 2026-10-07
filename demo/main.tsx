import {StrictMode, useState} from "react";
import {createRoot} from "react-dom/client";

import {format} from "date-fns";
import {MoonIcon, SunIcon} from "lucide-react";
import {toast} from "sonner";

import {type CalendarEvent, type CalendarNotification, EventCalendar} from "../src/index";
import {DEFAULT_TIMED_DURATION_MINUTES} from "../src/date-math";
import {DEFAULT_MINIMUM_TIMED_EVENT_WIDTH} from "../src/core/timed-layout/lanes";
import {Button} from "../src/components/ui/button";
import {Toaster} from "./toaster";
import {overlapEvents} from "./overlap-events";
import {sampleEvents} from "./sample-events";
import {resizeEvents} from "./resize-events";
import {moveEvents, hostMoveResolver, rejectMove, pointMove, reasonMove} from "./move-events";

import "../dist/styles.css";
import "@fontsource-variable/inter/index.css";
import "./demo.css";

let nextDemoId = 0;

/**
 * In-memory consumer used for manual and browser acceptance testing.
 *
 * @return The standalone demo.
 */
const CalendarDemo = () => {
    const params = new URLSearchParams(window.location.search);
    const [today] = useState(() => (params.has("date") ? new Date(`${params.get("date")}T09:00:00`) : new Date()));
    const [events, setEvents] = useState<CalendarEvent[]>(() =>
        params.has("empty")
            ? []
            : (params.has("moves")
                  ? moveEvents()
                  : params.has("resize")
                    ? resizeEvents(today, params.get("resize") ?? "")
                    : params.has("overlaps")
                      ? overlapEvents(today, params.get("overlaps") ?? "")
                      : sampleEvents(today)
              ).map((event) => ({
                  ...event,
                  metadata: {...(typeof event.metadata === "object" ? event.metadata : {}), source: "demo"},
              })),
    );
    const [updates, setUpdates] = useState(0);
    const [notifications, setNotifications] = useState(0);
    const [rejections, setRejections] = useState(0);
    const [lastNotification, setLastNotification] = useState<CalendarNotification | null>(null);
    const [dark, setDark] = useState(false);
    return (
        <main
            data-event-calendar-scope=""
            data-event-calendar-theme={dark ? "dark" : "light"}
            className="calendar-demo"
            data-event-updates={updates}
            data-notifications={notifications}
            data-rejections={rejections}
            data-last-notification={params.has("debug") ? JSON.stringify(lastNotification) : null}
            data-events={params.has("debug") ? JSON.stringify(events) : null}
        >
            <header className="demo-header">
                <span className="text-sm font-medium">Event calendar</span>
                <div className="demo-actions">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            setEvents(
                                (params.has("moves")
                                    ? moveEvents()
                                    : params.has("resize")
                                      ? resizeEvents(today, params.get("resize") ?? "")
                                      : params.has("overlaps")
                                        ? overlapEvents(today, params.get("overlaps") ?? "")
                                        : sampleEvents(today)
                                ).map((event) => ({
                                    ...event,
                                    metadata: {
                                        ...(typeof event.metadata === "object" ? event.metadata : {}),
                                        source: "demo",
                                    },
                                })),
                            );
                            setUpdates(0);
                            setNotifications(0);
                            setRejections(0);
                            setLastNotification(null);
                        }}
                    >
                        Reset demo
                    </Button>
                    <Button
                        aria-label="Toggle theme"
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                            document.documentElement.classList.toggle("dark", !dark);
                            setDark(!dark);
                        }}
                    >
                        {dark ? <SunIcon /> : <MoonIcon />}
                    </Button>
                </div>
            </header>
            <div className="demo-calendar">
                <EventCalendar
                    className="flex-1"
                    defaultTimedDurationMinutes={Number(params.get("duration") ?? DEFAULT_TIMED_DURATION_MINUTES)}
                    events={events}
                    resolveEventMove={
                        params.get("resolver") === "reason"
                            ? reasonMove
                            : params.get("resolver") === "reject"
                              ? rejectMove
                              : params.get("resolver") === "point"
                                ? pointMove
                                : params.has("moves")
                                  ? hostMoveResolver
                                  : undefined
                    }
                    initialDate={today}
                    readOnly={params.has("readOnly")}
                    minimumTimedEventWidth={Number(params.get("minWidth") ?? DEFAULT_MINIMUM_TIMED_EVENT_WIDTH)}
                    {...(params.has("date")
                        ? {
                              now: today,
                          }
                        : {})}
                    onEventAdd={(event) => {
                        const created = {
                            ...event,
                            id: `demo-${++nextDemoId}`,
                            metadata: {source: "demo"},
                        };
                        setEvents((current) => [...current, created]);
                    }}
                    onEventDelete={(id) => {
                        setEvents((current) => current.filter((item) => item.id !== id));
                    }}
                    onEventUpdate={(event) => {
                        setUpdates((count) => count + 1);
                        setEvents((current) => current.map((item) => (item.id === event.id ? event : item)));
                    }}
                    onNotification={(notification) => {
                        setNotifications((count) => count + 1);
                        setLastNotification(notification);
                        const {action, event} = notification;
                        toast.success(`Event "${event.title}" ${action}`, {
                            description: format(event.start, "MMM d, yyyy"),
                            position: "bottom-left",
                        });
                    }}
                    onMoveRejected={() => setRejections((count) => count + 1)}
                />
            </div>
            <Toaster theme={dark ? "dark" : "light"} />
        </main>
    );
};

const rootElement = document.getElementById("root");
if (!rootElement) {
    throw new Error("Calendar demo root is missing");
}
createRoot(rootElement).render(
    <StrictMode>
        <CalendarDemo />
    </StrictMode>,
);
