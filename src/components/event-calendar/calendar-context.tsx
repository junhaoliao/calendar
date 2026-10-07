import {createContext, useContext, useMemo} from "react";
import type {KeyboardEvent, ReactNode} from "react";

import type {DragEndEvent, DragStartEvent} from "@dnd-kit/react";

import type {CalendarEvent, CalendarView, DropData, EventCalendarProps, NewCalendarEvent} from "./types";
import type {ResizeCommit} from "./calendar-resize-context";
import type {MoveResolution} from "../../core/move";

type CalendarActions = {
    select: (event: CalendarEvent) => void;
    create: (start: Date, allDay?: boolean) => void;
    openDay: (day: Date) => void;
    changeDate: (date: Date) => void;
    changeView: (view: CalendarView) => void;
    addDraft: (event: NewCalendarEvent) => void;
    updateDraft: (event: CalendarEvent) => void;
    deleteDraft: (id: string) => void;
    closeDraft: () => void;
    handleShortcut: (event: KeyboardEvent<HTMLDivElement>) => void;
    beginDrag: (event: DragStartEvent) => void;
    endDrag: (event: DragEndEvent) => void;
    /** null means inapplicable; only rejected outcomes show refusal feedback. */
    resolveDrag: (target: DropData) => MoveResolution<CalendarEvent> | null;
    dismissRejection: () => void;
    resizeActive: (active: boolean) => void;
    commitResize: (commit: ResizeCommit) => void;
};

type CalendarConfig = {
    readOnly: boolean;
    renderEvent?: EventCalendarProps["renderEvent"];
    minimumTimedEventWidth?: number;
    defaultDuration: number;
    resolveEventMove?: EventCalendarProps["resolveEventMove"];
};

type CalendarContextValue = {actions: CalendarActions; config: CalendarConfig};
type CalendarContextProviderProps = CalendarContextValue & {now: Date; children: ReactNode};

const CalendarConfigContext = createContext<CalendarContextValue | null>(null);
const CalendarNowContext = createContext<Date | null>(null);

const CalendarContextProvider = ({actions, config, now, children}: CalendarContextProviderProps) => {
    const value = useMemo(() => ({actions, config}), [actions, config]);

    return (
        <CalendarConfigContext.Provider value={value}>
            <CalendarNowContext.Provider value={now}>{children}</CalendarNowContext.Provider>
        </CalendarConfigContext.Provider>
    );
};

const useCalendarContext = () => {
    const context = useContext(CalendarConfigContext);
    if (!context) {
        throw new Error("Calendar action/config hooks must be used inside CalendarContextProvider");
    }
    return context;
};

const useCalendarActions = () => useCalendarContext().actions;
const useCalendarConfig = (): CalendarConfig => useCalendarContext().config;
const useCalendarNow = () => {
    const now = useContext(CalendarNowContext);
    if (!now) {
        throw new Error("useCalendarNow must be used inside CalendarContextProvider");
    }
    return now;
};

export {CalendarContextProvider, useCalendarActions, useCalendarConfig, useCalendarNow};
export type {CalendarActions, CalendarConfig};
