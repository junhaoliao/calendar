import {addDays, endOfDay, startOfDay} from "date-fns";
import type {CalendarEvent} from "../src/index";
import {atMinute} from "../src/date-math";

export function resizeEvents(today: Date, fixture: string): CalendarEvent[] {
    const day = addDays(today, 1);
    if (fixture === "all-day")
        return [
            {
                id: "workshop",
                title: "All-day workshop",
                allDay: true,
                color: "violet",
                start: startOfDay(day),
                end: endOfDay(addDays(day, 1)),
            },
        ];
    if (fixture === "crowded")
        return Array.from({length: 12}, (_, index) => ({
            id: `all-day-${index}`,
            title: `Workshop ${index + 1}`,
            allDay: true,
            start: startOfDay(day),
            end: endOfDay(day),
            color: "violet",
        }));
    return [
        {
            id: "resize:a|b]",
            title: "Team Meeting",
            color: "orange",
            start: atMinute(day, fixture === "overnight" ? 1320 : 540),
            end: atMinute(day, fixture === "overnight" ? 1560 : fixture === "short" ? 555 : 630),
        },
    ];
}
