import {act, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import type * as DndKit from "@dnd-kit/react";
import type {CalendarEvent} from "./types";
import type {CalendarLocale} from "../../i18n/locales";

type Outcome = {status: "accepted"; event: CalendarEvent} | {status: "rejected"; reason: string | null} | null;
const state = vi.hoisted(() => ({
    outcome: null as unknown,
    monitor: {} as {onDragStart?: () => void; onDragEnd?: (event: unknown) => void},
}));
vi.mock("./use-move-preview", () => ({useMoveResolution: () => state.outcome as Outcome}));
vi.mock("@dnd-kit/react", async (importOriginal) => ({
    ...(await importOriginal<typeof DndKit>()),
    useDragDropMonitor: (handlers: typeof state.monitor) => {
        state.monitor = handlers;
    },
}));

import {CalendarI18nProvider} from "../../i18n/provider";
import {MoveFeedback} from "./move-feedback";

const review: CalendarEvent = {
    id: "review",
    title: "Design review",
    start: new Date(2026, 9, 5, 14),
    end: new Date(2026, 9, 5, 18),
};
const announcement = () => document.querySelector('[data-slot="move-announcement"]')!;
const show = (outcome: Outcome, locale?: CalendarLocale) => {
    state.outcome = outcome;
    return render(
        <CalendarI18nProvider locale={locale}>
            <MoveFeedback />
        </CalendarI18nProvider>,
    );
};

describe("MoveFeedback announcements", () => {
    it("announces an accepted timed destination as a move", () => {
        show({status: "accepted", event: review});
        expect(announcement().textContent).toBe("Moving Design review: Oct 5, 2:00 PM – Oct 5, 6:00 PM");
    });
    it("announces all-day destinations with the localized all-day range", () => {
        show({
            status: "accepted",
            event: {...review, allDay: true, start: new Date(2026, 9, 5), end: new Date(2026, 9, 6)},
        });
        expect(announcement().textContent).toBe("Moving Design review: Oct 5, 2026 – Oct 6, 2026 · All day");
    });
    it.each([
        ["fr", "Déplacement de Design review : "],
        ["zh-Hans", "正在移动 Design review："],
        ["zh-Hant", "正在移動 Design review："],
    ] as const)("localizes the announcement in %s", (locale, prefix) => {
        show({status: "accepted", event: review}, locale);
        expect(announcement().textContent?.startsWith(prefix)).toBe(true);
    });
    it("leaves refusals to the alert and announces cancellation until the next drag", () => {
        show({status: "rejected", reason: "Room is booked"});
        expect(announcement().textContent).toBe("");
        expect(screen.getByRole("alert")).toHaveTextContent("Room is booked");
        act(() => state.monitor.onDragEnd?.({canceled: true, operation: {target: null}}));
        expect(announcement().textContent).toBe("Move cancelled");
        act(() => state.monitor.onDragStart?.());
        expect(announcement().textContent).toBe("");
    });
    it("does not announce cancellation after a drop on a slot", () => {
        show(null);
        act(() => state.monitor.onDragEnd?.({canceled: false, operation: {target: {}}}));
        expect(announcement().textContent).toBe("");
    });
    it("announces an off-grid release as cancellation", () => {
        show(null);
        act(() => state.monitor.onDragEnd?.({canceled: false, operation: {target: null}}));
        expect(announcement().textContent).toBe("Move cancelled");
    });
});
