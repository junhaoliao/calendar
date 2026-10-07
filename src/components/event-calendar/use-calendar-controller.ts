import {displayTitle} from "./event-display";
import {useEffect, useMemo, useRef, useState} from "react";
import type {KeyboardEvent} from "react";

import type {DragEndEvent, DragStartEvent} from "@dnd-kit/react";
import {addHours, endOfDay, startOfDay} from "date-fns";

import {
    DEFAULT_TIMED_DURATION_MINUTES,
    copyEvent,
    eventDatesChanged,
    moveAnchor,
    moveTarget,
    resolveMove,
    timedConversionDuration,
} from "../../core/move";
import type {MoveResolution} from "../../core/move";
import {VIEWS} from "../../core/dates";
import {RESIZE_STEP_MINUTES} from "../../core/resize";
import {useCalendarTranslation} from "../../i18n/translations";
import type {CalendarActions, CalendarConfig} from "./calendar-context";
import type {ResizeCommit} from "./calendar-resize-context";
import type {
    CalendarEvent,
    CalendarNotification,
    CalendarView,
    DropData,
    EventDraft,
    EventCalendarProps,
    NewCalendarEvent,
    EventMoveAnchor,
    EventMoveLane,
} from "./types";

interface DragPickup {
    id: string;
    startTime: number;
    endTime: number;
    allDay: boolean;
    anchor: EventMoveAnchor;
}

/**
 * Owns navigation, draft selection, clock and drag mutations.
 *
 * @param options Controlled consumer callbacks and initial state.
 * @return State and actions consumed by the calendar surface.
 */
