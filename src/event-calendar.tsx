"use client";

import {useContext, useMemo} from "react";
import {getI18n, I18nContext, I18nextProvider} from "react-i18next";

import {CalendarStyleProvider} from "./lib/calendar-style";
import {CalendarSurface} from "./components/event-calendar/calendar-surface";
import {CalendarI18nProvider} from "./i18n/provider";
import {DEFAULT_LOCALE} from "./i18n/locales";
import type {
    CalendarEvent,
    CalendarNotification,
    EventCalendarProps,
    EventMoveContext,
    EventMoveRejected,
} from "./components/event-calendar/types";

/**
 * Controlled calendar. Existing event callbacks retain the inferred host type.
 * Internal views share CalendarEvent; each update spreads its original event.
 * These boundary assertions are safe for existing events only. Creation returns
 * NewCalendarEvent without an id; the host supplies it and any required metadata.
 * Notifications for existing events carry the original host event, so the same boundary assertion applies.
 */
export function EventCalendar<TEvent extends CalendarEvent = CalendarEvent>(props: EventCalendarProps<TEvent>) {
    // Read the host boundary before the private provider shadows it. Custom React
    // content gets the original instance/default namespace, including singleton hosts.
    const hostContext = useContext(I18nContext) as
        | {
              i18n?: ReturnType<typeof getI18n>;
              defaultNS?: string | readonly string[];
          }
        | undefined;
    const hostInstance = hostContext?.i18n ?? getI18n();
    const rawHostDefaultNS = hostContext?.defaultNS ?? hostInstance?.options.defaultNS;
    const hostDefaultNS =
        typeof rawHostDefaultNS === "string" ? rawHostDefaultNS : rawHostDefaultNS ? [...rawHostDefaultNS] : undefined;
    const renderEvent = props.renderEvent
        ? (event: CalendarEvent, view: Parameters<NonNullable<EventCalendarProps["renderEvent"]>>[1]) => {
              const content = props.renderEvent?.(event as TEvent, view);
              return hostInstance ? (
                  <I18nextProvider i18n={hostInstance} defaultNS={hostDefaultNS}>
                      {content}
                  </I18nextProvider>
              ) : (
                  content
              );
          }
        : undefined;
    const hostResolveEventMove = props.resolveEventMove;
    const resolveEventMove = useMemo<EventCalendarProps["resolveEventMove"]>(
        () =>
            hostResolveEventMove
                ? (context) => hostResolveEventMove(context as EventMoveContext<TEvent>) ?? null
                : undefined,
        [hostResolveEventMove],
    );
    return (
        <CalendarI18nProvider locale={props.locale}>
            <CalendarStyleProvider theme={props.theme} style={props.style} lang={props.locale ?? DEFAULT_LOCALE}>
                <CalendarSurface
                    {...props}
                    resolveEventMove={resolveEventMove}
                    onMoveRejected={
                        props.onMoveRejected
                            ? (rejection) => props.onMoveRejected?.(rejection as EventMoveRejected<TEvent>)
                            : undefined
                    }
                    onEventUpdate={props.onEventUpdate ? (event) => props.onEventUpdate?.(event as TEvent) : undefined}
                    onEventClick={props.onEventClick ? (event) => props.onEventClick?.(event as TEvent) : undefined}
                    renderEvent={renderEvent}
                    onNotification={
                        props.onNotification
                            ? (notification) => props.onNotification?.(notification as CalendarNotification<TEvent>)
                            : undefined
                    }
                />
            </CalendarStyleProvider>
        </CalendarI18nProvider>
    );
}
