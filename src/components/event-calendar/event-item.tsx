import {displayTitle} from "./event-display";
import type {CSSProperties} from "react";

import {useDraggable} from "@dnd-kit/react";
import {isSameDay} from "date-fns";

import {cn} from "../../lib/utils";
import {useCalendarTranslation} from "../../i18n/translations";
import {useCalendarStyle} from "../../lib/calendar-style";
import {useCalendarActions, useCalendarConfig, useCalendarNow} from "./calendar-context";
import {buttonVariants} from "../ui/button";
import {eventTime} from "../../core/dates";
import {EventContinuation} from "./event-continuation";
import {eventDetailRange} from "./event-details";
import {EventLabel} from "./event-label";
import type {EventLabelProps} from "./event-label";
import {useMovePreview} from "./use-move-preview";
import {useCalendarResizeSelector} from "./calendar-resize-context";
import {EventResizeHandles} from "./event-resize-handles";
import {eventCapabilities} from "./event-variants";
import type {EventVariantProps} from "./event-variants";
import type {CalendarEvent, CalendarView} from "./types";

type EventItemVariant = EventVariantProps & {className?: string};
type DraggableVariant = Exclude<EventItemVariant, {variant: "month-list" | "agenda"}>;

interface EventSurfaceProps {
    variant: EventItemVariant;
    event: CalendarEvent;
    surfaceView: CalendarView;
    renderView: CalendarView;
    style?: CSSProperties;
    isDragging: boolean;
    isResizing: boolean;
    elementRef?: (element: Element | null) => void;
    movePreview?: boolean;
}

/**
 * Composes geometry classes separately from interaction and segment metadata.
 *
 * @param props Event variant and resolved preview state.
 * @return Calendar event classes.
 */
const eventSurfaceClasses = ({variant, labelView}: {variant: EventItemVariant; labelView: CalendarView}) =>
    cn(
        "calendar-event",
        labelView === "agenda" ? "calendar-event-agenda" : "calendar-event-bar",
        (labelView === "day" || labelView === "week") && "calendar-event-timed",
        (variant.variant !== "bar" || variant.isFirst) && "calendar-event-first",
        (variant.variant !== "bar" || variant.isLast) && "calendar-event-last",
        variant.variant === "bar" && variant.className,
    );

/**
 * Shared native event button with current context values and presentation.
 *
 * @param props Event variant and resolved preview state.
 * @return The event button and its label.
 */
const EventSurface = ({
    variant,
    event,
    surfaceView,
    renderView,
    style,
    isDragging,
    isResizing,
    elementRef,
    movePreview = false,
}: EventSurfaceProps) => {
    const {tCalendar, dateLocale} = useCalendarTranslation();
    const {scopeProps} = useCalendarStyle();
    const {select} = useCalendarActions();
    const {readOnly, renderEvent} = useCalendarConfig();
    const now = useCalendarNow();
    const capabilities = eventCapabilities(variant, readOnly);
    const details = variant.variant === "popover-row";
    const onSelect = variant.variant === "popover-row" && variant.onSelectOverride ? variant.onSelectOverride : select;
    const hasLabel = variant.variant === "bar" ? variant.hasLabel : true;
    const hasTime = variant.variant === "bar" ? variant.hostView === "month" : true;
    const segmentStart = variant.variant === "timed" ? variant.segmentStart : event.start;
    const segmentEnd = variant.variant === "timed" ? variant.segmentEnd : event.end;
    const hasPreviousSegment = variant.variant === "timed" && variant.continuesBefore;
    const hasNextSegment = variant.variant === "timed" && variant.continuesAfter;
    const labelView = capabilities.labelView;
    const time = event.allDay
        ? tCalendar(($) => $.common.allDay)
        : `${eventTime(event.start, dateLocale)} - ${eventTime(event.end, dateLocale)}`;
    const shownTitle = displayTitle(event.title, tCalendar);
    const continued = !isSameDay(variant.day, event.start);
    const labelProps: EventLabelProps = {
        details: details,
        event: event,
        hasLabel: hasLabel,
        hasTime: hasTime,
        isResizing: isResizing,
        labelView: labelView,
        renderEvent: renderEvent,
        renderView: renderView,
        segmentEnd: segmentEnd,
        segmentStart: segmentStart,
    };

    return (
        <button
            {...scopeProps}
            data-calendar-event={event.id}
            data-color={event.color ?? "sky"}
            data-continuation-after={hasNextSegment}
            data-continuation-before={hasPreviousSegment}
            data-dragging={isDragging}
            data-resizing={isResizing || undefined}
            data-past={event.end < now}
            data-segment-end={segmentEnd.toISOString()}
            data-segment-start={segmentStart.toISOString()}
            data-view={surfaceView}
            ref={elementRef}
            style={{...scopeProps.style, ...style}}
            type="button"
            tabIndex={movePreview ? -1 : undefined}
            aria-label={
                details
                    ? tCalendar(($) => $.event.editLabel, {
                          title: shownTitle,
                          range: eventDetailRange(event, {
                              locale: dateLocale,
                              allDayLabel: tCalendar(($) => $.common.allDay),
                              allDayRange: (start, end) => tCalendar(($) => $.event.allDayRange, {start, end}),
                              patterns: {
                                  day: tCalendar(($) => $.formats.detailDay),
                                  time: tCalendar(($) => $.formats.detailTime),
                                  dateTime: tCalendar(($) => $.formats.detailDateTime),
                              },
                          }),
                      })
                    : continued
                      ? tCalendar(($) => $.event.labelContinued, {title: shownTitle, time})
                      : tCalendar(($) => $.event.label, {title: shownTitle, time})
            }
            className={
                details
                    ? cn(
                          buttonVariants({variant: "ghost"}),
                          "h-auto w-full justify-start gap-2 py-2 text-left whitespace-normal select-none touch-none",
                      )
                    : eventSurfaceClasses({variant: variant, labelView: labelView})
            }
            data-compact={segmentEnd.getTime() - segmentStart.getTime() < 2700000}
            onClick={(e) => {
                e.stopPropagation();
                if (!isDragging) {
                    onSelect(event);
                }
            }}
        >
            <EventContinuation hasNext={hasNextSegment} hasPrevious={hasPreviousSegment}>
                <EventLabel {...labelProps} />
            </EventContinuation>
        </button>
    );
};

