import {expect, test} from "./fixtures";
import type {CalendarFixture} from "./fixtures";
import type {Page} from "@playwright/test";

const helpers = (page: Page, calendar: CalendarFixture) => {
    const more = () => page.getByRole("button", {name: /\+\d+ more events/});
    const column = () =>
        page
            .locator('[data-slot="time-column"]')
            .filter({has: page.getByRole("button", {name: "Add event October 5, 2026 at 12:00 PM", exact: true})});
    const count = async () => Number(await page.locator("main").getAttribute("data-event-updates"));
    const events = async () =>
        JSON.parse((await page.locator("main").getAttribute("data-events")) ?? "[]") as Array<{
            id: string;
            start: string;
            end: string;
            metadata?: {source: string};
        }>;
    const open = async (width = 1280, minWidth = 90) =>
        calendar.open({query: `overlaps&minWidth=${minWidth}`, width, view: "Week", scrollTop: 500});
    const visibleIds = async () =>
        column()
            .locator("[data-calendar-event]")
            .evaluateAll((elements) => elements.map((element) => element.getAttribute("data-calendar-event")));
    const settle = async (size: number) => {
        await page.waitForFunction(
            (expected) =>
                document.querySelectorAll('[data-slot="time-column"] [data-calendar-event]').length === expected,
            size,
        );
    };

    return {more, column, count, events, open, visibleIds, settle};
};

test("Narrow week: readable card, +2 overflow, hidden tail and no illustration", async ({page, calendar}) => {
    const h = helpers(page, calendar);
    await h.open();
    await h.more().waitFor();
    await expect
        .poll(async () => (await h.more().getAttribute("aria-label"))?.startsWith("+2 more events") === true, {
            message: "Initial hidden count",
        })
        .toBe(true);
    const card = h.column().locator("[data-calendar-event=overlap-sync]");
    const cardRect = await card.boundingBox();
    const coverageRect = await h.more().boundingBox();

    expect(Boolean(cardRect && coverageRect && cardRect.width >= 90), "Readable full-width card").toBe(true);
    expect(
        Boolean(
            cardRect &&
            coverageRect &&
            coverageRect.x >= cardRect.x &&
            coverageRect.x + coverageRect.width <= cardRect.x + cardRect.width &&
            coverageRect.y >= cardRect.y + 32 &&
            coverageRect.y + coverageRect.height <= cardRect.y + cardRect.height,
        ),
        "Overflow must sit inside the card below title/time",
    ).toBe(true);
    await expect
        .poll(
            async () =>
                await h
                    .column()
                    .locator('[data-slot="time-overflow"]')
                    .evaluate((element) => {
                        const end = new Date(element.getAttribute("data-coverage-end") ?? "");
                        return end.getHours() === 13 && end.getMinutes() === 30;
                    }),
            {message: "Hidden tail end"},
        )
        .toBe(true);
    await expect.poll(() => h.more().innerText(), {message: "Single-line overflow label"}).toBe("+2 more");
    await expect(h.column().locator(".border-dashed")).toHaveCount(0);
    await expect(h.column().getByText(/^through\b/i)).toHaveCount(0);
});

test("Keyboard popover: full titles/ranges and existing edit action without mutation", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open();
    await h.more().focus();
    await page.keyboard.press("Enter");
    const popup = page.locator('[data-slot="popover-content"][data-open]');
    await popup.waitFor();
    await expect(popup.getByRole("button", {name: /^Edit /}), "All participating events listed").toHaveCount(3);
    await expect
        .poll(
            async () =>
                (await popup.innerText()).includes("Client call — confirm rollout schedule and delivery milestones"),
            {message: "Full title missing"},
        )
        .toBe(true);
    await expect
        .poll(async () => (await popup.innerText()).includes("12:15 PM – 12:45 PM"), {
            message: "Full time range missing",
        })
        .toBe(true);
    await expect(popup.getByText(/^\d+\s+hidden(?:\s+events)?$/i)).toHaveCount(0);
    await popup.getByRole("button", {name: /^Edit Client call/}).click();
    await page.getByRole("dialog", {name: "Edit Event"}).waitFor();
    await expect(page.getByRole("textbox", {name: "Title", exact: true}), "Existing edit action").toHaveValue(
        "Client call — confirm rollout schedule and delivery milestones",
    );
    await page.getByRole("button", {name: "Cancel", exact: true}).click();
    await page.locator('[data-slot="sheet-content"]').waitFor({state: "detached"});
    expect(await h.count(), "Opening/canceling editor mutated events").toBe(0);
});

