import {addDays} from "date-fns";

import type {CalendarEvent} from "../src/index";
import {atMinute} from "../src/date-math";

/**
 * Relative fixtures for the standalone calendar demo.
 *
 * @param today
 * @return The computed result or rendered calendar surface.
 */
const sampleEvents = (today: Date): CalendarEvent[] => {
    const timed = (offset: number, minute: number) => atMinute(addDays(today, offset), minute);
    return [
        {
            allDay: true,
            color: "sky",
            description: "Strategic planning for next year",
            end: timed(-23, 1439),
            id: "planning",
            location: "Main Conference Hall",
            start: timed(-24, 0),
            title: "Annual Planning",
        },
        {
            color: "amber",
            description: "Submit final deliverables",
            end: timed(-9, 930),
            id: "deadline",
            location: "Office",
            start: timed(-9, 780),
            title: "Project Deadline",
        },
        {
            allDay: true,
            color: "orange",
            description: "Strategic planning for next year",
            end: timed(-13, 1439),
            id: "budget",
            location: "Main Conference Hall",
            start: timed(-13, 0),
            title: "Quarterly Budget Review",
        },
        {
            color: "sky",
            description: "Weekly team sync",
            end: timed(0, 660),
            id: "team",
            location: "Conference Room A",
            start: timed(0, 600),
            title: "Team Meeting",
        },
        {
            color: "emerald",
            description: "Discuss new project requirements",
            end: timed(1, 795),
            id: "lunch",
            location: "Downtown Cafe",
            start: timed(1, 720),
            title: "Lunch with Client",
        },
        {
            allDay: true,
            color: "violet",
            description: "New product release",
            end: timed(6, 1439),
            id: "launch",
            start: timed(3, 0),
            title: "Product Launch",
        },
        {
            color: "rose",
            description: "Discuss about new clients",
            end: timed(5, 885),
            id: "sales",
            location: "Downtown Cafe",
            start: timed(4, 870),
            title: "Sales Conference",
        },
        {
            color: "orange",
            description: "Weekly team sync",
            end: timed(5, 630),
            id: "team-orange",
            location: "Conference Room A",
            start: timed(5, 540),
            title: "Team Meeting",
        },
        {
            color: "sky",
            description: "Weekly team sync",
            end: timed(5, 930),
            id: "review",
            location: "Conference Room A",
            start: timed(5, 840),
            title: "Review contracts",
        },
        {
            color: "amber",
            description: "Weekly team sync",
            end: timed(5, 660),
            id: "team-amber",
            location: "Conference Room A",
            start: timed(5, 585),
            title: "Team Meeting",
        },
        {
            color: "emerald",
            description: "Quarterly marketing planning",
            end: timed(9, 930),
            id: "marketing",
            location: "Marketing Department",
            start: timed(9, 600),
            title: "Marketing Strategy Session",
        },
        {
            allDay: true,
            color: "sky",
            description: "Presentation of yearly results",
            end: timed(17, 1439),
            id: "shareholders",
            location: "Grand Conference Center",
            start: timed(17, 0),
            title: "Annual Shareholders Meeting",
        },
        {
            color: "rose",
            description: "Brainstorming for new features",
            end: timed(27, 1020),
            id: "workshop",
            location: "Innovation Lab",
            start: timed(26, 540),
            title: "Product Development Workshop",
        },
        {
            color: "violet",
            description: "One event across midnight",
            end: timed(2, 120),
            id: "overnight",
            location: "Operations",
            start: timed(1, 1320),
            title: "Overnight maintenance",
        },
    ];
};

export {sampleEvents};
