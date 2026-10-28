import {describe, expect, it} from "vitest";

import type {Locale} from "date-fns";
import {enUS} from "date-fns/locale/en-US";
import {fr} from "date-fns/locale/fr";

import {atMinute} from "../../core/dates";
import {createCalendarI18n} from "../../i18n";
import {dateLocaleFor} from "../../i18n/date-locale";
import {SUPPORTED_LOCALES} from "../../i18n/locales";
import enCalendar from "../../i18n/locales/en/calendar.json";
import {createSlotLabeler} from "../../i18n/slot-label";
import type {CalendarSelector} from "../../i18n/translations";
import {slotLabel} from "./calendar-drop";

const translate = (kind: "allDay" | "timed", values: {date: string; time: string}) => {
    const template = kind === "allDay" ? enCalendar.slot.addAllDay : enCalendar.slot.addAt;
    return template.replace("{{date}}", values.date).replace("{{time}}", values.time);
};

describe("calendar drop labels", () => {
    it.each([
        {allDay: false, expected: "Add event October 6, 2026 at 9:00 AM", start: new Date(2026, 9, 6, 9)},
        {allDay: false, expected: "Add event October 6, 2026 at 9:45 AM", start: new Date(2026, 9, 6, 9, 45)},
        {allDay: true, expected: "Add event October 6, 2026 all day", start: new Date(2026, 9, 6, 9)},
        {allDay: false, expected: "Add event October 6, 2026 at 12:00 AM", start: new Date(2026, 9, 6)},
    ])("formats $expected", ({allDay, expected, start}) => {
        expect(slotLabel(start, allDay, translate, enUS).replace(/\s/gu, " ")).toBe(expected);
    });
});

// i18next would HTML-escape "/" and "'" in interpolated values if escaping were enabled.
const escapable: Locale = {
    ...fr,
    code: "x-escapable",
    formatLong: {...fr.formatLong, date: () => "dd/MM/yyyy", time: () => "HH''mm"},
};

describe("cached calendar drop labels", () => {
    it.each([
        ...SUPPORTED_LOCALES.map((locale) => ({locale, dateLocale: dateLocaleFor(locale)})),
        {locale: "fr" as const, dateLocale: escapable},
    ])("match uncached $locale labels with $dateLocale.code dates across DST transitions", ({locale, dateLocale}) => {
        const tCalendar = createCalendarI18n(locale).getFixedT(locale, "calendar") as unknown as CalendarSelector;
        const labeler = createSlotLabeler(tCalendar, dateLocale);
        const translate = (kind: "allDay" | "timed", values: {date: string; time: string}) =>
            kind === "allDay" ? tCalendar(($) => $.slot.addAllDay, values) : tCalendar(($) => $.slot.addAt, values);
        for (const day of [new Date(2026, 2, 8), new Date(2026, 2, 29), new Date(2026, 9, 25), new Date(2026, 10, 1)]) {
            for (let minute = 0; minute < 24 * 60; minute += 15) {
                const start = atMinute(day, minute);
                for (const allDay of [false, true]) {
                    expect(labeler(start, allDay)).toBe(slotLabel(start, allDay, translate, dateLocale));
                }
            }
        }
    });
});
