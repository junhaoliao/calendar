import type {CalendarSelector} from "../i18n/translations";

/** Typechecked proof only; this file is not in the public entry graph. */
export const proveCalendarSelector = (tCalendar: CalendarSelector) => {
    tCalendar(($) => $.toolbar.today);
    tCalendar(($) => $.month.more, {count: 2});
    // @ts-expect-error unknown plural base must not be selectable
    tCalendar(($) => $.month.unknown, {count: 2});
    // @ts-expect-error unknown ordinary key must not be selectable
    tCalendar(($) => $.toolbar.doesNotExist);
};
