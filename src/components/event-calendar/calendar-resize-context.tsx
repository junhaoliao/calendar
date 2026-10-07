import {displayTitle} from "./event-display";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import type {CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, RefObject} from "react";
import {addDays, addMinutes, format} from "date-fns";
import {useCalendarTranslation} from "../../i18n/translations";
import {lastOccupiedDay} from "../../core/dates";
import {resizeEvent, snapResizeTime, RESIZE_STEP_MINUTES} from "../../core/resize";
import {timedResizeTarget, withinVisibleRange} from "../../core/timed-layout/resize-target";
import {DRAG_DISTANCE, TOUCH_DELAY} from "./calendar-sensors";
import type {ResizeEdge} from "../../core/resize";
import type {CalendarEvent, CalendarView} from "./types";

interface ResizeSession {
    original: CalendarEvent;
    event: CalendarEvent;
    edge: ResizeEdge;
    dateOnly: boolean;
    anchor: Date;
    lane: number;
    geometry?: {left: number; width: number};
    pointerId?: number;
    valid: boolean;
}

interface ResizeCommit {
    /** The event as captured when the gesture started, with independent endpoint Dates. */
    original: CalendarEvent;
    /** The preview candidate computed from the captured event. */
    event: CalendarEvent;
    edge: ResizeEdge;
}

interface ResizeActions {
    start: (
        event: CalendarEvent,
        edge: ResizeEdge,
        dateOnly: boolean,
        anchor: Date,
        element: HTMLButtonElement,
        style?: CSSProperties,
        pointer?: ReactPointerEvent<HTMLButtonElement>,
        geometry?: {left: number; width: number},
    ) => void;
    key: (
        event: CalendarEvent,
        edge: ResizeEdge,
        dateOnly: boolean,
        anchor: Date,
        element: HTMLButtonElement,
        key: string,
        style?: CSSProperties,
        geometry?: {left: number; width: number},
    ) => void;
}

const ResizeActionsContext = createContext<ResizeActions | null>(null);
type SessionStore = {
    get: () => ResizeSession | null;
    set: (next: ResizeSession | null) => void;
    subscribe: (listener: () => void) => () => void;
};

