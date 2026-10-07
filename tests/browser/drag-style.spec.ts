import {expect, test} from "./fixtures";
import type {CalendarFixture} from "./fixtures";
import type {Page} from "@playwright/test";
import {mouseMoveTo, mousePickup} from "./input";

const helpers = (page: Page, calendar: CalendarFixture) => {
    const open = async () => calendar.open({query: "overlaps=contracts", view: "Week", scrollTop: 500});
    const popup = () => page.locator('[data-slot="popover-content"][data-open]');
    const more = (count: number) => page.getByRole("button", {name: new RegExp(`^\\+${count} more events`)});
    const openPopup = async (count: number) => {
        await more(count).click();
        await popup().waitFor();
        await page.waitForFunction(() => {
            const element = document.querySelector('[data-slot="popover-content"][data-open]');
            return (
                element &&
                getComputedStyle(element).opacity === "1" &&
                element.getAnimations().every((animation) => animation.playState === "finished")
            );
        });
    };
    const updates = async () => Number(await page.locator("main").getAttribute("data-event-updates"));
    const pickup = async (source: ReturnType<Page["locator"]>) => mousePickup(page, source);
    const move = async (label: string) => mouseMoveTo(page, page.getByRole("button", {name: label, exact: true}));
    const metrics = async () => {
        const preview = page.locator('[data-dnd-dragging="true"]');
        await preview.getByText(/2:30pm.*4pm/).waitFor();
        await preview.evaluate(async (element) =>
            Promise.all(element.getAnimations().map((animation) => animation.finished)),
        );

        return preview.evaluate((element) => {
            const css = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            const lines = element.querySelectorAll(":scope > div");
            return {
                alignItems: css.alignItems,
                background: css.backgroundColor,
                border: css.borderWidth,
                color: css.color,
                fontSize: css.fontSize,
                gap: css.rowGap,
                height: rect.height,
                justifyContent: css.justifyContent,
                lineHeight: css.lineHeight,
                padding: css.padding,
                radius: css.borderRadius,
                shadow: css.boxShadow,
                timeTop: lines[1].getBoundingClientRect().top - rect.top,
                titleTop: lines[0].getBoundingClientRect().top - rect.top,
                width: rect.width,
            };
        });
    };

    return {open, popup, more, openPopup, updates, pickup, move, metrics};
};

