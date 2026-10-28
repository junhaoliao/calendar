import {format} from "date-fns";
import type {Locale} from "date-fns";

import type {CalendarSelector, SlotLabeler} from "./translations";

type SlotKind = "allDay" | "timed";
type SlotTranslate = (kind: SlotKind, values: {date: string; time: string}) => string;

// Interpolation placeholders that cannot occur in translated text or formatted dates.
const DATE_TOKEN = "\u0000date\u0000";
const TIME_TOKEN = "\u0000time\u0000";
// A view labels at most 42 days; the cap only bounds long navigation sessions.
const MAX_CACHED_DAYS = 512;

const slotPatterns = (locale: Locale) => {
    const english = locale.code?.startsWith("en");
    return {date: english ? "MMMM d, yyyy" : "PPP", time: english ? "h:mm a" : "p"};
};

/** Required translation lookup keeps this formatter independent of React hooks. */
const slotLabel = (start: Date, allDay: boolean | undefined, translate: SlotTranslate, locale: Locale): string => {
    const patterns = slotPatterns(locale);
    const values = {
        date: format(start, patterns.date, {locale}),
        time: format(start, patterns.time, {locale}),
    };
    return translate(allDay ? "allDay" : "timed", values);
};

/**
 * Produces the same labels as {@link slotLabel}, but translates each template once and
 * formats each local date and wall-clock time once. A week view labels 672 slots.
 *
 * @param tCalendar Translator bound to the calendar language.
 * @param locale Matching date-fns locale.
 * @return Cached slot labeler.
 */
const createSlotLabeler = (tCalendar: CalendarSelector, locale: Locale): SlotLabeler => {
    const patterns = slotPatterns(locale);
    const tokens = {date: DATE_TOKEN, time: TIME_TOKEN};
    const templates = {
        allDay: tCalendar(($) => $.slot.addAllDay, tokens),
        timed: tCalendar(($) => $.slot.addAt, tokens),
    };
    const dates = new Map<number, string>();
    const times = new Map<number, string>();
    return (start, allDay = false) => {
        // The patterns have no time-zone fields, so output depends only on the local
        // date and the local wall-clock time.
        const dayKey = start.getFullYear() * 10000 + start.getMonth() * 100 + start.getDate();
        let date = dates.get(dayKey);
        if (date === undefined) {
            if (dates.size >= MAX_CACHED_DAYS) dates.clear();
            date = format(start, patterns.date, {locale});
            dates.set(dayKey, date);
        }
        const minuteKey = start.getHours() * 60 + start.getMinutes();
        let time = times.get(minuteKey);
        if (time === undefined) {
            time = format(start, patterns.time, {locale});
            times.set(minuteKey, time);
        }
        return templates[allDay ? "allDay" : "timed"].split(DATE_TOKEN).join(date).split(TIME_TOKEN).join(time);
    };
};

export {createSlotLabeler, slotLabel};
