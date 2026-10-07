import type {ReactNode} from "react";
import {useCalendarTranslation} from "../../i18n/translations";

interface EventContinuationProps {
    children: ReactNode;
    hasPrevious?: boolean;
    hasNext?: boolean;
}

/**
 * Labels clipped day segments without creating separate consumer events.
 *
 * @param props Segment continuation state and label.
 * @return The label with accessible continuation markers.
 */
const EventContinuation = ({children, hasPrevious, hasNext}: EventContinuationProps) => {
    const {tCalendar} = useCalendarTranslation();
    return (
        <>
            {hasPrevious && (
                <span
                    aria-label={tCalendar(($) => $.event.continuesBefore)}
                    className="absolute top-0.5 right-1 text-xs opacity-70"
                >
                    «
                </span>
            )}
            {children}
            {hasNext && (
                <span
                    aria-label={tCalendar(($) => $.event.continuesAfter)}
                    className="absolute right-1 bottom-0.5 text-xs opacity-70"
                >
                    »
                </span>
            )}
        </>
    );
};

export {EventContinuation};