test("Contracts groups: separate +2/+1 membership, keyboard cancel and resize", async ({page, calendar}) => {
    const h = helpers(page, calendar);
    await h.open();
    const earlier = await h.more(2).boundingBox();
    const review = await h.more(1).boundingBox();
    const slot = await page
        .getByRole("button", {name: "Add event October 9, 2026 at 10:00 AM", exact: true})
        .boundingBox();
    expect(
        Boolean(earlier && review && slot && earlier.y + earlier.height + 4 <= review.y && review.y === slot.y),
        "Review must have its own nonoverlapping +1 at 10 AM",
    ).toBe(true);
    await h.openPopup(2);
    await expect(h.popup().getByRole("button", {name: /^Edit /}), "Early group list/count mismatch").toHaveCount(3);
    await expect(
        h.popup().getByRole("button", {name: /^Edit Review contracts/}),
        "Review duplicated in earlier hidden group",
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await h.popup().waitFor({state: "detached"});
    await h.openPopup(1);
    await expect(
        h.popup().getByRole("button", {name: /^Edit /}),
        "Review popup must contain visible conference and hidden review",
    ).toHaveCount(2);
    await expect(
        h.popup().getByRole("button", {name: /^Edit Team Meeting/}),
        "Earlier hidden meetings duplicated in review group",
    ).toHaveCount(0);
    await h
        .popup()
        .getByRole("button", {name: /^Edit Review contracts/})
        .focus();
    await page.keyboard.press("Space");
    await page.locator('[data-dnd-dragging="true"]').waitFor();
    await page.keyboard.press("Escape");
    await page.locator('[data-dnd-dragging="true"]').waitFor({state: "detached"});
    expect(await h.updates(), "Review popup cancellation mutated event").toBe(0);
    await h.open();
    await page.setViewportSize({width: 700, height: 900});
    await h.more(2).waitFor();
    await h.more(1).waitFor();
    await page.setViewportSize({width: 3400, height: 900});
    await page.waitForFunction(() => document.querySelectorAll('[data-slot="time-overflow"]').length === 0);
    await page.setViewportSize({width: 1280, height: 900});
    await h.more(2).waitFor();
    await h.more(1).waitFor();
});

test("Popup/grid review drag: DOM identity and computed style parity", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open();
    await h.openPopup(1);
    const source = h.popup().locator('[data-calendar-event="review"]');
    const originalNode = await source.elementHandle();
    await h.pickup(source);
    await h.move("Add event October 5, 2026 at 2:30 PM");
    const popupStyle = await h.metrics();
    expect(
        await originalNode.evaluate((element) => element === document.querySelector('[data-dnd-dragging="true"]')),
        "Pickup replaced the source DOM node",
    ).toBe(true);
    expect(
        popupStyle.height === 96 && popupStyle.titleTop === 4 && popupStyle.timeTop === 20,
        "Popup preview must use normal card label spacing",
    ).toBe(true);
    expect(await h.updates(), "Hover committed review").toBe(0);
    await h.move("Add event October 4, 2026 at 2:30 PM");
    await page.mouse.up();
    await expect.poll(() => calendar.updates()).toBe(1);
    await page.locator('[data-sonner-toast][data-type="success"]').waitFor();
    const original = JSON.parse((await page.locator("main").getAttribute("data-events")) ?? "[]") as Array<{
        id: string;
        metadata: {source: string};
        start: string;
        end: string;
    }>;
    const moved = original.find((event) => event.id === "review");
    expect(
        Boolean(
            moved &&
            moved.metadata.source === "demo" &&
            new Date(moved.end).getTime() - new Date(moved.start).getTime() === 5400000,
        ),
        "Review identity, metadata or duration changed",
    ).toBe(true);
    await h.popup().waitFor({state: "detached"});
    await page.locator('[data-dnd-dragging="true"]').waitFor({state: "detached"});
    const grid = page.locator('[data-slot="time-column"] [data-calendar-event="review"]');
    const gridNode = await grid.elementHandle();
    await h.pickup(grid);
    await h.move("Add event October 5, 2026 at 2:30 PM");
    expect(
        Boolean(
            await gridNode?.evaluate((element) => element === document.querySelector('[data-dnd-dragging="true"]')),
        ),
        "Grid pickup replaced the source DOM node",
    ).toBe(true);
    const gridStyle = await h.metrics();
    expect(gridStyle).toEqual(popupStyle);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(page.locator('[data-dnd-dragging="true"]')).toHaveCount(0);
    expect(await h.updates(), "Canceled comparison drag mutated event").toBe(1);
    expect(
        Boolean(
            await gridNode?.evaluate(
                (element) =>
                    element === document.querySelector('[data-slot="time-column"] [data-calendar-event="review"]'),
            ),
        ),
        "Canceled grid drag did not restore its original DOM node",
    ).toBe(true);

    await calendar.open({query: "overlaps=single", view: "Week", scrollTop: 500});
    const sameDaySource = page.locator('[data-slot="time-column"] [data-calendar-event="overlap-sync"]');
    const sameDayNode = await sameDaySource.elementHandle();
    await h.pickup(sameDaySource);
    await h.move("Add event October 5, 2026 at 1:30 PM");
    expect(
        Boolean(
            await sameDayNode?.evaluate((element) => element === document.querySelector('[data-dnd-dragging="true"]')),
        ),
        "Same-day pickup replaced the source DOM node",
    ).toBe(true);
    await page.mouse.up();
    await expect.poll(() => calendar.updates()).toBe(1);
    await expect(page.locator('[data-dnd-dragging="true"]')).toHaveCount(0);
    expect(
        Boolean(
            await sameDayNode?.evaluate(
                (element) =>
                    element ===
                    document.querySelector('[data-slot="time-column"] [data-calendar-event="overlap-sync"]'),
            ),
        ),
        "Same-day drop replaced the mounted source DOM node",
    ).toBe(true);
});
