import {expect, test as base} from "@playwright/test";
import type {Locator} from "@playwright/test";

export interface DemoEvent {
    id: string;
    title: string;
    start: string;
    end: string;
    allDay?: boolean;
    metadata?: {source: string};
}

interface OpenOptions {
    query?: string;
    view?: "Month" | "Week" | "Day" | "Agenda";
    scrollTop?: number;
    width?: number;
}

export interface CalendarFixture {
    open: (options?: OpenOptions) => Promise<void>;
    events: () => Promise<DemoEvent[]>;
    updates: () => Promise<number>;
    stableBox: (locator: Locator) => Promise<{x: number; y: number; width: number; height: number}>;
}

const test = base.extend<{calendar: CalendarFixture; pageErrors: string[]}>({
    pageErrors: [
        async ({page}, use) => {
            const errors: string[] = [];
            page.on("pageerror", (error) => errors.push(error.message));
            page.on("console", (message) => {
                if (message.type() === "error") errors.push(message.text());
            });
            await use(errors);
            expect(errors, "browser runtime/console errors").toEqual([]);
        },
        {auto: true},
    ],
    calendar: async ({page}, use) => {
        const open = async ({query = "", view = "Month", scrollTop, width = 1280}: OpenOptions = {}) => {
            await page.setViewportSize({width, height: 900});
            await page.goto(`/calendar-demo.html?date=2026-10-04&debug${query ? `&${query}` : ""}`);
            if (view !== "Month") {
                await page.locator("[aria-haspopup=menu]").click();
                await page.getByRole("menuitem", {name: new RegExp(`^${view}`)}).click();
                await page.getByRole("menu").waitFor({state: "detached"});
            }
            if (scrollTop !== undefined) {
                await page.locator('[data-slot="calendar-scroll"]').evaluate((element, top) => {
                    element.scrollTop = top;
                }, scrollTop);
            }
            await page.evaluate(() => document.fonts.ready);
        };
        const events = async () =>
            JSON.parse((await page.locator("main").getAttribute("data-events")) ?? "[]") as DemoEvent[];
        const updates = async () => Number(await page.locator("main").getAttribute("data-event-updates"));
        const stableBox = async (locator: Locator) => {
            let previous = "";
            await expect
                .poll(
                    async () => {
                        await page.evaluate(
                            () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
                        );
                        const current = JSON.stringify(await locator.boundingBox());
                        const stable = current === previous && current !== "null";
                        previous = current;
                        return stable;
                    },
                    {intervals: [16]},
                )
                .toBe(true);
            return (await locator.boundingBox())!;
        };
        await use({open, events, updates, stableBox});
    },
});

export {expect, test};
