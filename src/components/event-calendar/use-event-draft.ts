import {SAVED_UNTITLED} from "./event-display";
import {useId, useState} from "react";

import {isSameDay} from "date-fns";
import {useCalendarTranslation} from "../../i18n/translations";

import {lastOccupiedDay} from "../../core/dates";
import {atMinute} from "../../core/dates";
import type {EventColor, EventDraft, NewCalendarEvent} from "./types";

const minuteOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();

/**
 * Holds one editor opening's draft and validates its local date/time boundaries.
 *
 * @param event Initial event data.
 * @param onSave Reports a valid event to the consumer.
 * @param mode Whether the editor is creating or editing an event.
 * @return Draft values, setters and save action.
 */
const useEventDraft = <T extends NewCalendarEvent>(event: T, onSave: (event: T) => void, mode: EventDraft["mode"]) => {
    const {tCalendar} = useCalendarTranslation();
    const prefix = useId();
    const wasAllDay = Boolean(event.allDay);
    const [title, setTitle] = useState(event.title);
    const [description, setDescription] = useState(event.description ?? "");
    const [location, setLocation] = useState(event.location ?? "");
    const [startDate, setStartDate] = useState(event.start);
    const [endDate, setEndDate] = useState(event.end);
    const [startMinute, setStartMinute] = useState(minuteOfDay(event.start));
    const [endMinute, setEndMinute] = useState(minuteOfDay(event.end));
    const [allDay, setAllDayState] = useState(wasAllDay);
    const [endPickedAllDay, setEndPickedAllDay] = useState(false);
    const [color, setColor] = useState<EventColor>(event.color ?? "sky");
    const [errorCode, setErrorCode] = useState<"" | "endBeforeStart">("");
    const error = errorCode === "endBeforeStart" ? tCalendar(($) => $.editor.errors.endBeforeStart) : "";
    const setError = (value: "") => setErrorCode(value);
    const setAllDay = (nextAllDay: boolean) => {
        if (!nextAllDay && allDay && wasAllDay) {
            setStartMinute(0);
            setEndMinute(1439);
        }
        setAllDayState(nextAllDay);
    };
    const changeEndDate = (value: Date) => {
        setEndDate(value);
        setEndPickedAllDay(allDay);
    };
    const changeEndMinute = (value: number) => {
        setEndMinute(value);
        if (!allDay) setEndPickedAllDay(false);
    };
    const editingExisting = mode === "edit";
    const startDraftUnchanged =
        editingExisting && isSameDay(startDate, event.start) && startMinute === minuteOfDay(event.start);
    const endDraftUnchanged = editingExisting && isSameDay(endDate, event.end) && endMinute === minuteOfDay(event.end);
    const timedLastDate = lastOccupiedDay({
        ...event,
        allDay: false,
        end: endDraftUnchanged ? event.end : atMinute(endDate, endMinute),
        start: startDraftUnchanged ? event.start : atMinute(startDate, startMinute),
    });
    const displayEndDate = allDay && !wasAllDay && !endPickedAllDay ? timedLastDate : endDate;
    const save = () => {
        const sameType = allDay === wasAllDay;
        const startUnchanged =
            editingExisting &&
            sameType &&
            isSameDay(startDate, event.start) &&
            (allDay || startMinute === minuteOfDay(event.start));
        const endUnchanged =
            editingExisting &&
            sameType &&
            isSameDay(endDate, event.end) &&
            (allDay || endMinute === minuteOfDay(event.end));
        const start = startUnchanged ? event.start : atMinute(startDate, allDay ? 0 : startMinute);
        let end: Date;

        if (endUnchanged) {
            end = event.end;
        } else if (allDay) {
            const allDayEndDate = !wasAllDay && !endPickedAllDay ? timedLastDate : endDate;
            end = atMinute(allDayEndDate, 1439);
            end.setSeconds(59, 999);
        } else if (wasAllDay && endMinute === 1439) {
            end = atMinute(endDate, 1439);
            end.setSeconds(59, 999);
        } else {
            end = atMinute(endDate, endMinute);
        }

        if (end < start) {
            setErrorCode("endBeforeStart");

            return;
        }
        const {color: _color, description: _description, location: _location, ...rest} = event;
        // Every overwritten field belongs to NewCalendarEvent; spreading retains host-owned fields.
        onSave({
            ...rest,
            ...(description !== "" || event.description !== undefined ? {description: description} : {}),
            ...(location !== "" || event.location !== undefined ? {location: location} : {}),
            ...(color !== "sky" || event.color !== undefined ? {color: color} : {}),
            allDay: allDay,
            end: end,
            start: start,
            title: title.trim() ? title : SAVED_UNTITLED,
        } as T);
    };

    return {
        allDay,
        color,
        description,
        endDate: displayEndDate,
        endMinute,
        error,
        location,
        prefix,
        save,
        setAllDay,
        setColor,
        setDescription,
        setEndDate: changeEndDate,
        setEndMinute: changeEndMinute,
        setError,
        setLocation,
        setStartDate,
        setStartMinute,
        setTitle,
        startDate,
        startMinute,
        title,
    };
};
export {useEventDraft};
