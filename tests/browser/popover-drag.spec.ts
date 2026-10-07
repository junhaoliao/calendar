import {expect, test} from "./fixtures";
import type {CalendarFixture} from "./fixtures";
import type {Page} from "@playwright/test";
import {mouseMoveTo, mousePickup} from "./input";

const helpers = (page: Page, calendar: CalendarFixture) => {
    const updates = async () => Number(await page.locator("main").getAttribute("data-event-updates"));
    const events = async () =>
        JSON.parse((await page.locator("main").getAttribute("data-events")) ?? "[]") as Array<{
            id: string;
            start: string;
            end: string;
            allDay?: boolean;
            metadata: {source: string};
        }>;
    const popup = () => page.locator('[data-slot="popover-content"][data-open]');
    const row = (id: string) => popup().locator(`[data-calendar-event="${id}"]`);
    const target = () => page.getByRole("button", {name: "Add event October 6, 2026 at 2:00 PM", exact: true});
    const open = async (example = "", width = 1280, resolver = "") =>
        calendar.open({query: `overlaps=${example}&resolver=${resolver}`, width, view: "Week", scrollTop: 500});
    const openPopup = async () => {
        const more = page.getByRole("button", {name: /\+\d+ more events/}).first();
        await more.scrollIntoViewIfNeeded();
        await more.click();
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
    const popupPickup = async (id: string) => mousePickup(page, row(id), 16);
    const mouseMove = async (destination = target()) => mouseMoveTo(page, destination);
    const completed = async (id: string) => {
        await expect.poll(() => calendar.updates()).toBe(1);
        const event = (await events()).find((item) => item.id === id);
        expect(Boolean(event && event.metadata.source === "demo"), "Event identity/metadata changed").toBe(true);
        await expect(page.getByRole("dialog", {name: "Edit Event"}), "Drag opened editor").toHaveCount(0);
        await page.locator('[data-sonner-toast][data-type="success"]').waitFor();

        if (!event) {
            throw new Error("Updated event missing");
        }

        return event;
    };

    return {updates, events, popup, row, target, open, openPopup, popupPickup, mouseMove, completed};
};

test("popup resolver: host point preview is committed with its logical popup anchor", async ({page, calendar}) => {
    const h = helpers(page, calendar);
    await h.open("", 1280, "point");
    await h.openPopup();
    await h.popupPickup("overlap-review");
    await h.mouseMove();
    const preview = page.locator('[data-dnd-dragging="true"][data-calendar-event]');
    const start = await preview.getAttribute("data-segment-start");
    const end = await preview.getAttribute("data-segment-end");
    expect(start).toBe(end);
    await page.mouse.up();
    const moved = await h.completed("overlap-review");
    expect(moved.start).toBe(start);
    expect(moved.end).toBe(end);
    expect(moved.metadata).toMatchObject({source: "demo", pickup: {source: "popup", lane: "timed", dayOffset: 0}});
});

test("Narrow singleton and short-card overflow preserve width and keyboard access", async ({page, calendar}) => {
    const h = helpers(page, calendar);
    await h.open("single", 700);
    const single = page.locator('[data-slot="time-column"] [data-calendar-event=overlap-sync]');
    await single.waitFor();
    await expect(page.getByRole("button", {name: /more events/}), "Lone event collapsed").toHaveCount(0);
    const singleRect = await single.boundingBox();
    const columnRect = await single.locator("../..").boundingBox();
    expect(
        Boolean(singleRect && columnRect && Math.abs(columnRect.width - singleRect.width) <= 5),
        "Lone event must use column width",
    ).toBe(true);
    await h.open("short", 700);
    const short = page.locator('[data-slot="time-column"] [data-calendar-event=overlap-sync]');
    const more = page.getByRole("button", {name: /\+1 more events/});
    const shortRect = await short.boundingBox();
    const moreRect = await more.boundingBox();
    expect(
        Boolean(
            shortRect &&
            moreRect &&
            shortRect.height === 16 &&
            moreRect.y >= shortRect.y + shortRect.height &&
            moreRect.width > shortRect.width - 20,
        ),
        "Compact column-wide overflow must leave the unchanged 15-minute card label visible",
    ).toBe(true);
    await more.focus();
    await page.keyboard.press("Enter");
    await expect(h.popup().getByRole("button", {name: /^Edit /}), "Short-card popup count").toHaveCount(2);
});

test("Mouse hidden popup event → quarter-hour grid: one update, original metadata/duration and toast", async ({
    page,
    calendar,
}) => {
    const h = helpers(page, calendar);

    await h.open();
    await h.openPopup();
    await h.popupPickup("overlap-review");
    await h.mouseMove();
    expect(await h.updates(), "Popup hover emitted update").toBe(0);
    await expect(h.popup(), "Popup source unmounted during drag").toBeVisible();
    const preview = page.locator('[data-dnd-dragging="true"]');
    await expect
        .poll(async () => (await preview.innerText()).includes("Design review"), {message: "Drag preview lost title"})
        .toBe(true);
    const previewBox = await preview.boundingBox();
    const destinationBox = await h.target().boundingBox();
    expect(
        Boolean(previewBox && destinationBox && previewBox.height === 64 && previewBox.width <= destinationBox.width),
        "Popup drag preview must use timed-card geometry",
    ).toBe(true);
    await page.mouse.up();
    const moved = await h.completed("overlap-review");
    expect(
        new Date(moved.start).getDate() === 6 &&
            new Date(moved.start).getHours() === 14 &&
            new Date(moved.start).getMinutes() === 0 &&
            new Date(moved.end).getTime() - new Date(moved.start).getTime() === 3600000,
        "Popup timed move changed duration or snap",
    ).toBe(true);
});

test("Mouse popup Escape/outside cancellation preserves every event and opens no editor/toast", async ({
    page,
    calendar,
}) => {
    const h = helpers(page, calendar);

    for (const cancel of ["Escape", "outside"]) {
        await test.step(`${cancel} cancellation`, async () => {
            await h.open();
            await h.openPopup();
            const before = JSON.stringify(await h.events());
            await h.popupPickup("overlap-call");
            await h.mouseMove();
            if (cancel === "Escape") {
                await page.keyboard.press("Escape");
            } else {
                await page.mouse.move(5, 5, {steps: 8});
            }
            await page.mouse.up();
            await page.locator('[data-dnd-dragging="true"]').waitFor({state: "detached"});
            expect(
                (await h.updates()) === 0 && before === JSON.stringify(await h.events()),
                `${cancel} changed popup event`,
            ).toBe(true);
            await expect(page.getByRole("dialog", {name: "Edit Event"}), "Cancel opened editor").toHaveCount(0);
            await expect(
                page.locator('[data-sonner-toast][data-type="success"]'),
                "Cancel emitted success toast",
            ).toHaveCount(0);
        });
    }
    await test.step("Editing survives the outside cancellation", async () => {
        if ((await h.popup().count()) === 0) {
            await h.openPopup();
        }
        await h.row("overlap-call").click();
        await page.getByRole("dialog", {name: "Edit Event"}).waitFor();
        await expect
            .poll(
                async () =>
                    (await page.getByRole("textbox", {name: "Title", exact: true}).inputValue()).startsWith(
                        "Client call",
                    ),
                {message: "Canceled drag broke editing"},
            )
            .toBe(true);
        await page.getByRole("button", {name: "Cancel", exact: true}).click();
        await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(0);
        expect(await h.updates(), "Click-to-edit mutated data before save").toBe(0);
    });
});

test("Keyboard popup Space/Escape and arrows/Enter work with a simultaneously mounted grid source", async ({
    page,
    calendar,
}) => {
    const h = helpers(page, calendar);
    await h.open();
    await h.openPopup();
    await h.row("overlap-sync").focus();
    await page.keyboard.press("Space");
    await page.locator('[data-dnd-dragging="true"]').waitFor();
    await page.keyboard.press("Escape");
    await page.locator('[data-dnd-dragging="true"]').waitFor({state: "detached"});
    expect(await h.updates(), "Keyboard Escape committed popup event").toBe(0);
    await h.open();
    await h.openPopup();
    const sourceBox = await h.row("overlap-sync").boundingBox();
    const targetBox = await h.target().boundingBox();
    if (!sourceBox || !targetBox) {
        throw new Error("Keyboard drag geometry missing");
    }
    await h.row("overlap-sync").focus();
    await page.keyboard.press("Space");
    await page.locator('[data-dnd-dragging="true"]').waitFor();
    const dx = targetBox.x + targetBox.width / 2 - sourceBox.x - sourceBox.width / 2;
    const dy = targetBox.y + targetBox.height / 2 - sourceBox.y - sourceBox.height / 2;
    for (let index = 0; index < Math.round(Math.abs(dx) / 10); index++) {
        await page.keyboard.press(dx > 0 ? "ArrowRight" : "ArrowLeft");
    }
    for (let index = 0; index < Math.round(Math.abs(dy) / 10); index++) {
        await page.keyboard.press(dy > 0 ? "ArrowDown" : "ArrowUp");
    }
    await page.keyboard.press("Enter");
    const keyboard = await h.completed("overlap-sync");
    expect(
        new Date(keyboard.start).getDate() === 6 &&
            new Date(keyboard.start).getMinutes() % 15 === 0 &&
            new Date(keyboard.end).getTime() - new Date(keyboard.start).getTime() === 3600000,
        "Keyboard popup move must snap and retain duration",
    ).toBe(true);
});

test("Touch popup long-press move, Escape and outside cancellation retain the original drag rules", async ({
    page,
    calendar,
}) => {
    const h = helpers(page, calendar);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setTouchEmulationEnabled", {enabled: true});
    for (const action of ["Escape", "outside", "drop"]) {
        await test.step(`${action} touch interaction`, async () => {
            await h.open();
            await h.openPopup();
            const source = await h.row("overlap-review").boundingBox();
            const destination = await h.target().boundingBox();
            if (!source || !destination) {
                throw new Error("Touch popup geometry missing");
            }
            const touch = async (type: "touchStart" | "touchMove", x: number, y: number) =>
                cdp.send("Input.dispatchTouchEvent", {type: type, touchPoints: [{id: 0, x: x, y: y, force: 1}]});
            await touch("touchStart", source.x + source.width / 2, source.y + source.height / 2);
            // long-press hold: touch activation needs >250ms (calendar-sensors.ts)
            await page.waitForTimeout(350);
            await touch("touchMove", destination.x + destination.width / 2, destination.y + 8);
            await page.locator('[data-dnd-dragging="true"]').waitFor();
            expect(
                (await page.locator('[data-dnd-dragging="true"]').getAttribute("data-calendar-event")) ===
                    "overlap-review",
                "Touch picked the wrong row",
            ).toBe(true);
            if (action === "Escape") {
                await page.keyboard.press("Escape");
            } else if (action === "outside") {
                await touch("touchMove", 5, 5);
            }
            await cdp.send("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
            await page.locator('[data-dnd-dragging="true"]').waitFor({state: "detached"});
            if (action === "drop") {
                const touched = await h.completed("overlap-review");
                expect(
                    new Date(touched.start).getDate() === 6 &&
                        new Date(touched.end).getTime() - new Date(touched.start).getTime() === 3600000,
                    "Touch duration changed",
                ).toBe(true);
            } else {
                expect(await h.updates(), `Touch ${action} committed`).toBe(0);
            }
        });
    }
    await cdp.send("Emulation.setTouchEmulationEnabled", {enabled: false});
    await cdp.detach();
});

test("Mouse popup source survives widening; keyboard popup resize cancels without mutation", async ({
    page,
    calendar,
}) => {
    const h = helpers(page, calendar);

    await h.open();
    await h.openPopup();
    await h.popupPickup("overlap-review");
    await page.setViewportSize({width: 2560, height: 900});
    await page.locator('[data-dnd-dragging="true"]').waitFor();
    await expect(h.popup(), "Resize unmounted popup source").toBeVisible();
    await h.mouseMove();
    await page.mouse.up();
    await h.completed("overlap-review");
    await h.open();
    await h.openPopup();
    await h.row("overlap-sync").focus();
    await page.keyboard.press("Space");
    await page.locator('[data-dnd-dragging="true"]').waitFor();
    await page.setViewportSize({width: 2560, height: 900});
    await page.locator('[data-dnd-dragging="true"]').waitFor({state: "detached"});
    expect(await h.updates(), "Resize committed keyboard popup drag").toBe(0);
});

test("Overnight popup: full range and continued timed → all-day dates", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open("overnight");
    const tuesday = page
        .locator('[data-slot="time-column"]')
        .filter({has: page.getByRole("button", {name: "Add event October 6, 2026 at 12:00 AM", exact: true})});
    await tuesday.getByRole("button", {name: /\+1 more events/}).scrollIntoViewIfNeeded();
    await tuesday.getByRole("button", {name: /\+1 more events/}).click();
    await h.popup().waitFor();
    await expect
        .poll(async () => (await h.popup().innerText()).includes("Oct 5 10:15 PM – Oct 6 1:45 AM"), {
            message: "Overnight popup must show full dated range",
        })
        .toBe(true);
    await h.popupPickup("overlap-call");
    await h.mouseMove(page.getByRole("button", {name: "Add event October 7, 2026 all day", exact: true}));
    await page.mouse.up();
    const converted = await h.completed("overlap-call");
    expect(
        converted.allDay === true &&
            new Date(converted.start).getDate() === 6 &&
            new Date(converted.end).getDate() === 7,
        "Continued popup segment must convert the whole event relative to grabbed day",
    ).toBe(true);
});
