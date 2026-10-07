import {render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {format} from "date-fns";
import i18next from "i18next";
import {getDefaults, getI18n, I18nextProvider, setDefaults, setI18n, useTranslation} from "react-i18next";
import {describe, expect, it, vi} from "vitest";

vi.hoisted(() => {
    globalThis.ResizeObserver = class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
    };
});

import {EventCalendar} from "../event-calendar";
import {dateLocaleFor} from "./date-locale";
import {resources} from "./resources";

const now = new Date(2026, 9, 4, 9);
const meeting = {
    id: "host-meeting",
    title: "Host meeting",
    start: new Date(2026, 9, 4, 10),
    end: new Date(2026, 9, 4, 11),
};
const overlaps = Array.from({length: 3}, (_, index) => ({
    ...meeting,
    id: `overlap-${index}`,
    title: `Overlap ${index}`,
    start: new Date(2026, 9, 5, 12, index * 5),
    end: new Date(2026, 9, 5, 13),
}));

const HostContent = () => {
    const explicit = useTranslation("host");
    const implicit = useTranslation();
    return (
        <span data-testid="host-content">
            {explicit.t("hello")} / {implicit.t("hello")}
        </span>
    );
};

describe("private calendar i18next boundary", () => {
    it("renders host custom content in its explicit and default namespace without changing the host", () => {
        const singletonInitialized = i18next.isInitialized;
        expect(Boolean(singletonInitialized)).toBe(false);
        const host = i18next.createInstance({
            lng: "de",
            fallbackLng: "de",
            ns: ["host"],
            defaultNS: "host",
            resources: {de: {host: {hello: "Hallo"}}},
            initAsync: false,
        });
        void host.init();
        render(
            <I18nextProvider i18n={host} defaultNS="host">
                <EventCalendar
                    events={[meeting]}
                    now={now}
                    initialDate={now}
                    initialView="day"
                    renderEvent={() => <HostContent />}
                />
            </I18nextProvider>,
        );
        expect(screen.getByRole("button", {name: "Today"})).toBeInTheDocument();
        expect(screen.getAllByTestId("host-content")[0]).toHaveTextContent("Hallo / Hallo");
        expect(host.language).toBe("de");
        expect(i18next.isInitialized).toBe(singletonInitialized);
    });

    it("keeps English labels and lang on root and a detached editor", async () => {
        const user = userEvent.setup();
        const {container} = render(<EventCalendar events={[]} now={now} initialDate={now} />);
        expect(container.querySelector(".event-calendar")).toHaveAttribute("lang", "en");
        await user.click(screen.getByRole("button", {name: "New event"}));
        expect(screen.getByText("Create Event")).toBeInTheDocument();
        expect(screen.getByRole("textbox", {name: "Title"})).toBeInTheDocument();
        expect(document.querySelector('[data-slot="sheet-portal"]')).toHaveAttribute("lang", "en");
    });

    it("restores host translation context for custom event content inside an overflow popup", async () => {
        const original = HTMLElement.prototype.getBoundingClientRect;
        const measure = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function box(
            this: HTMLElement,
        ) {
            return this.dataset.slot === "time-column" ? new DOMRect(0, 0, 150, 1536) : original.call(this);
        });
        try {
            const user = userEvent.setup();
            const host = i18next.createInstance({
                lng: "de",
                ns: ["host"],
                defaultNS: "host",
                resources: {de: {host: {hello: "Hallo"}}},
                initAsync: false,
            });
            void host.init();
            render(
                <I18nextProvider i18n={host} defaultNS="host">
                    <EventCalendar
                        events={overlaps}
                        now={now}
                        initialDate={now}
                        initialView="week"
                        renderEvent={() => <HostContent />}
                    />
                </I18nextProvider>,
            );
            await user.click(screen.getByRole("button", {name: /more events/}));
            const popup = document.querySelector<HTMLElement>('[data-slot="popover-content"]');
            expect(popup).not.toBeNull();
            expect(within(popup!).getAllByTestId("host-content")[0]).toHaveTextContent("Hallo / Hallo");
            expect(host.language).toBe("de");
        } finally {
            measure.mockRestore();
        }
    });

    it("uses an existing host singleton for custom content without changing it", () => {
        const previous = getI18n();
        const host = i18next.createInstance({
            lng: "de",
            ns: ["host"],
            defaultNS: "host",
            resources: {de: {host: {hello: "Hallo"}}},
            initAsync: false,
        });
        void host.init();
        setI18n(host);
        try {
            render(
                <EventCalendar
                    events={[meeting]}
                    now={now}
                    initialDate={now}
                    initialView="day"
                    renderEvent={() => <HostContent />}
                />,
            );
            expect(screen.getAllByTestId("host-content")[0]).toHaveTextContent("Hallo / Hallo");
            expect(host.language).toBe("de");
        } finally {
            setI18n(previous);
        }
    });

    it("isolates two calendar languages and restores default English on an omitted locale", async () => {
        const first = <EventCalendar events={[]} now={now} initialDate={now} locale="fr" />;
        const second = <EventCalendar events={[]} now={now} initialDate={now} locale="zh-Hant" />;
        const {container, rerender} = render(
            <>
                {first}
                {second}
            </>,
        );
        let roots = container.querySelectorAll<HTMLElement>(".event-calendar");
        expect(within(roots[0]).getByRole("button", {name: resources.fr.calendar.toolbar.today})).toBeInTheDocument();
        expect(
            within(roots[1]).getByRole("button", {name: resources["zh-Hant"].calendar.toolbar.today}),
        ).toBeInTheDocument();
        expect(roots[0]).toHaveAttribute("lang", "fr");
        expect(roots[1]).toHaveAttribute("lang", "zh-Hant");

        rerender(
            <>
                <EventCalendar events={[]} now={now} initialDate={now} />
                {second}
            </>,
        );
        roots = container.querySelectorAll<HTMLElement>(".event-calendar");
        expect(within(roots[0]).getByRole("button", {name: "Today"})).toBeInTheDocument();
        expect(
            within(roots[1]).getByRole("button", {name: resources["zh-Hant"].calendar.toolbar.today}),
        ).toBeInTheDocument();
        expect(roots[0]).toHaveAttribute("lang", "en");
        expect(roots[1]).toHaveAttribute("lang", "zh-Hant");
    });

    it("switches its private locale despite host React defaults disabling bindings and adding a prefix", async () => {
        const prior = {...getDefaults()};
        const host = i18next.createInstance({
            lng: "de",
            ns: ["host"],
            defaultNS: "host",
            resources: {de: {host: {"wrong-prefix": {hello: "Hallo"}}}},
            initAsync: false,
        });
        void host.init();
        setDefaults({bindI18n: false, useSuspense: true, keyPrefix: "wrong-prefix"});
        const overridden = {...getDefaults()};
        try {
            const calendar = (locale: "fr" | "zh-Hans") => (
                <I18nextProvider i18n={host} defaultNS="host">
                    <EventCalendar
                        events={[meeting]}
                        now={now}
                        initialDate={now}
                        initialView="day"
                        locale={locale}
                        renderEvent={() => <HostContent />}
                    />
                </I18nextProvider>
            );
            const {rerender} = render(calendar("fr"));
            expect(screen.getByRole("button", {name: resources.fr.calendar.toolbar.today})).toBeInTheDocument();
            expect(screen.getAllByTestId("host-content")[0]).toHaveTextContent("Hallo / Hallo");
            rerender(calendar("zh-Hans"));
            expect(
                await screen.findByRole("button", {name: resources["zh-Hans"].calendar.toolbar.today}),
            ).toBeInTheDocument();
            expect(screen.getAllByTestId("host-content")[0]).toHaveTextContent("Hallo / Hallo");
            expect(host.language).toBe("de");
            expect(getDefaults()).toEqual(overridden);
        } finally {
            setDefaults(prior);
            const restored = getDefaults() as Record<string, unknown>;
            for (const key of Object.keys(restored)) {
                if (!(key in prior)) delete restored[key];
            }
            expect(getDefaults()).toEqual(prior);
        }
    });

    it("sets script language on detached editor, date, select and view portals after a switch", async () => {
        vi.useFakeTimers({toFake: ["Date"]});
        vi.setSystemTime(now);
        try {
            const user = userEvent.setup();
            const calendar = (locale: "zh-Hans" | "zh-Hant") => (
                <EventCalendar events={[]} now={now} initialDate={now} locale={locale} />
            );
            const {container, rerender} = render(calendar("zh-Hans"));
            expect(container.querySelector(".event-calendar")).toHaveAttribute("lang", "zh-Hans");
            await user.click(screen.getByRole("button", {name: resources["zh-Hans"].calendar.toolbar.newEvent}));
            expect(document.querySelector('[data-slot="sheet-portal"]')).toHaveAttribute("lang", "zh-Hans");

            rerender(calendar("zh-Hant"));
            expect(container.querySelector(".event-calendar")).toHaveAttribute("lang", "zh-Hant");
            expect(document.querySelector('[data-slot="sheet-portal"]')).toHaveAttribute("lang", "zh-Hant");
            await user.click(screen.getByRole("button", {name: resources["zh-Hant"].calendar.editor.fields.startDate}));
            expect(document.querySelector('[data-slot="popover-content"]')?.closest("[lang]")).toHaveAttribute(
                "lang",
                "zh-Hant",
            );
            expect(
                screen.getByRole("button", {name: resources["zh-Hant"].calendar.datePicker.previousMonth}),
            ).toBeInTheDocument();
            expect(
                screen.getByRole("button", {name: resources["zh-Hant"].calendar.datePicker.nextMonth}),
            ).toBeInTheDocument();
            const today = format(now, "PPPP", {locale: dateLocaleFor("zh-Hant")});
            const selectedName = resources["zh-Hant"].calendar.datePicker.dayTodaySelected.replace("{{date}}", today);
            expect(screen.getByRole("button", {name: selectedName})).toBeInTheDocument();

            await user.keyboard("{Escape}");
            await user.click(
                screen.getByRole("combobox", {name: resources["zh-Hant"].calendar.editor.fields.startTime}),
            );
            expect(document.querySelector('[data-slot="select-content"]')?.closest("[lang]")).toHaveAttribute(
                "lang",
                "zh-Hant",
            );
            await user.keyboard("{Escape}");
            await user.click(screen.getByRole("button", {name: resources["zh-Hant"].calendar.editor.actions.cancel}));
            await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
            await user.click(screen.getByRole("button", {name: resources["zh-Hant"].calendar.views.month}));
            await waitFor(() =>
                expect(
                    document.querySelector('[data-slot="dropdown-menu-content"]')?.closest("[lang]"),
                ).toHaveAttribute("lang", "zh-Hant"),
            );
        } finally {
            vi.useRealTimers();
        }
    });
});
