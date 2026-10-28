import {type CSSProperties, memo, type ReactNode, type RefObject, useCallback, useMemo, useRef, useState} from "react";
import {format} from "date-fns";
import type {Locale} from "date-fns";

import {useDroppable} from "@dnd-kit/react";
import {useIsomorphicLayoutEffect} from "@dnd-kit/react/hooks";

import {cn} from "../../lib/utils";
import {useCalendarTranslation} from "../../i18n/translations";
import {calendarCollision} from "./calendar-collision";
import {atMinute} from "../../core/dates";
import type {DropData} from "./types";

interface CalendarDropProps extends DropData {
    id: string;
    className?: string;
    children?: ReactNode;
    style?: CSSProperties;
    disabled: boolean;
    onCreate: (start: Date, allDay?: boolean) => void;
}

interface SlotDroppableProps {
    id: string;
    data: DropData;
    elementRef: RefObject<HTMLDivElement | null>;
    onDropTargetChange: (isDropTarget: boolean) => void;
}

/**
 * The slot's dnd-kit registration. It renders nothing; as a later sibling of the slot
 * element, its layout effects run after that element is attached.
 *
 * It is never disabled: read-only calendars render no drag sources and ignore drops, and
 * toggling every slot while a drop settles makes dnd-kit recompute collisions per slot.
 */
const SlotDroppable = memo(({id, data, elementRef, onDropTargetChange}: SlotDroppableProps) => {
    const collisionDetector = useCallback(
        (input: Parameters<typeof calendarCollision>[0]) => calendarCollision(input, elementRef.current),
        [elementRef],
    );
    const {isDropTarget} = useDroppable({collisionDetector, data, element: elementRef, id});
    // Report only while targeted: an unchanged report from every slot at mount makes each
    // slot render twice on its next update.
    useIsomorphicLayoutEffect(() => {
        if (!isDropTarget) return undefined;
        onDropTargetChange(true);
        return () => {
            onDropTargetChange(false);
        };
    }, [isDropTarget, onDropTargetChange]);
    return null;
});
SlotDroppable.displayName = "SlotDroppable";

/**
 * A labelled, keyboard-operable slot and dnd-kit destination.
 */
const CalendarDrop = ({
    id,
    date,
    minute,
    allDay,
    className,
    children,
    disabled,
    onCreate,
    style,
}: CalendarDropProps) => {
    const {tCalendar, dateLocale} = useCalendarTranslation();
    const elementRef = useRef<HTMLDivElement | null>(null);
    const [isDropTarget, setIsDropTarget] = useState(false);
    const startTime = date.getTime();
    const lane = allDay ? "all-day" : minute === undefined ? "month" : "timed";
    const data = useMemo<DropData>(
        () => ({lane, allDay, date: new Date(startTime), minute}),
        [lane, allDay, startTime, minute],
    );
    const start = atMinute(date, minute ?? 540);
    const label = useMemo(
        () =>
            slotLabel(
                atMinute(new Date(startTime), minute ?? 540),
                allDay,
                (kind, values) =>
                    kind === "allDay"
                        ? tCalendar(($) => $.slot.addAllDay, values)
                        : tCalendar(($) => $.slot.addAt, values),
                dateLocale,
            ),
        [startTime, minute, allDay, tCalendar, dateLocale],
    );

    return (
        <>
            <div
                className={cn("relative min-w-0", className)}
                style={style}
                data-date={date.toISOString()}
                data-minute={minute}
                data-slot="calendar-drop"
                data-drop-target={(isDropTarget && !disabled) || undefined}
                ref={elementRef}
            >
                <button
                    aria-label={label}
                    className="absolute inset-0 size-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    disabled={disabled}
                    type="button"
                    onClick={() => {
                        onCreate(start, allDay);
                    }}
                />
                {children}
            </div>
            <SlotDroppable data={data} elementRef={elementRef} id={id} onDropTargetChange={setIsDropTarget} />
        </>
    );
};

/** Required translation lookup keeps this formatter independent of React hooks. */
const slotLabel = (
    start: Date,
    allDay: boolean | undefined,
    translate: (kind: "allDay" | "timed", values: {date: string; time: string}) => string,
    locale: Locale,
): string => {
    const english = locale.code?.startsWith("en");
    const values = {
        date: format(start, english ? "MMMM d, yyyy" : "PPP", {locale}),
        time: format(start, english ? "h:mm a" : "p", {locale}),
    };
    return translate(allDay ? "allDay" : "timed", values);
};

export {CalendarDrop, slotLabel};
