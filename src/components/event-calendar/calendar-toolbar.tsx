import {format} from "date-fns";
import {CalendarCheck2Icon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon} from "lucide-react";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {Button} from "../ui/button";
import {useCalendarTranslation} from "../../i18n/translations";
import {atMinute, calendarHeading, navigateDate, VIEWS} from "../../core/dates";
import type {CalendarView} from "./types";

interface CalendarToolbarProps {
    date: Date;
    view: CalendarView;
    now: Date;
    isReadOnly: boolean;
    changeDate: (date: Date) => void;
    changeView: (view: CalendarView) => void;
    create: (date: Date) => void;
}

/**
 * Navigation and view controls shared by all calendar views.
 *
 * @param props Navigation state and callbacks.
 * @param props.create Opens an event draft at the supplied time.
 * @return Navigation buttons and a view-selection menu.
 */
const CalendarToolbar = ({date, view, now, isReadOnly, changeDate, changeView, create}: CalendarToolbarProps) => {
    const {tCalendar, dateLocale} = useCalendarTranslation();
    const headingOptions = {
        locale: dateLocale,
        patterns: {
            monthYear: tCalendar(($) => $.formats.monthYear),
            dayHeading: tCalendar(($) => $.formats.dayHeading),
            weekStart: tCalendar(($) => $.formats.weekStart),
            weekEnd: tCalendar(($) => $.formats.weekEnd),
        },
    };
    const viewLabels = {
        month: tCalendar(($) => $.views.month),
        week: tCalendar(($) => $.views.week),
        day: tCalendar(($) => $.views.day),
        agenda: tCalendar(($) => $.views.agenda),
    };
    const shortcutLabels = {
        month: tCalendar(($) => $.views.shortcut.month),
        week: tCalendar(($) => $.views.shortcut.week),
        day: tCalendar(($) => $.views.shortcut.day),
        agenda: tCalendar(($) => $.views.shortcut.agenda),
    };
    return (
        <div className="flex shrink-0 items-center justify-between gap-1 p-2 sm:p-4">
            <div className="flex min-w-0 items-center gap-1 sm:gap-4">
                <Button
                    aria-label={tCalendar(($) => $.toolbar.today)}
                    className="max-[479px]:size-8 max-[479px]:p-0"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                        changeDate(new Date(now));
                    }}
                >
                    <CalendarCheck2Icon className="min-[480px]:hidden" />
                    <span className="max-[479px]:sr-only">{tCalendar(($) => $.toolbar.today)}</span>
                </Button>
                <div className="flex shrink-0 items-center sm:gap-2">
                    <Button
                        aria-label={tCalendar(($) => $.toolbar.previous)}
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => {
                            changeDate(navigateDate(date, view, -1));
                        }}
                    >
                        <ChevronLeftIcon />
                    </Button>
                    <Button
                        aria-label={tCalendar(($) => $.toolbar.next)}
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => {
                            changeDate(navigateDate(date, view, 1));
                        }}
                    >
                        <ChevronRightIcon />
                    </Button>
                </div>
                <h2 aria-live="polite" className="min-w-0 truncate text-sm font-semibold sm:text-lg md:text-xl">
                    {view === "day" ? (
                        <>
                            <span className="min-[480px]:hidden">
                                {format(
                                    date,
                                    tCalendar(($) => $.formats.dayCompact),
                                    {locale: dateLocale},
                                )}
                            </span>
                            <span className="max-[479px]:hidden md:hidden">
                                {format(
                                    date,
                                    tCalendar(($) => $.formats.dayMedium),
                                    {locale: dateLocale},
                                )}
                            </span>
                            <span className="max-md:hidden">{calendarHeading(date, view, headingOptions)}</span>
                        </>
                    ) : (
                        calendarHeading(date, view, headingOptions)
                    )}
                </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <DropdownMenu>
                    <DropdownMenuTrigger aria-label={viewLabels[view]} render={<Button size="sm" variant="outline" />}>
                        <span aria-hidden={true} className="min-[480px]:hidden">
                            {shortcutLabels[view]}
                        </span>
                        <span className="max-[479px]:sr-only">{viewLabels[view]}</span>
                        <ChevronDownIcon className="opacity-60" data-icon="inline-end" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                            {VIEWS.map((item) => (
                                <DropdownMenuItem
                                    key={item}
                                    onClick={() => {
                                        changeView(item);
                                    }}
                                >
                                    {viewLabels[item]}
                                    <DropdownMenuShortcut>{shortcutLabels[item]}</DropdownMenuShortcut>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
                {!isReadOnly && (
                    <Button
                        aria-label={tCalendar(($) => $.toolbar.newEvent)}
                        className="max-[479px]:size-8 max-[479px]:p-0"
                        size="sm"
                        onClick={() => {
                            create(atMinute(now, 540));
                        }}
                    >
                        <PlusIcon className="opacity-60 sm:-ms-1" data-icon="inline-start" />
                        <span className="max-sm:sr-only">{tCalendar(($) => $.toolbar.newEvent)}</span>
                    </Button>
                )}
            </div>
        </div>
    );
};
export {CalendarToolbar};