/**
 * Attaches drag interactions only to variants that can move.
 *
 * @param props Draggable variant and active resize state.
 * @return A draggable event surface.
 */
const DraggableEvent = ({
    variant,
    isResizing,
    moving,
}: {
    variant: DraggableVariant;
    isResizing: boolean;
    moving: boolean;
}) => {
    const resizing = useCalendarResizeSelector((session) => session !== null);
    const {readOnly} = useCalendarConfig();
    const capabilities = eventCapabilities(variant, readOnly);
    const event = variant.event;
    const day = variant.day;
    const {ref, isDragging} = useDraggable({
        disabled: resizing,
        data: {
            anchor: day,
            moveLane: variant.variant === "bar" ? (variant.hostView === "month" ? "month" : "all-day") : "timed",
            moveSource: variant.variant === "popover-row" ? "popup" : "grid",
            dragScope: capabilities.dragScope,
            event: event,
        },
        id: JSON.stringify([capabilities.dragScope, event.id, day.getTime()]),
    });
    const previewStyle: CSSProperties = {
        gridRow: variant.variant === "bar" ? variant.lane + 1 : undefined,
        opacity: isDragging || moving ? 0 : undefined,
        pointerEvents: isDragging || moving ? "none" : undefined,
    };

    return (
        <EventSurface
            elementRef={ref}
            event={event}
            isDragging={isDragging}
            isResizing={isResizing}
            renderView={capabilities.renderView}
            style={previewStyle}
            surfaceView={capabilities.labelView}
            variant={variant}
        />
    );
};

/**
 * Chooses the persistent event presentation from its explicit variant.
 *
 * @param variant Typed event presentation and interaction needs.
 * @return An event surface with only the variant's capabilities.
 */
const EventItem = (variant: EventItemVariant) => {
    const movePreview = useMovePreview();
    const moving = movePreview?.id === variant.event.id;
    const active = useCalendarResizeSelector((session) => session?.original.id === variant.event.id);
    const {readOnly} = useCalendarConfig();
    const capabilities = eventCapabilities(variant, readOnly);
    if (!capabilities.draggable || variant.variant === "month-list" || variant.variant === "agenda") {
        return (
            <EventSurface
                event={variant.event}
                isDragging={false}
                isResizing={false}
                renderView={capabilities.renderView}
                style={variant.variant === "bar" ? {gridRow: variant.lane + 1} : undefined}
                surfaceView={capabilities.labelView}
                variant={variant}
            />
        );
    }
    if (variant.variant === "popover-row") {
        return <DraggableEvent isResizing={false} moving={moving} variant={variant} />;
    }
    const axis = capabilities.resizeAxis ?? (active && variant.variant === "timed" ? "time" : null);
    const height = variant.variant === "timed" ? variant.height : undefined;

    return (
        <div
            className="calendar-event-wrap"
            data-move-source={moving || undefined}
            data-resizing={active || undefined}
            style={{gridRow: variant.variant === "bar" ? variant.lane + 1 : undefined}}
        >
            <DraggableEvent isResizing={active} moving={moving} variant={variant} />
            {!moving && axis && (capabilities.resizable || active) && (
                <EventResizeHandles
                    axis={axis}
                    day={variant.day}
                    event={variant.event}
                    geometry={variant.variant === "timed" ? variant.geometry : undefined}
                    gridRow={variant.variant === "bar" ? variant.lane + 1 : undefined}
                    height={height}
                />
            )}
        </div>
    );
};

/** Static destination surface: no drag registration or endpoint controls. */
const EventMovePreview = (variant: EventItemVariant) => {
    const capabilities = eventCapabilities(variant, true);
    return (
        <div
            data-move-preview={variant.event.id}
            className={cn("pointer-events-none", variant.variant === "timed" && "h-full")}
            aria-hidden="true"
            style={
                variant.variant === "bar"
                    ? {
                          position: "absolute",
                          left: variant.hostView === "month" ? 0 : 4,
                          right: variant.hostView === "month" ? 0 : 4,
                          top: variant.lane * 28 + (variant.hostView === "month" ? 0 : 4),
                          zIndex: 20,
                      }
                    : undefined
            }
        >
            <EventSurface
                variant={variant}
                event={variant.event}
                surfaceView={capabilities.labelView}
                renderView={capabilities.renderView}
                isDragging={false}
                isResizing={false}
                movePreview={true}
            />
        </div>
    );
};

export {EventItem, EventMovePreview};
