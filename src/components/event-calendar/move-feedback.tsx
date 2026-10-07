import {useState} from "react";
import {useDragDropMonitor} from "@dnd-kit/react";
import {useCalendarTranslation} from "../../i18n/translations";
import {displayTitle} from "./event-display";
import {format} from "date-fns";
import {useMoveResolution} from "./use-move-preview";

/** Localized move announcements and feedback without changing the grid geometry. */
const MoveFeedback = () => {
    const outcome = useMoveResolution();
    const {tCalendar, dateLocale} = useCalendarTranslation();
    const event = outcome?.status === "accepted" ? outcome.event : null;
    const [cancelled, setCancelled] = useState(false);
    useDragDropMonitor({
        onDragStart: () => setCancelled(false),
        onDragEnd: (drag) => setCancelled(drag.canceled || !drag.operation.target),
    });
    const range = event
        ? event.allDay
            ? tCalendar(($) => $.event.allDayRange, {
                  start: format(
                      event.start,
                      tCalendar(($) => $.formats.dayCompact),
                      {locale: dateLocale},
                  ),
                  end: format(
                      event.end,
                      tCalendar(($) => $.formats.dayCompact),
                      {locale: dateLocale},
                  ),
              })
            : `${format(
                  event.start,
                  tCalendar(($) => $.formats.resizeInstant),
                  {locale: dateLocale},
              )} – ${format(
                  event.end,
                  tCalendar(($) => $.formats.resizeInstant),
                  {locale: dateLocale},
              )}`
        : "";
    return (
        <>
            <span className="sr-only" role="status" aria-atomic="true" data-slot="move-announcement">
                {event
                    ? tCalendar(($) => $.announcement.movePreview, {title: displayTitle(event.title, tCalendar), range})
                    : cancelled
                      ? tCalendar(($) => $.announcement.moveCancelled)
                      : null}
            </span>
            {outcome?.status === "rejected" && (
                // A zero-height anchor keeps mid-drag feedback out of the flex layout, so
                // the scroll viewport and drop targets don't move under the pointer.
                <div className="pointer-events-none relative z-50 h-0 shrink-0">
                    <div
                        role="alert"
                        data-slot="move-preview-rejection"
                        className="absolute inset-x-0 bottom-0 border-t border-border/70 bg-background/95 px-3 py-1 text-sm text-destructive"
                    >
                        {outcome.reason ?? tCalendar(($) => $.announcement.moveRejected)}
                    </div>
                </div>
            )}
        </>
    );
};

export {MoveFeedback};
