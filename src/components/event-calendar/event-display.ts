import type {CalendarSelector} from "../../i18n/translations";

const SAVED_UNTITLED = "(no title)";

/** Title shown to users; the saved placeholder and blank titles use the localized label. */
const displayTitle = (title: string, tCalendar: CalendarSelector): string =>
    !title.trim() || title === SAVED_UNTITLED ? tCalendar(($) => $.editor.untitled) : title;

export {SAVED_UNTITLED, displayTitle};
