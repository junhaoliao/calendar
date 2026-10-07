import {useState} from "react";
import {render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {renderToString} from "react-dom/server";
import {format, getDefaultOptions, setDefaultOptions} from "date-fns";
import {fr} from "date-fns/locale/fr";
import {describe, expect, it, vi} from "vitest";

vi.hoisted(() => {
    globalThis.ResizeObserver = class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
    };
});

import {EventCalendar} from "../event-calendar";
import type {CalendarEvent} from "../components/event-calendar/types";
import {dateLocaleFor} from "./date-locale";
import {resources} from "./resources";
import type {CalendarLocale} from "./locales";

const day = new Date(2026, 9, 4, 9);
const crowded = Array.from({length: 3}, (_, index) => ({
    id: `crowded-${index}`,
    title: `Host title ${index}`,
    start: new Date(2026, 9, 4, 10),
    end: new Date(2026, 9, 4, 11),
}));

const monthDrops = (root: HTMLElement) =>
    [...root.querySelectorAll('[data-slot="calendar-drop"]')].map((node) => [
        node.getAttribute("data-date"),
        node.getAttribute("data-minute"),
    ]);

describe("public locale prop", () => {
    it.each(["fr", "zh-Hans", "zh-Hant"] as const)(
        "renders %s immediately and switches back to English without data mutation",
        async (locale) => {
            const onEventUpdate = vi.fn();
            const {container, rerender} = render(
                <EventCalendar
                    events={crowded}
                    initialDate={day}
                    now={day}
                    locale={locale}
                    onEventUpdate={onEventUpdate}
                />,
            );
            const root = container.querySelector<HTMLElement>(".event-calendar")!;
            expect(root).toHaveAttribute("lang", locale);
            expect(screen.getByRole("button", {name: resources[locale].calendar.toolbar.today})).toBeInTheDocument();
            const heading = format(day, resources[locale].calendar.formats.monthYear, {locale: dateLocaleFor(locale)});
            expect(screen.getByRole("heading", {level: 2})).toHaveTextContent(heading);
            const firstSunday = new Date(2026, 8, 27);
            const firstHeader = container.querySelector('[data-slot="month-view"] > .grid > div');
            expect(firstHeader).toHaveTextContent(format(firstSunday, "EEE", {locale: dateLocaleFor(locale)}));
            const more = resources[locale].calendar.month.more_other.replace("{{count}}", "3");
            expect(screen.getByText(more)).toBeInTheDocument();
            const originalDates = monthDrops(root);
            expect(originalDates[0]?.[0]).toBe(firstSunday.toISOString());

            rerender(
                <EventCalendar
                    events={crowded}
                    initialDate={day}
                    now={day}
                    locale="en"
                    onEventUpdate={onEventUpdate}
                />,
            );
            await waitFor(() => expect(screen.getByRole("button", {name: "Today"})).toBeInTheDocument());
            expect(root).toHaveAttribute("lang", "en");
            expect(screen.getByRole("heading", {level: 2})).toHaveTextContent("October 2026");
            expect(monthDrops(root)).toEqual(originalDates);
            expect(onEventUpdate).not.toHaveBeenCalled();
        },
    );

    it("renders translated text on the first synchronous server render", () => {
        const html = renderToString(<EventCalendar events={[]} initialDate={day} now={day} locale="fr" />);
        expect(html).toContain(resources.fr.calendar.toolbar.today);
        expect(html).toContain('lang="fr"');
        expect(html).not.toContain("toolbar.today");
    });

    it("keeps week dates and drop IDs Sunday-first under host Monday defaults and locale switching", async () => {
        const prior = getDefaultOptions();
        try {
            setDefaultOptions({locale: fr, weekStartsOn: 1});
            const calendar = (locale: "zh-Hant" | "en") => (
                <EventCalendar events={[]} initialDate={day} initialView="week" now={day} locale={locale} />
            );
            const {container, rerender} = render(calendar("zh-Hant"));
            const columns = () =>
                [...container.querySelectorAll('[data-slot="time-column"]')].map((node) =>
                    node.getAttribute("data-day"),
                );
            const before = columns();
            expect(before[0]).toBe(new Date(2026, 9, 4).toISOString());
            expect(before).toHaveLength(7);
            const drops = monthDrops(container);
            rerender(calendar("en"));
            await waitFor(() => expect(screen.getByRole("button", {name: "Today"})).toBeInTheDocument());
            expect(columns()).toEqual(before);
            expect(monthDrops(container)).toEqual(drops);
        } finally {
            setDefaultOptions({locale: prior.locale, weekStartsOn: prior.weekStartsOn});
            expect(getDefaultOptions()).toEqual(prior);
        }
    });

    it.each(["en", "fr", "zh-Hans", "zh-Hant"] as const)(
        "keeps %s blank-title data canonical through creation, resize and deletion",
        async (locale) => {
            const user = userEvent.setup();
            const onAdd = vi.fn();
            const onUpdate = vi.fn();
            const onDelete = vi.fn();
            const onClick = vi.fn();
            const onNotification = vi.fn();
            const Controlled = ({language, clickable}: {language: CalendarLocale; clickable: boolean}) => {
                const [events, setEvents] = useState<CalendarEvent[]>([]);
                return (
                    <EventCalendar
                        events={events}
                        initialDate={day}
                        now={day}
                        initialView="day"
                        locale={language}
                        onEventAdd={(event) => {
                            onAdd(event);
                            setEvents((current) => [...current, {...event, id: "created"}]);
                        }}
                        onEventUpdate={(event) => {
                            onUpdate(event);
                            setEvents((current) => current.map((item) => (item.id === event.id ? event : item)));
                        }}
                        onEventDelete={(id) => {
                            onDelete(id);
                            setEvents((current) => current.filter((item) => item.id !== id));
                        }}
                        onEventClick={clickable ? onClick : undefined}
                        onNotification={onNotification}
                    />
                );
            };
            const {container, rerender} = render(<Controlled language={locale} clickable={true} />);
            const translations = resources[locale].calendar;
            await user.click(screen.getByRole("button", {name: translations.toolbar.newEvent}));
            await user.click(screen.getByRole("button", {name: translations.editor.actions.save}));
            expect(onAdd).toHaveBeenCalledTimes(1);
            expect(onAdd.mock.calls[0][0].title).toBe("(no title)");
            const eventButton = container.querySelector<HTMLElement>('[data-calendar-event="created"]')!;
            expect(eventButton.getAttribute("aria-label")).toContain(translations.editor.untitled);
            expect(within(eventButton).getByText(translations.editor.untitled)).toBeInTheDocument();
            await user.click(eventButton);
            expect(onClick.mock.calls[0][0].title).toBe("(no title)");

            const endLabel = translations.resize.handleLabel.end.replace("{{title}}", translations.editor.untitled);
            const handle = screen.getByRole("button", {name: endLabel});
            handle.focus();
            await user.keyboard("{ArrowDown}{Enter}");
            expect(onUpdate).toHaveBeenCalledTimes(1);
            expect(onUpdate.mock.calls[0][0].title).toBe("(no title)");
            expect(onNotification.mock.lastCall?.[0]).toMatchObject({action: "resized", event: {title: "(no title)"}});
            expect(
                screen.getByText(translations.announcement.resized.replace("{{title}}", translations.editor.untitled)),
            ).toBeInTheDocument();

            rerender(<Controlled language={locale} clickable={false} />);
            await user.click(container.querySelector<HTMLElement>('[data-calendar-event="created"]')!);
            await user.click(screen.getByRole("button", {name: translations.editor.actions.delete}));
            expect(onDelete).toHaveBeenCalledExactlyOnceWith("created");
            expect(onNotification.mock.lastCall?.[0]).toMatchObject({action: "deleted", event: {title: "(no title)"}});
            expect(
                screen.getByText(translations.announcement.deleted.replace("{{title}}", translations.editor.untitled)),
            ).toBeInTheDocument();
            const count = onNotification.mock.calls.length;
            rerender(<Controlled language="en" clickable={false} />);
            await waitFor(() =>
                expect(
                    screen.getByText(
                        resources.en.calendar.announcement.deleted.replace(
                            "{{title}}",
                            resources.en.calendar.editor.untitled,
                        ),
                    ),
                ).toBeInTheDocument(),
            );
            expect(onNotification).toHaveBeenCalledTimes(count);
        },
    );

    it.each(["en", "fr", "zh-Hans", "zh-Hant"] as const)(
        "passes original titles to %s host renderers and click callbacks",
        async (locale) => {
            const user = userEvent.setup();
            const onEventClick = vi.fn();
            const renderEvent = vi.fn((event: CalendarEvent) => (
                <span data-testid={`host-${event.id}`}>{event.title}</span>
            ));
            const events: CalendarEvent[] = [
                {id: "blank", title: "(no title)", start: new Date(2026, 9, 4, 10), end: new Date(2026, 9, 4, 11)},
                {
                    id: "custom",
                    title: "Host supplied Café",
                    start: new Date(2026, 9, 4, 12),
                    end: new Date(2026, 9, 4, 13),
                },
            ];
            const {container} = render(
                <EventCalendar
                    events={events}
                    initialDate={day}
                    now={day}
                    initialView="day"
                    locale={locale}
                    renderEvent={renderEvent}
                    onEventClick={onEventClick}
                />,
            );
            expect(screen.getByTestId("host-blank")).toHaveTextContent("(no title)");
            expect(screen.getByTestId("host-custom")).toHaveTextContent("Host supplied Café");
            expect(renderEvent.mock.calls.some(([event]) => event.title === "(no title)")).toBe(true);
            expect(container.querySelector('[data-calendar-event="blank"]')?.getAttribute("aria-label")).toContain(
                resources[locale].calendar.editor.untitled,
            );
            await user.click(container.querySelector<HTMLElement>('[data-calendar-event="blank"]')!);
            expect(onEventClick.mock.calls[0][0]).toBe(events[0]);
            await user.click(container.querySelector<HTMLElement>('[data-calendar-event="custom"]')!);
            expect(onEventClick.mock.calls[1][0]).toBe(events[1]);
        },
    );

    it("retranslates an open invalid-date editor error without saving or notifying the host", async () => {
        const user = userEvent.setup();
        const onEventAdd = vi.fn();
        const onNotification = vi.fn();
        const calendar = (locale: "fr" | "zh-Hans") => (
            <EventCalendar
                events={[]}
                now={day}
                initialDate={day}
                locale={locale}
                onEventAdd={onEventAdd}
                onNotification={onNotification}
            />
        );
        const {rerender} = render(calendar("fr"));
        await user.click(screen.getByRole("button", {name: resources.fr.calendar.toolbar.newEvent}));
        await user.click(screen.getByRole("combobox", {name: resources.fr.calendar.editor.fields.endTime}));
        const earlier = format(new Date(2000, 0, 1, 8), "p", {locale: dateLocaleFor("fr")});
        await user.click(await screen.findByRole("option", {name: earlier}));
        await user.click(screen.getByRole("button", {name: resources.fr.calendar.editor.actions.save}));
        expect(screen.getByRole("alert")).toHaveTextContent(resources.fr.calendar.editor.errors.endBeforeStart);
        expect(onEventAdd).not.toHaveBeenCalled();
        expect(onNotification).not.toHaveBeenCalled();

        rerender(calendar("zh-Hans"));
        await waitFor(() =>
            expect(screen.getByRole("alert")).toHaveTextContent(
                resources["zh-Hans"].calendar.editor.errors.endBeforeStart,
            ),
        );
        expect(screen.getByRole("textbox", {name: resources["zh-Hans"].calendar.editor.fields.title})).toHaveValue("");
        expect(onEventAdd).not.toHaveBeenCalled();
        expect(onNotification).not.toHaveBeenCalled();
    });
});