const useCalendarController = ({
    events,
    onEventUpdate,
    onEventClick,
    onSlotClick,
    onDateChange,
    onViewChange,
    onNotification,
    onMoveRejected,
    date: controlledDate,
    onEventAdd,
    onEventDelete,
    view: controlledView,
    initialDate,
    initialView = "month",
    now: fixedNow,
    readOnly = false,
    renderEvent,
    resolveEventMove,
    minimumTimedEventWidth,
    defaultTimedDurationMinutes = DEFAULT_TIMED_DURATION_MINUTES,
}: EventCalendarProps) => {
    const {tCalendar} = useCalendarTranslation();
    const [clock, setClock] = useState(() => new Date());
    const now = fixedNow ?? clock;
    const [localDate, setLocalDate] = useState(() => initialDate ?? now);
    const [localView, setLocalView] = useState(initialView);
    const [draft, setDraft] = useState<EventDraft | null>(null);
    const [lastNotification, setLastNotification] = useState<CalendarNotification | null>(null);
    const originalTitle = lastNotification?.event.title ?? "";
    const shownTitle = lastNotification ? displayTitle(originalTitle, tCalendar) : originalTitle;
    const announcement = lastNotification
        ? {
              added: tCalendar(($) => $.announcement.added, {title: shownTitle}),
              updated: tCalendar(($) => $.announcement.updated, {title: shownTitle}),
              deleted: tCalendar(($) => $.announcement.deleted, {title: shownTitle}),
              moved: tCalendar(($) => $.announcement.moved, {title: shownTitle}),
              resized: tCalendar(($) => $.announcement.resized, {title: shownTitle}),
          }[lastNotification.action]
        : "";
    const rootRef = useRef<HTMLDivElement>(null);
    const dragActive = useRef(false);
    const dragPickup = useRef<DragPickup | null>(null);
    const resolution = useRef<{
        key: string;
        event: CalendarEvent;
        fields: CalendarEvent;
        resolver: EventCalendarProps["resolveEventMove"];
        duration: number;
        result: MoveResolution<CalendarEvent>;
    } | null>(null);
    const [rejection, setRejection] = useState<{reason: string | null} | null>(null);
    const suppressClick = useRef(false);
    const date = controlledDate ?? localDate;
    const view = controlledView ?? localView;
    const config = useMemo<CalendarConfig>(
        () => ({
            readOnly: readOnly,
            renderEvent: renderEvent,
            minimumTimedEventWidth: minimumTimedEventWidth,
            defaultDuration: timedConversionDuration(defaultTimedDurationMinutes),
            resolveEventMove,
        }),
        [defaultTimedDurationMinutes, minimumTimedEventWidth, readOnly, renderEvent, resolveEventMove],
    );
    const current = {
        resolveEventMove,
        controlledDate: controlledDate,
        controlledView: controlledView,
        config: config,
        draft: draft,
        events: events,
        onDateChange: onDateChange,
        onEventAdd: onEventAdd,
        onEventClick: onEventClick,
        onEventDelete: onEventDelete,
        onEventUpdate: onEventUpdate,
        onNotification: onNotification,
        onMoveRejected,
        onSlotClick: onSlotClick,
        onViewChange: onViewChange,
        readOnly: readOnly,
        view: view,
    };
    const latest = useRef(current);
    latest.current = current;
    useEffect(() => {
        if (fixedNow) {
            return () => {
                // Fixed clocks do not install a timer.
            };
        }
        const timer = window.setInterval(() => {
            setClock(new Date());
        }, 60000);

        return () => {
            window.clearInterval(timer);
        };
    }, [fixedNow]);
    const actions = useMemo<CalendarActions>(() => {
        const suppressNextClick = () => {
            suppressClick.current = true;
            window.setTimeout(() => {
                suppressClick.current = false;
            }, 0);
        };
        const announce = (notification: CalendarNotification) => {
            setRejection(null);
            setLastNotification(notification);
            latest.current.onNotification?.(notification);
        };
        const changeDate = (next: Date) => {
            if (typeof latest.current.controlledDate === "undefined") {
                setLocalDate(next);
            }
            latest.current.onDateChange?.(next);
        };
        const changeView = (next: CalendarView) => {
            if (typeof latest.current.controlledView === "undefined") {
                setLocalView(next);
            }
            latest.current.onViewChange?.(next);
        };
        const select = (event: CalendarEvent) => {
            if (dragActive.current || suppressClick.current) {
                return;
            }
            if (latest.current.onEventClick) {
                latest.current.onEventClick(event);
            } else if (!latest.current.readOnly) {
                setDraft({mode: "edit", event: event});
            }
        };
        const create = (start: Date, allDay = false) => {
            if (latest.current.readOnly || dragActive.current || suppressClick.current) {
                return;
            }
            const slot = allDay
                ? {allDay: true, end: endOfDay(start), start: startOfDay(start)}
                : {allDay: false, end: addHours(start, 1), start: start};
            if (latest.current.onSlotClick) {
                latest.current.onSlotClick(slot);
            } else {
                setDraft({mode: "create", event: {title: "", ...slot}});
            }
        };
        const openDay = (day: Date) => {
            changeDate(new Date(day));
            changeView("day");
            rootRef.current?.focus();
        };
        const addDraft = (event: NewCalendarEvent) => {
            if (latest.current.readOnly) {
                return;
            }
            latest.current.onEventAdd?.(event);
            announce({action: "added", event: event});
        };
        const updateDraft = (event: CalendarEvent) => {
            if (latest.current.readOnly) {
                return;
            }
            latest.current.onEventUpdate?.(event);
            announce({action: "updated", event: event});
        };
        const deleteDraft = (id: string) => {
            const draft = latest.current.draft;
            if (latest.current.readOnly || draft?.mode !== "edit") {
                return;
            }
            latest.current.onEventDelete?.(id);
            announce({action: "deleted", event: draft.event});
        };
        const closeDraft = () => {
            setDraft(null);
            rootRef.current?.focus();
        };
        const handleShortcut = (event: KeyboardEvent<HTMLDivElement>) => {
            const {draft} = latest.current;
            if (
                draft ||
                dragActive.current ||
                event.altKey ||
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                (event.target as HTMLElement).closest(
                    "input, textarea, select, [contenteditable=true], [role=dialog], [role=menu], [role=listbox]",
                )
            ) {
                return;
            }
            const next = VIEWS.find((item) => item[0] === event.key.toLowerCase());
            if (next) {
                event.preventDefault();
                changeView(next);
            }
        };
        const beginDrag = (event: DragStartEvent) => {
            resolution.current = null;
            setRejection(null);
            dragActive.current = true;
            const source = event.operation.source?.data as
                | {
                      event?: CalendarEvent;
                      anchor?: Date;
                      moveLane?: EventMoveLane;
                      moveSource?: EventMoveAnchor["source"];
                  }
                | undefined;
            const original = source?.event;
            const anchor = source?.anchor;
            const startTime = original?.start instanceof Date ? original.start.getTime() : NaN;
            const endTime = original?.end instanceof Date ? original.end.getTime() : NaN;
            const anchorTime = anchor instanceof Date ? anchor.getTime() : NaN;
            dragPickup.current =
                original &&
                typeof original.id === "string" &&
                Number.isFinite(startTime) &&
                Number.isFinite(endTime) &&
                Number.isFinite(anchorTime)
                    ? {
                          id: original.id,
                          startTime,
                          endTime,
                          allDay: Boolean(original.allDay),
                          anchor: moveAnchor(
                              original,
                              new Date(anchorTime),
                              source?.moveLane ?? (original.allDay ? "all-day" : "timed"),
                              source?.moveSource ?? "grid",
                          ),
                      }
                    : null;
        };
        const resolveDrag = (data: DropData) => {
            const pickup = dragPickup.current;
            const target = moveTarget(data);
            if (!pickup || !target || latest.current.readOnly) return null;
            const current = latest.current.events.find((item) => item.id === pickup.id);
            if (
                !current ||
                current.start.getTime() !== pickup.startTime ||
                current.end.getTime() !== pickup.endTime ||
                Boolean(current.allDay) !== pickup.allDay
            )
                return null;
            const key = `${target.lane}:${target.date.getTime()}:${target.minute}`;
            const cached = resolution.current;
            const resolver = latest.current.resolveEventMove;
            const duration = latest.current.config.defaultDuration;
            if (
                cached?.key === key &&
                cached.event === current &&
                Object.keys(cached.fields).length === Object.keys(current).length &&
                Object.keys(current).every((key) =>
                    Object.is(Reflect.get(cached.fields, key), Reflect.get(current, key)),
                ) &&
                cached.resolver === resolver &&
                cached.duration === duration
            )
                return cached.result;
            const result = resolveMove(current, pickup.anchor, target, resolver, duration);
            resolution.current = {key, event: current, fields: {...current}, resolver, duration, result};
            return result;
        };
        const endDrag = (event: DragEndEvent) => {
            const pickup = dragPickup.current;
            dragActive.current = false;
            // The pointer release may generate a click on a freshly moved event/slot.
            suppressNextClick();
            if (
                event.canceled ||
                event.nativeEvent?.type === "resize" ||
                !event.operation.target ||
                !pickup ||
                latest.current.readOnly
            ) {
                dragPickup.current = null;
                resolution.current = null;
                return;
            }
            const source = event.operation.source?.data as {event: CalendarEvent; anchor: Date} | undefined;
            const target = event.operation.target.data as DropData;
            if (!source || !(target.date instanceof Date)) {
                dragPickup.current = null;
                resolution.current = null;
                return;
            }
            const outcome = resolveDrag(target);
            const current = latest.current.events.find((item) => item.id === pickup.id);
            dragPickup.current = null;
            resolution.current = null;
            if (!outcome || !current) return;
            if (outcome.status === "rejected") {
                setRejection({reason: outcome.reason});
                latest.current.onMoveRejected?.({event: copyEvent(current), reason: outcome.reason});
                return;
            }
            const updated = outcome.event;
            if (!eventDatesChanged(current, updated)) {
                return;
            }
            latest.current.onEventUpdate?.(updated);
            announce({action: "moved", event: updated});
        };
        const resizeActive = (active: boolean) => {
            dragActive.current = active;
            if (!active) {
                suppressNextClick();
            }
        };
        const commitResize = ({original, event: candidate, edge}: ResizeCommit) => {
            const {events, readOnly, onEventUpdate} = latest.current;
            const current = events.find((event) => event.id === original.id);
            if (readOnly || !current || Boolean(current.allDay) !== Boolean(original.allDay)) {
                return;
            }
            const nextEdge = candidate[edge];
            if (nextEdge.getTime() === original[edge].getTime()) {
                return;
            }
            const updated = {...current, [edge]: nextEdge};
            const minimum = current.allDay ? 0 : RESIZE_STEP_MINUTES * 60000;
            if (updated.end.getTime() - updated.start.getTime() < minimum || !eventDatesChanged(current, updated)) {
                return;
            }
            onEventUpdate?.(updated);
            announce({action: "resized", event: updated});
        };

        return {
            select,
            create,
            openDay,
            changeDate,
            changeView,
            addDraft,
            updateDraft,
            deleteDraft,
            closeDraft,
            handleShortcut,
            beginDrag,
            endDrag,
            resolveDrag,
            dismissRejection: () => setRejection(null),
            resizeActive,
            commitResize,
        };
    }, []);

    return {
        actions: actions,
        announcement,
        rejection,
        date,
        draft,
        now,
        rootRef,
        view,
        config: config,
    };
};
export {useCalendarController};
