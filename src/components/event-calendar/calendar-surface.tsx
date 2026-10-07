import {useEffect, type ComponentProps} from "react";

import {Feedback} from "@dnd-kit/dom";
import {DragDropProvider} from "@dnd-kit/react";
import {startOfWeek} from "date-fns";

import {cn} from "../../lib/utils";
import {useCalendarStyle} from "../../lib/calendar-style";
import {useCalendarTranslation} from "../../i18n/translations";
import {AgendaView} from "./agenda-view";
import {CALENDAR_SENSORS} from "./calendar-sensors";
import {CalendarContextProvider} from "./calendar-context";
import {CalendarResizeProvider} from "./calendar-resize-context";
import {CalendarToolbar} from "./calendar-toolbar";
import {daysFrom, monthDays} from "../../core/dates";
import {EventEditor} from "./event-editor";
import {Button} from "../ui/button";
import {MonthView} from "./month-view";
import {TimeView} from "./time-view";
import type {EventCalendarProps} from "./types";
import {useCalendarController} from "./use-calendar-controller";

const calendarPlugins: NonNullable<ComponentProps<typeof DragDropProvider>["plugins"]> = (defaults) => [
    ...defaults,
    Feedback.configure({dropAnimation: null}),
];

/**
 * Reusable controlled-event calendar, independent of storage or app models.
 *
 * @param options Consumer data, callbacks and presentation options.
 * @return The event calendar surface.
 */
const CalendarSurface = (options: EventCalendarProps) => {
    const {tCalendar} = useCalendarTranslation();
    const {scopeProps, rootRef: themeRef} = useCalendarStyle();
    const {className} = options;
    const {actions, config, date, view, now, draft, rootRef, announcement, rejection} = useCalendarController(options);
    useEffect(() => {
        if (!rejection) return;
        const document = rootRef.current?.ownerDocument;
        const feedback = rootRef.current?.querySelector('[data-slot="move-rejection"]');
        const dismiss = (event: Event) => {
            // A consumed drag completion key is still the same interaction.
            if (!event.defaultPrevented && !feedback?.contains(event.target as Node)) actions.dismissRejection();
        };
        document?.addEventListener("pointerdown", dismiss, true);
        document?.addEventListener("keydown", dismiss, true);
        return () => {
            document?.removeEventListener("pointerdown", dismiss, true);
            document?.removeEventListener("keydown", dismiss, true);
        };
    }, [actions, rejection, rootRef]);
    const visibleDates =
        view === "month"
            ? monthDays(date)
            : view === "week"
              ? daysFrom(startOfWeek(date, {weekStartsOn: 0}), 7)
              : view === "day"
                ? [date]
                : [];

    return (
        <div
            {...scopeProps}
            style={options.style}
            role="region"
            aria-label={tCalendar(($) => $.root.label)}
            className={cn(
                "event-calendar flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-background text-foreground",
                className,
            )}
            ref={(node) => {
                rootRef.current = node;
                if (themeRef) themeRef.current = node;
            }}
            tabIndex={-1}
            onKeyDown={actions.handleShortcut}
        >
            <CalendarContextProvider actions={actions} config={config} now={now}>
                <CalendarResizeProvider
                    date={date}
                    readOnly={config.readOnly}
                    rootRef={rootRef}
                    visibleDates={visibleDates}
                    view={view}
                    onActiveChange={actions.resizeActive}
                    onCommit={actions.commitResize}
                >
                    <DragDropProvider
                        sensors={CALENDAR_SENSORS}
                        plugins={calendarPlugins}
                        onDragEnd={actions.endDrag}
                        onDragStart={actions.beginDrag}
                    >
                        <CalendarToolbar
                            changeDate={actions.changeDate}
                            changeView={actions.changeView}
                            create={actions.create}
                            date={date}
                            isReadOnly={config.readOnly}
                            now={now}
                            view={view}
                        />
                        {view === "month" && <MonthView date={date} events={options.events} />}
                        {(view === "week" || view === "day") && (
                            <TimeView date={date} events={options.events} key={view} view={view} />
                        )}
                        {view === "agenda" && <AgendaView date={date} events={options.events} />}
                    </DragDropProvider>
                </CalendarResizeProvider>
                {draft && (
                    <EventEditor
                        draft={draft}
                        onClose={actions.closeDraft}
                        onCreate={actions.addDraft}
                        onDelete={actions.deleteDraft}
                        onUpdate={actions.updateDraft}
                    />
                )}
                <span className="sr-only" role="status">
                    {announcement}
                </span>
                {rejection && (
                    <div data-slot="move-rejection" className="flex items-center justify-between gap-2 px-3 py-1">
                        <span role="alert" className="text-sm text-destructive">
                            {rejection.reason ?? tCalendar(($) => $.announcement.moveRejected)}
                        </span>
                        <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => {
                                actions.dismissRejection();
                                rootRef.current?.focus();
                            }}
                        >
                            {tCalendar(($) => $.announcement.dismissRejection)}
                        </Button>
                    </div>
                )}
            </CalendarContextProvider>
        </div>
    );
};

export {CalendarSurface};
