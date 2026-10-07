import {describe, expect, it} from "vitest";

import {enUS} from "date-fns/locale/en-US";

import enCalendar from "../../i18n/locales/en/calendar.json";
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