const createSessionStore = (): SessionStore => {
    let current: ResizeSession | null = null;
    const listeners = new Set<() => void>();
    return {
        get: () => current,
        set: (next) => {
            if (Object.is(current, next)) return;
            current = next;
            listeners.forEach((listener) => listener());
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
};

const ResizeSessionContext = createContext<SessionStore | null>(null);
const noStart: ResizeActions["start"] = () => {};
const noKey: ResizeActions["key"] = () => {};

/** A resize edits one endpoint in place; body movement stays with dnd-kit. */
export function CalendarResizeProvider({
    children,
    rootRef,
    view,
    date,
    visibleDates,
    readOnly,
    onActiveChange,
    onCommit,
}: {
    children: ReactNode;
    rootRef: RefObject<HTMLDivElement | null>;
    view: CalendarView;
    date: Date;
    visibleDates: Date[];
    readOnly: boolean;
    onActiveChange: (active: boolean) => void;
    onCommit: (commit: ResizeCommit) => void;
}) {
    const {tCalendar, dateLocale} = useCalendarTranslation();
    const [store] = useState(createSessionStore);
    const session = useSyncExternalStore(store.subscribe, store.get, () => null);
    const active = useRef<ResizeSession | null>(null);
    const cleanup = useRef<(() => void) | null>(null);
    const startImplementation = useRef<ResizeActions["start"]>(noStart);
    const keyImplementation = useRef<ResizeActions["key"]>(noKey);
    const start = useCallback<ResizeActions["start"]>((...args) => startImplementation.current(...args), []);
    const key = useCallback<ResizeActions["key"]>((...args) => keyImplementation.current(...args), []);
    const latest = useRef({view, date, visibleDates, readOnly, onActiveChange, onCommit});
    latest.current = {view, date, visibleDates, readOnly, onActiveChange, onCommit};

    const update = (next: ResizeSession) => {
        active.current = next;
        store.set(next);
    };
    const finish = (commit: boolean) => {
        const current = active.current;
        if (!current) return;
        cleanup.current?.();
        cleanup.current = null;
        active.current = null;
        store.set(null);
        latest.current.onActiveChange(false);
        if (commit && current.valid && !latest.current.readOnly) {
            latest.current.onCommit({original: current.original, event: current.event, edge: current.edge});
        }
        rootRef.current?.focus({preventScroll: true});
    };
    const announce = (event: CalendarEvent) =>
        tCalendar(($) => $.resize.announcement, {
            title: displayTitle(event.title, tCalendar),
            start: format(
                event.start,
                tCalendar(($) => $.formats.resizeInstant),
                {
                    locale: dateLocale,
                },
            ),
            end: format(
                event.end,
                tCalendar(($) => $.formats.resizeInstant),
                {locale: dateLocale},
            ),
        });

    const keyboardStep = (key: string) => {
        const current = active.current;
        if (!current) return;
        const direction = key === "ArrowLeft" || key === "ArrowUp" ? -1 : 1;
        const boundary =
            current.edge === "end" && current.dateOnly ? lastOccupiedDay(current.event) : current.event[current.edge];
        const target = current.dateOnly
            ? addDays(boundary, direction)
            : addMinutes(snapResizeTime(boundary, direction > 0 ? "floor" : "ceil"), direction * RESIZE_STEP_MINUTES);
        // Keyboard navigation is constrained to the visible date range.
        const days = latest.current.visibleDates.length ? latest.current.visibleDates : [latest.current.date];
        const first = days[0];
        const last = days[days.length - 1];
        if (!withinVisibleRange(target, first, last, current.dateOnly || current.edge === "start")) return;
        update({...current, event: resizeEvent(current.original, current.edge, target, current.dateOnly), valid: true});
    };

    const startCurrent: ResizeActions["start"] = (event, edge, dateOnly, anchor, element, style, pointer, geometry) => {
        if (latest.current.readOnly || active.current || (pointer && (pointer.button !== 0 || !pointer.isPrimary)))
            return;
        pointer?.preventDefault();
        pointer?.stopPropagation();
        element.focus({preventScroll: true});
        const original = {...event, start: new Date(event.start.getTime()), end: new Date(event.end.getTime())};
        const initial: ResizeSession = {
            original,
            event: original,
            edge,
            dateOnly,
            anchor,
            geometry,
            lane: Number(style?.gridRow ?? 1) - 1,
            pointerId: pointer?.pointerId,
            valid: true,
        };
        update(initial);
        latest.current.onActiveChange(true);
        let frame = 0;
        let activated = !pointer;
        const beganAt = performance.now();
        const origin = pointer
            ? {x: pointer.clientX, y: pointer.clientY, touch: pointer.pointerType === "touch"}
            : null;
        const surface = element
            .closest(".calendar-event-wrap")
            ?.querySelector<HTMLElement>("[data-calendar-event]")
            ?.getBoundingClientRect();
        const grabOffset =
            pointer && surface && !dateOnly ? pointer.clientY - (edge === "start" ? surface.top : surface.bottom) : 0;
        let point = pointer ? {x: pointer.clientX, y: pointer.clientY} : null;
        const pointerTarget = (x: number, y: number) => {
            const root = rootRef.current;
            const hit = document.elementFromPoint(x, y);
            if (!root || !hit || !root.contains(hit)) return null;
            if (dateOnly) {
                const cell = hit.closest<HTMLElement>('[data-slot="calendar-drop"][data-date]:not([data-minute])');
                return cell ? new Date(cell.dataset.date!) : null;
            }
            if (hit.closest('[data-slot="all-day-band"], [data-slot="time-header"]')) return null;
            const targetColumn = hit.closest<HTMLElement>('[data-slot="time-column"]');
            if (!targetColumn) return null;
            const columns = Array.from(root.querySelectorAll<HTMLElement>('[data-slot="time-column"]'));
            const dayIndex = columns.indexOf(targetColumn);
            const targetDay = latest.current.visibleDates[dayIndex];
            if (!targetDay) return null;
            return timedResizeTarget({day: targetDay, top: targetColumn.getBoundingClientRect().top}, y, grabOffset);
        };
        const movePoint = () => {
            const current = active.current;
            if (!current || !point || !activated) return;
            const target = pointerTarget(point.x, point.y);
            const candidate = target
                ? resizeEvent(current.original, current.edge, target, current.dateOnly)
                : current.event;
            if (
                current.valid !== Boolean(target) ||
                candidate.start.getTime() !== current.event.start.getTime() ||
                candidate.end.getTime() !== current.event.end.getTime()
            ) {
                update({...current, event: candidate, valid: Boolean(target)});
            }
        };
        const scroll = () => {
            if (!active.current || !point) return;
            const root = rootRef.current;
            const hit = document.elementFromPoint(point.x, point.y);
            const viewport =
                dateOnly && hit?.closest('[data-slot="all-day-band"]')
                    ? hit.closest<HTMLElement>('[data-slot="all-day-band"]')
                    : root?.querySelector<HTMLElement>('[data-slot="calendar-scroll"]');
            if (activated && viewport && hit && root?.contains(hit)) {
                const rect = viewport.getBoundingClientRect();
                const delta = point.y > rect.bottom - 32 ? 8 : point.y < rect.top + 32 ? -8 : 0;
                if (delta) {
                    viewport.scrollTop += delta;
                    movePoint();
                }
            }
            frame = requestAnimationFrame(scroll);
        };
        const move = (e: PointerEvent) => {
            if (e.pointerId !== active.current?.pointerId) return;
            e.preventDefault();
            point = {x: e.clientX, y: e.clientY};
            if (!activated && origin) {
                const distance = Math.hypot(point.x - origin.x, point.y - origin.y);
                if (origin.touch && performance.now() - beganAt < TOUCH_DELAY) {
                    if (distance > DRAG_DISTANCE) finish(false);
                    return;
                }
                activated = distance >= DRAG_DISTANCE;
            }
            movePoint();
        };
        const up = (e: PointerEvent) => {
            if (e.pointerId !== active.current?.pointerId) return;
            point = {x: e.clientX, y: e.clientY};
            movePoint();
            e.preventDefault();
            finish(activated);
        };
        const cancel = () => finish(false);
        const cancelPointer = (e: PointerEvent) => {
            if (e.pointerId === active.current?.pointerId) cancel();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                cancel();
            } else if (
                active.current?.pointerId === undefined &&
                ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " "].includes(e.key)
            ) {
                e.preventDefault();
                e.stopPropagation();
                if (e.key === "Enter") finish(true);
                else if (e.key !== " ") keyboardStep(e.key);
            } else if (e.key === "Tab") cancel();
        };
        window.addEventListener("pointermove", move, {passive: false});
        window.addEventListener("pointerup", up, true);
        window.addEventListener("pointercancel", cancelPointer, true);
        window.addEventListener("keydown", onKey, true);
        window.addEventListener("blur", cancel);
        window.addEventListener("resize", cancel);
        if (point) frame = requestAnimationFrame(scroll);
        cleanup.current = () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up, true);
            window.removeEventListener("pointercancel", cancelPointer, true);
            window.removeEventListener("keydown", onKey, true);
            window.removeEventListener("blur", cancel);
            window.removeEventListener("resize", cancel);
        };
    };

    startImplementation.current = startCurrent;

    useEffect(() => {
        if (active.current) finish(false);
        // Navigation or read-only changes cancel a draft; callbacks use latest refs.
    }, [view, date.getTime(), readOnly]);
    useEffect(
        () => () => {
            cleanup.current?.();
            if (active.current) latest.current.onActiveChange(false);
        },
        [],
    );

    const keyCurrent: ResizeActions["key"] = (event, edge, dateOnly, anchor, element, key, style, geometry) => {
        if (!active.current) startCurrent(event, edge, dateOnly, anchor, element, style, undefined, geometry);
        if (key.startsWith("Arrow")) keyboardStep(key);
    };
    keyImplementation.current = keyCurrent;
    const actionsValue = useMemo(() => ({start, key}), [start, key]);
    return (
        <ResizeActionsContext.Provider value={actionsValue}>
            <ResizeSessionContext.Provider value={store}>
                {children}
                <span className="sr-only" role="status" aria-live="polite">
                    {session ? announce(session.event) : ""}
                </span>
            </ResizeSessionContext.Provider>
        </ResizeActionsContext.Provider>
    );
}

export const useCalendarResizeActions = () => {
    const actions = useContext(ResizeActionsContext);
    if (!actions) throw new Error("useCalendarResizeActions must be used within CalendarResizeProvider");
    return actions;
};

export const useCalendarResizeSelector = <T,>(select: (session: ResizeSession | null) => T): T => {
    const store = useContext(ResizeSessionContext);
    if (!store) throw new Error("useCalendarResizeSelector must be used within CalendarResizeProvider");
    return useSyncExternalStore(
        store.subscribe,
        () => select(store.get()),
        () => select(null),
    );
};

export const useCalendarResizeSession = () => useCalendarResizeSelector((session) => session);

export type {ResizeCommit};