test("Open day view: selected date, nonoverlapping lanes and unchanged duration heights", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open();
    await h.more().click();
    const popup = page.locator('[data-slot="popover-content"][data-open]');
    await popup.getByRole("button", {name: "Open day view"}).click();
    await page.getByRole("button", {name: "Day", exact: true}).waitFor();
    await h.settle(3);
    await expect
        .poll(async () => (await page.getByRole("heading", {level: 2}).innerText()).includes("October 5, 2026"), {
            message: "Wrong selected date",
        })
        .toBe(true);
    const dayRects = await page.locator('[data-slot="time-column"] [data-calendar-event]').evaluateAll((elements) =>
        elements.map((element) => {
            const rect = element.getBoundingClientRect();
            return {
                bottom: rect.bottom,
                height: rect.height,
                id: element.getAttribute("data-calendar-event"),
                right: rect.right,
                width: rect.width,
                x: rect.x,
                y: rect.y,
            };
        }),
    );

    for (let index = 0; index < dayRects.length; index++) {
        expect(dayRects[index].width >= 90, "Thin day card").toBe(true);
        for (let other = index + 1; other < dayRects.length; other++) {
            const a = dayRects[index];
            const b = dayRects[other];

            if (a.y < b.bottom && b.y < a.bottom) {
                expect(a.right <= b.x || b.right <= a.x, "Cards overlap horizontally").toBe(true);
            }
        }
    }
    expect(dayRects.find((item) => item.id === "overlap-sync")?.height === 64, "Sync duration geometry changed").toBe(
        true,
    );
    expect(dayRects.find((item) => item.id === "overlap-call")?.height === 32, "Call duration geometry changed").toBe(
        true,
    );
    await expect(h.more(), "Wide day overflow unnecessary").toHaveCount(0);
});

test("Resize: 1 → 1 → 3 → 1 cards, stable lanes and exact hidden counts", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open();
    const initial = await h.visibleIds();
    await page.setViewportSize({width: 700, height: 900});
    await h.settle(1);
    await expect
        .poll(async () => (await h.more().getAttribute("aria-label"))?.startsWith("+2 more events") === true, {
            message: "Tiny-column count",
        })
        .toBe(true);
    await page.setViewportSize({width: 2560, height: 900});
    await h.settle(3);
    const wide = await h.visibleIds();
    expect(wide.join(",") === "overlap-sync,overlap-call,overlap-review", "Lane ordering changed").toBe(true);
    await page.setViewportSize({width: 1280, height: 900});
    await h.settle(1);
    expect((await h.visibleIds()).join(",") === initial.join(","), "Visible lane identity changed after resize").toBe(
        true,
    );
    await expect
        .poll(async () => (await h.more().getAttribute("aria-label"))?.startsWith("+2 more events") === true, {
            message: "Resize count failed",
        })
        .toBe(true);
});

test("Configured minimum and touch popover access/Escape dismissal", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open(1280, 45);
    await h.settle(3);
    await expect(h.more(), "Configured minimum ignored").toHaveCount(0);
    await h.open();
    const popup = page.locator('[data-slot="popover-content"][data-open]');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setTouchEmulationEnabled", {enabled: true});
    const tap = await h.more().boundingBox();
    if (!tap) {
        throw new Error("Touch target missing");
    }
    await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{x: tap.x + tap.width / 2, y: tap.y + tap.height / 2, id: 0, force: 1}],
    });
    await cdp.send("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
    await popup.waitFor();
    await expect(popup.getByRole("button", {name: /^Edit /}), "Touch popover unavailable").toHaveCount(3);
    await page.keyboard.press("Escape");
    await popup.waitFor({state: "detached"});
    await cdp.send("Emulation.setTouchEmulationEnabled", {enabled: false});
    await cdp.detach();
});

test("Visible-card dragging retains metadata/duration, emits one update and success toast", async ({
    page,
    calendar,
}) => {
    const h = helpers(page, calendar);

    await h.open();
    const card = h.column().locator("[data-calendar-event=overlap-sync]");
    await card.scrollIntoViewIfNeeded();
    const source = await card.boundingBox();
    const target = await page
        .getByRole("button", {name: "Add event October 5, 2026 at 2:00 PM", exact: true})
        .boundingBox();
    if (!source || !target) {
        throw new Error("Drag geometry missing");
    }
    await page.mouse.move(source.x + 12, source.y + 8);
    await page.mouse.down();
    await page.mouse.move(source.x + 24, source.y + 8, {steps: 4});
    await page.mouse.move(target.x + target.width / 2, target.y + 8, {steps: 12});
    await page.locator('[data-dnd-dragging="true"]').waitFor();
    expect(await h.count(), "Hover emitted an update").toBe(0);
    await page.mouse.up();
    await expect.poll(() => calendar.updates()).toBe(1);
    const moved = (await h.events()).find((event) => event.id === "overlap-sync");
    expect(
        moved?.metadata?.source === "demo" &&
            new Date(moved.start).getHours() === 14 &&
            new Date(moved.end).getHours() === 15,
        "Drag identity, metadata or duration changed",
    ).toBe(true);
    await page.locator('[data-sonner-toast][data-type="success"]').waitFor();
});

test("Resize and Escape cancel keyboard drags without mutation", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open();
    const card = h.column().locator("[data-calendar-event=overlap-sync]");
    await card.scrollIntoViewIfNeeded();
    await card.focus();
    await page.keyboard.press("Space");
    await page.locator('[data-dnd-dragging="true"]').waitFor();
    await page.setViewportSize({width: 700, height: 900});
    await page.locator('[data-dnd-dragging="true"]').waitFor({state: "detached"});
    expect(await h.count(), "Resize/cancel changed event").toBe(0);
    await page.setViewportSize({width: 1280, height: 900});
    await card.waitFor();
    await card.focus();
    await page.keyboard.press("Space");
    await page.locator('[data-dnd-dragging="true"]').waitFor();
    await page.keyboard.press("Escape");
    await page.locator('[data-dnd-dragging="true"]').waitFor({state: "detached"});
    expect(await h.count(), "Escape changed event").toBe(0);
});
