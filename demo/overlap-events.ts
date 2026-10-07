import {addDays} from "date-fns";

import type {CalendarEvent} from "../src/index";
import {atMinute} from "../src/date-math";

/**
 * Provides the three-overlap example as ordinary consumer events.
 *
 * @param today The demo's anchor date.
 * @param example Optional narrow-column and boundary fixtures.
 * @return A connected overlap group on the following date.
 */
const overlapEvents = (today: Date, example = ""): CalendarEvent[] => {
    if (example === "column") {
        const day = addDays(today, 6);
        return [
            {
                id: "sales",
                title: "Sales Conference",
                color: "rose",
                start: atMinute(addDays(day, -1), 870),
                end: atMinute(day, 885),
            },
            {id: "meeting", title: "Team Meeting", color: "orange", start: atMinute(day, 540), end: atMinute(day, 630)},
            {id: "hidden", title: "Team Meeting", color: "amber", start: atMinute(day, 585), end: atMinute(day, 660)},
        ];
    }
    if (example === "contracts") {
        const friday = addDays(today, 5);
        return [
            {
                color: "rose",
                end: atMinute(friday, 885),
                id: "sales",
                start: atMinute(addDays(today, 4), 870),
                title: "Sales Conference",
            },
            {
                color: "orange",
                end: atMinute(friday, 630),
                id: "team-orange",
                start: atMinute(friday, 540),
                title: "Team Meeting",
            },
            {
                color: "amber",
                end: atMinute(friday, 660),
                id: "team-amber",
                start: atMinute(friday, 585),
                title: "Team Meeting",
            },
            {
                color: "sky",
                end: atMinute(friday, 690),
                id: "review",
                start: atMinute(friday, 600),
                title: "Review contracts",
            },
        ];
    }
    const date = addDays(today, 1);
    const events: CalendarEvent[] = [
        {color: "sky", end: atMinute(date, 780), id: "overlap-sync", start: atMinute(date, 720), title: "Team sync"},
        {
            color: "amber",
            end: atMinute(date, 765),
            id: "overlap-call",
            start: atMinute(date, 735),
            title: "Client call — confirm rollout schedule and delivery milestones",
        },
        {
            color: "emerald",
            end: atMinute(date, 810),
            id: "overlap-review",
            start: atMinute(date, 750),
            title: "Design review",
        },
    ];

    if (example === "single") {
        return events.slice(0, 1);
    }
    if (example === "short") {
        return events.slice(0, 2).map((event, index) => ({
            ...event,
            start: atMinute(date, 720 + index * 5),
            end: atMinute(date, 735 + index * 5),
        }));
    }
    if (example === "overnight") {
        return events.slice(0, 2).map((event, index) => ({
            ...event,
            start: atMinute(date, 1320 + index * 15),
            end: atMinute(date, 1560 - index * 15),
        }));
    }

    return events;
};

export {overlapEvents};
