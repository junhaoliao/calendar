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
        const preview = page.locator("[data-move-preview] [data-calendar-event]");
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

test("Day: overnight move has one snapped four-hour preview and no jump on drop", async ({page, calendar}) => {
    await calendar.open({query: "resize=overnight", view: "Day", scrollTop: 1300});
    await page.getByRole("button", {name: "Next", exact: true}).click();
    const source = page.locator('[data-slot="time-column"] [data-calendar-event]').first();
    const id = await source.getAttribute("data-calendar-event");
    await mousePickup(page, source);
    const target = page.getByRole("button", {name: "Add event October 5, 2026 at 2:00 PM", exact: true});
    await target.evaluate((element) => {
        const viewport = element.closest('[data-slot="calendar-scroll"]')!;
        const frame = viewport.getBoundingClientRect();
        viewport.scrollTop += element.getBoundingClientRect().top - (frame.top + frame.height / 2);
    });
    await mouseMoveTo(page, target);

    const preview = page.locator("[data-move-preview] [data-calendar-event]");
    await expect(preview).toHaveCount(1);
    await expect(preview).toContainText("2pm - 6pm");
    const before = await calendar.stableBox(preview);
    const slot = await target.boundingBox();
    expect(before.height).toBe(256);
    expect(before.y).toBe(slot!.y);
    expect(before.x).toBe(slot!.x + 2);
    expect(before.width).toBe(slot!.width - 4);
    await expect(page.locator("[data-dnd-dragging=true]")).toHaveCSS("opacity", "0");
    await expect(page.locator('[data-move-source="true"]')).toHaveCSS("opacity", "0");
    await expect(preview).toHaveCSS("pointer-events", "none");
    expect(await calendar.updates()).toBe(0);
    await page.screenshot({path: "artifacts/day-move-preview.png"});

    await page.mouse.up();
    await expect.poll(() => calendar.updates()).toBe(1);
    await expect(page.locator("[data-move-preview]")).toHaveCount(0);
    const committed = page.locator(`[data-slot="time-column"] [data-calendar-event="${id}"]`);
    expect(await calendar.stableBox(committed)).toEqual(before);
    await expect(committed).toHaveCSS("opacity", "1");
});

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

test("Week: all-day bar preview adds no overflow to the all-day band", async ({page, calendar}) => {
    await calendar.open({query: "moves", view: "Week"});
    const band = page.locator('[data-slot="all-day-band"]');
    const source = band.locator('[data-calendar-event="move-point"]').first();
    await mousePickup(page, source);
    await mouseMoveTo(page, page.getByRole("button", {name: "Add event October 7, 2026 all day", exact: true}));

    const wrapper = band.locator('[data-move-preview="move-point"]');
    await expect(wrapper).toHaveCount(1);
    const bar = wrapper.locator("[data-calendar-event]");
    await expect(bar).toBeVisible();
    const wrapperBox = await calendar.stableBox(wrapper);
    const barBox = await calendar.stableBox(bar);
    // The wrapper only spans the bar plus its 4px top margin, never the whole cell.
    expect(wrapperBox.height).toBeLessThanOrEqual(barBox.height + 4);
    expect(await band.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(0);

    await page.keyboard.press("Escape");
    await page.mouse.up();
    expect(await calendar.updates()).toBe(0);
});

test("Week: refusal feedback overlays the grid without resizing the scroll viewport", async ({page, calendar}) => {
    await calendar.open({query: "moves&resolver=reason", view: "Week"});
    const viewport = page.locator('[data-slot="calendar-scroll"]');
    const height = await viewport.evaluate((element) => element.clientHeight);
    await mousePickup(page, page.locator('[data-slot="all-day-band"] [data-calendar-event="move-point"]').first());
    const target = page.getByRole("button", {name: "Add event October 7, 2026 at 10:00 AM", exact: true});
    await target.evaluate((element) => {
        const scroller = element.closest('[data-slot="calendar-scroll"]')!;
        const frame = scroller.getBoundingClientRect();
        scroller.scrollTop += element.getBoundingClientRect().top - (frame.top + frame.height / 2);
    });
    await mouseMoveTo(page, target);

    const refusal = page.locator('[data-slot="move-preview-rejection"]');
    await expect(refusal).toHaveText("Room is booked");
    expect(await viewport.evaluate((element) => element.clientHeight)).toBe(height);
    await expect(refusal).toHaveCSS("pointer-events", "none");
    const box = (await refusal.boundingBox())!;
    const frame = (await viewport.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height + 1);

    await page.keyboard.press("Escape");
    await page.mouse.up();
    expect(await calendar.updates()).toBe(0);
});

test("Week: refused and off-grid hovers keep the event visible at its origin", async ({page, calendar}) => {
    await calendar.open({query: "moves&resolver=reason", view: "Week"});
    const source = page.locator('[data-slot="all-day-band"] [data-calendar-event="move-point"]').first();
    const before = await calendar.stableBox(source);
    const origin = page.locator('[data-move-preview] [data-calendar-event="move-point"]');
    const atOrigin = async () => {
        await expect(origin).toHaveCount(1);
        const box = await calendar.stableBox(origin);
        for (const key of ["x", "y", "width", "height"] as const) {
            expect(Math.abs(box[key] - before[key]), key).toBeLessThanOrEqual(1);
        }
    };

    await mousePickup(page, source);
    const target = page.getByRole("button", {name: "Add event October 7, 2026 at 10:00 AM", exact: true});
    await target.evaluate((element) => {
        const scroller = element.closest('[data-slot="calendar-scroll"]')!;
        const frame = scroller.getBoundingClientRect();
        scroller.scrollTop += element.getBoundingClientRect().top - (frame.top + frame.height / 2);
    });
    await mouseMoveTo(page, target);
    await expect(page.locator('[data-slot="move-preview-rejection"]')).toHaveText("Room is booked");
    await atOrigin();
    await expect(page.locator('[data-move-source="true"]').first()).toHaveCSS("opacity", "0");

    await mouseMoveTo(page, page.getByRole("button", {name: "Reset demo", exact: true}));
    await expect(page.locator('[data-slot="move-preview-rejection"]')).toHaveCount(0);
    await atOrigin();

    await page.mouse.up();
    await expect(page.locator("[data-move-preview]")).toHaveCount(0);
    expect(await calendar.updates()).toBe(0);
    await expect(source).toHaveCSS("opacity", "1");
});
