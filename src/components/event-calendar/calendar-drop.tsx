import {type CSSProperties, type ReactNode, useMemo, useRef} from "react";
import {format} from "date-fns";
import type {Locale} from "date-fns";

import {useDroppable} from "@dnd-kit/react";

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
    const {ref, isDropTarget} = useDroppable({
        collisionDetector: (input) => calendarCollision(input, elementRef.current),
        data: {
            lane: allDay ? "all-day" : minute === undefined ? "month" : "timed",
            allDay,
            date,
            minute,
        },
        disabled: disabled,
        id: id,
    });
    const start = atMinute(date, minute ?? 540);
    const startTime = date.getTime();
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
        <div
            className={cn("relative min-w-0", isDropTarget && "bg-accent ring-1 ring-inset ring-ring", className)}
            style={style}
            data-date={date.toISOString()}
            data-minute={minute}
            data-slot="calendar-drop"
            data-drop-target={isDropTarget || undefined}
            ref={(element) => {
                elementRef.current = element;
                ref(element);
            }}
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
