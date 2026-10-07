import {expect, test} from "./fixtures";
import type {CalendarFixture} from "./fixtures";
import type {Page} from "@playwright/test";

const helpers = (page: Page, calendar: CalendarFixture) => {
    const events = async () =>
        JSON.parse((await page.locator("main").getAttribute("data-events")) ?? "[]") as Array<{
            id: string;
            title: string;
            start: string;
            end: string;
            allDay?: boolean;
            metadata?: {source: string};
        }>;
    const updateCount = async () => Number(await page.locator("main").getAttribute("data-event-updates"));
    const item = async (id: string) => {
        const result = (await events()).find((event) => event.id === id);
        if (!result) {
            throw new Error(`Missing event ${id}`);
        }

        return result;
    };
    const local = (value: string) => new Date(value).getTime();
    const open = async (duration = 60) => calendar.open({query: `duration=${duration}`, view: "Week"});
    const drag = async (selector: string, targetName: string, mode: "mouse" | "touch" = "mouse", cancel = false) => {
        const count = await updateCount();
        const source = page.locator(selector).first();
        await source.scrollIntoViewIfNeeded();
        const a = await source.boundingBox();
        if (!a) {
            throw new Error("Source missing");
        }
        const x = a.x + Math.min(12, a.width / 2);
        const y = await source.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const band = element.closest(".event-calendar")?.querySelector('[data-slot="all-day-band"]');
            const clip =
                !element.closest('[data-slot="all-day-band"]') && band ? band.getBoundingClientRect().bottom : rect.top;

            return Math.max(rect.top, clip) + 8;
        });
        const cdp = mode === "touch" ? await page.context().newCDPSession(page) : null;

        if (cdp) {
            await cdp.send("Emulation.setTouchEmulationEnabled", {enabled: true});
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchStart",
                touchPoints: [{x: x, y: y, id: 0, force: 1}],
            });
            // long-press hold: touch activation needs >250ms (calendar-sensors.ts)
            await page.waitForTimeout(300);
        } else {
            await page.mouse.move(x, y);
            await page.mouse.down();
            await page.mouse.move(x + 12, y, {steps: 4});
        }
        const target = page.getByRole("button", {name: targetName, exact: true});
        await target.scrollIntoViewIfNeeded();
        await target.evaluate((element) => {
            if (element.closest('[data-slot="all-day-band"]')) {
                return;
            }
            const viewport = element.closest('[data-slot="calendar-scroll"]');
            if (viewport) {
                const rect = element.getBoundingClientRect();
                const frame = viewport.getBoundingClientRect();
                viewport.scrollTop += rect.top - (frame.top + frame.height / 2);
            }
        });
        const b = await target.boundingBox();
        if (!b) {
            throw new Error("Destination missing");
        }
        const tx = b.x + b.width / 2;
        const ty = b.y + Math.min(8, b.height / 2);

        if (cdp) {
            for (let step = 1; step <= 12; step++) {
                await cdp.send("Input.dispatchTouchEvent", {
                    type: "touchMove",
                    touchPoints: [{x: x + ((tx - x) * step) / 12, y: y + ((ty - y) * step) / 12, id: 0, force: 1}],
                });
            }
        } else {
            await page.mouse.move(tx, ty, {steps: 12});
        }

        /* Finish at the semantic slot after scroll/geometry notifications settle. */
        await calendar.stableBox(target);
        const settled = await target.boundingBox();
        if (settled) {
            const finalX = settled.x + settled.width / 2;
            const finalY = settled.y + Math.min(8, settled.height / 2);
            if (cdp) {
                await cdp.send("Input.dispatchTouchEvent", {
                    type: "touchMove",
                    touchPoints: [{x: finalX, y: finalY, id: 0, force: 1}],
                });
            } else {
                await page.mouse.move(finalX, finalY);
            }
        }
        const preview = page.locator("[data-dnd-dragging=true][data-calendar-event]");
        await preview.waitFor();
        const text = await preview.innerText();
        const view = await preview.getAttribute("data-view");
        const geometry = await preview.evaluate((element) => {
            const lines = [...element.querySelectorAll(":scope > div")];
            return {
                height: element.getBoundingClientRect().height,
                title: lines[0]?.textContent,
                range: lines[1]?.textContent,
                stacked:
                    lines.length === 2 &&
                    lines[1].getBoundingClientRect().top >= lines[0].getBoundingClientRect().bottom,
            };
        });
        const resolvedRange = {
            start: await preview.getAttribute("data-segment-start"),
            end: await preview.getAttribute("data-segment-end"),
        };
        const destinationSegments = await page
            .locator("[data-move-preview] [data-calendar-event]")
            .evaluateAll((elements) =>
                elements.map((element) => ({
                    start: element.getAttribute("data-segment-start"),
                    end: element.getAttribute("data-segment-end"),
                })),
            );
        const rejected = await preview.getAttribute("data-move-rejected");

        await expect(page.locator("[data-slot=drag-preview]"), "Redundant drag popup returned").toHaveCount(0);
        expect((await updateCount()) === count, "Hover emitted an update").toBe(true);
        if (cancel) {
            await page.keyboard.press("Escape");
        }
        if (cdp) {
            await cdp.send("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
            await cdp.send("Emulation.setTouchEmulationEnabled", {enabled: false});
            await cdp.detach();
        } else {
            await page.mouse.up();
        }
        await preview.waitFor({state: "detached"});
        await page.locator("[data-dnd-placeholder]").waitFor({state: "detached"});

        return {
            after: await updateCount(),
            before: count,
            geometry: geometry,
            text: text,
            view: view,
            resolvedRange,
            destinationSegments,
            rejected,
        };
    };

    return {events, updateCount, item, local, open, drag};
};

for (const mode of ["mouse", "touch"] as const) {
    test(`${mode}: host-defined multi-day conversion from an interior day previews the completed range`, async ({
        page,
        calendar,
    }) => {
        await calendar.open({query: "moves", view: "Week"});
        const h = helpers(page, calendar);
        const result = await h.drag(
            '[data-slot="all-day-band"] [data-calendar-event="move-range"] >> nth=1',
            "Add event October 7, 2026 at 10:00 AM",
            mode,
        );
        expect(result.after).toBe(1);
        const moved = await h.item("move-range");
        expect(moved.start).toBe(result.resolvedRange.start);
        expect(moved.end).toBe(result.resolvedRange.end);
        expect(new Date(moved.end).getTime() - new Date(moved.start).getTime()).toBe(49 * 3600000);
        expect(result.destinationSegments).toHaveLength(3);
        expect(result.destinationSegments[0].start).toBe(moved.start);
        expect(result.destinationSegments[2].end).toBe(moved.end);
        await expect(page.locator("main")).toHaveAttribute("data-notifications", "1");
        const notification = JSON.parse((await page.locator("main").getAttribute("data-last-notification"))!);
        expect(notification).toEqual({action: "moved", event: moved});
    });

    test(`${mode}: host deadline converts to a visible draggable timed point`, async ({page, calendar}) => {
        await calendar.open({query: "moves", view: "Week"});
        const h = helpers(page, calendar);
        const result = await h.drag(
            '[data-slot="all-day-band"] [data-calendar-event="move-point"]',
            "Add event October 7, 2026 at 10:00 AM",
            mode,
        );
        expect(result.after).toBe(1);
        const moved = await h.item("move-point");
        expect(moved.start).toBe(moved.end);
        expect(moved.start).toBe(result.resolvedRange.start);
        expect(result.geometry.height).toBe(16);
        const surface = page.locator('[data-slot="time-column"] [data-calendar-event="move-point"]');
        await expect(surface).toBeVisible();
        await expect(surface).toHaveAttribute("aria-roledescription", "draggable");
        expect(moved.metadata).toMatchObject({source: "demo", deadlineOnly: true, endPrecision: "day"});
        const again = await h.drag(
            '[data-slot="time-column"] [data-calendar-event="move-point"]',
            "Add event October 8, 2026 at 11:00 AM",
            mode,
        );
        expect(again.after).toBe(2);
        const next = await h.item("move-point");
        expect(next.start).toBe(next.end);
        expect(next.start).toBe(again.resolvedRange.start);
    });

    test(`${mode}: host rejection shows an alert and emits neither mutation nor success`, async ({page, calendar}) => {
        await calendar.open({query: "moves&resolver=reject", view: "Week"});
        const h = helpers(page, calendar);
        const before = await h.events();
        const result = await h.drag(
            '[data-slot="all-day-band"] [data-calendar-event="move-point"]',
            "Add event October 7, 2026 at 10:00 AM",
            mode,
        );
        expect(result.rejected).toBe("true");
        expect(result.text).toBe("Move not allowed");
        expect(result.destinationSegments).toHaveLength(0);
        expect(result.after).toBe(0);
        expect(await h.events()).toEqual(before);
        await expect(page.getByRole("alert")).toHaveText("Move not allowed");
        await expect(page.locator("main")).toHaveAttribute("data-notifications", "0");
        await expect(page.locator("main")).toHaveAttribute("data-rejections", "1");
        await expect(page.locator('[data-sonner-toast][data-type="success"]')).toHaveCount(0);
        await page.getByRole("button", {name: "Dismiss", exact: true}).click();
        await expect(page.locator('[data-slot="move-rejection"]')).toHaveCount(0);
        await expect(page.getByRole("region", {name: "Event calendar", exact: true})).toBeFocused();
        await expect(page.locator("main")).toHaveAttribute("data-rejections", "1");
    });
}

test("keyboard: resolver preview agrees with a changed drop and cancels without mutation", async ({page, calendar}) => {
    await calendar.open({query: "moves", view: "Week", scrollTop: 0});
    const source = page.locator('[data-slot="all-day-band"] [data-calendar-event="move-range"]').first();
    await source.focus();
    await page.keyboard.press("Space");
    for (
        let step = 0;
        step < 20 && (await page.locator('[data-drop-target="true"][data-minute]').count()) === 0;
        step++
    ) {
        await page.keyboard.press("ArrowDown");
    }
    const preview = page.locator('[data-dnd-dragging="true"][data-calendar-event]');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute("data-view", "week");
    const start = await preview.getAttribute("data-segment-start");
    const end = await preview.getAttribute("data-segment-end");
    await expect(page.locator("main")).toHaveAttribute("data-event-updates", "0");
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toHaveAttribute("data-event-updates", "1");
    const moved = (await calendar.events()).find((event) => event.id === "move-range")!;
    expect(moved.start).toBe(start);
    expect(moved.end).toBe(end);
    expect(new Date(moved.end).getTime() - new Date(moved.start).getTime()).toBe(49 * 3600000);
    await expect(page.locator("main")).toHaveAttribute("data-notifications", "1");
    const next = page.locator('[data-slot="all-day-band"] [data-calendar-event="move-point"]').first();
    await next.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    await expect(page.locator("main")).toHaveAttribute("data-event-updates", "1");
});

test("host resolver: continued timed segment to all-day honors exclusive midnight and preserves mixed precision", async ({
    page,
    calendar,
}) => {
    await calendar.open({query: "moves", view: "Week"});
    const h = helpers(page, calendar);
    const before = await h.item("move-night");
    const result = await h.drag(
        '[data-slot="time-column"] [data-calendar-event="move-night"] >> nth=1',
        "Add event October 8, 2026 all day",
    );
    const moved = await h.item("move-night");
    expect(moved.allDay).toBe(true);
    expect(moved.start).toBe(result.resolvedRange.start);
    expect(moved.end).toBe(result.resolvedRange.end);
    expect(new Date(moved.start).getDate()).toBe(7);
    expect(new Date(moved.end).getDate()).toBe(8);
    expect(result.destinationSegments).toHaveLength(2);
    expect(moved.metadata).toEqual(before.metadata);
});

test("keyboard: rejected conversion announces failure without mutation", async ({page, calendar}) => {
    await calendar.open({query: "moves&resolver=reject", view: "Week"});
    const source = page.locator('[data-slot="all-day-band"] [data-calendar-event="move-range"]').first();
    await source.focus();
    await page.keyboard.press("Space");
    for (
        let step = 0;
        step < 20 && (await page.locator('[data-drop-target="true"][data-minute]').count()) === 0;
        step++
    ) {
        await page.keyboard.press("ArrowDown");
    }
    await expect(page.locator('[data-drop-target="true"][data-minute]')).toHaveCount(1);
    await expect(page.locator('[data-dnd-dragging="true"]')).toHaveAttribute("data-move-rejected", "true");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert")).toHaveText("Move not allowed");
    await expect(page.locator("main")).toHaveAttribute("data-event-updates", "0");
    await expect(page.locator("main")).toHaveAttribute("data-notifications", "0");
    await expect(page.locator("main")).toHaveAttribute("data-rejections", "1");
    await page.keyboard.press("Tab");
    await expect(page.locator('[data-slot="move-rejection"]')).toHaveCount(0);
});

test("host rejection reason matches preview and completion and clears on the next interaction", async ({
    page,
    calendar,
}) => {
    await calendar.open({query: "moves&resolver=reason", view: "Week"});
    const h = helpers(page, calendar);
    const before = await h.events();
    const result = await h.drag(
        '[data-slot="all-day-band"] [data-calendar-event="move-point"]',
        "Add event October 7, 2026 at 10:00 AM",
    );
    expect(result.rejected).toBe("true");
    expect(result.text).toBe("Room is booked");
    expect(result.after).toBe(0);
    expect(await h.events()).toEqual(before);
    await expect(page.getByRole("alert")).toHaveText("Room is booked");
    await expect(page.locator("main")).toHaveAttribute("data-rejections", "1");
    await expect(page.locator("main")).toHaveAttribute("data-notifications", "0");
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toHaveCount(0);
    await page.getByRole("button", {name: "Today", exact: true}).click();
    await expect(page.locator('[data-slot="move-rejection"]')).toHaveCount(0);
    await expect(page.locator("main")).toHaveAttribute("data-event-updates", "0");
});

test("Mouse: single-day all-day → one hour, preview and one update", async ({page, calendar}) => {
    const h = helpers(page, calendar);
    await h.open();
    const singleTitle = "Single day conversion";
    await page.getByRole("button", {name: "Add event October 6, 2026 all day", exact: true}).click();
    await page.getByRole("textbox", {name: "Title", exact: true}).fill(singleTitle);
    await page.getByRole("button", {name: "Save", exact: true}).click();
    await page.locator("[data-slot=sheet-content]").waitFor({state: "detached"});
    const single = (await h.events()).find((event) => event.title === singleTitle);
    if (!single) {
        throw new Error("Created event missing");
    }
    const first = await h.drag(`[data-calendar-event="${single.id}"]`, "Add event October 6, 2026 at 2:00 PM");
    const converted = await h.item(single.id);
    expect(first.view === "week" && first.text.includes("2pm - 3pm"), "Single-day preview mismatch").toBe(true);
    expect(
        first.geometry.stacked &&
            first.geometry.title === singleTitle &&
            first.geometry.range.includes("2pm - 3pm") &&
            first.geometry.height === 64,
        "Conversion preview must use the timed block with title above range",
    ).toBe(true);
    expect(
        !converted.allDay &&
            h.local(converted.start) === h.local("2026-10-06T14:00:00") &&
            h.local(converted.end) === h.local("2026-10-06T15:00:00"),
        "Single-day conversion",
    ).toBe(true);
    expect(first.after - first.before === 1, "Single-day conversion update count").toBe(true);
});

test("Mouse: midnight conversion retains the range inside the event block", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open();
    const midnight = await h.drag("[data-calendar-event=launch]", "Add event October 6, 2026 at 11:45 PM");
    const midnightEvent = await h.item("launch");
    expect(
        midnight.geometry.stacked && midnight.geometry.height === 48 && midnight.text.includes("11:45pm - 12:45am"),
        "Midnight preview must keep both lines readable",
    ).toBe(true);
    expect(
        h.local(midnightEvent.start) === h.local("2026-10-06T23:45:00") &&
            h.local(midnightEvent.end) === h.local("2026-10-07T00:45:00") &&
            midnight.after === 1,
        "Midnight conversion duration and update count",
    ).toBe(true);
});

test("Mouse: multi-day all-day → configured timed duration → occupied all-day date", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open(90);
    const multi = await h.drag("[data-calendar-event=launch]", "Add event October 6, 2026 at 2:00 PM");
    const launch = await h.item("launch");
    expect(
        multi.view === "week" &&
            multi.geometry.stacked &&
            multi.text.includes("3:30pm") &&
            multi.geometry.height === 96,
        "Configured preview mismatch",
    ).toBe(true);
    expect(
        !launch.allDay && h.local(launch.end) - h.local(launch.start) === 5400000,
        "Multi-day configured conversion",
    ).toBe(true);
    expect(launch.metadata?.source === "demo" && multi.after === 1, "Id, metadata and one update").toBe(true);
    const all = await h.drag("[data-calendar-event=launch]", "Add event October 8, 2026 all day");
    const back = await h.item("launch");
    expect(
        all.view === "month" &&
            all.geometry.height === 24 &&
            back.allDay === true &&
            h.local(back.start) === h.local("2026-10-08T00:00:00") &&
            h.local(back.end) === h.local("2026-10-08T23:59:59.999"),
        "Timed → all-day conversion",
    ).toBe(true);
    expect(all.after - all.before === 1 && back.metadata?.source === "demo", "Conversion update/metadata").toBe(true);
});

test("Mouse: overnight labels/indicators and moving a continued segment as one event", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open();
    await expect(page.locator("[data-calendar-event=overnight]"), "Overnight segments missing").toHaveCount(2);
    const overnight = page.locator("[data-calendar-event=overnight]");
    await expect
        .poll(async () => (await overnight.first().innerText()).includes("10pm - midnight"), {
            message: "Initial segment label",
        })
        .toBe(true);
    await expect(overnight.first().getByLabel("Continues into next day"), "Forward continuation indicator").toHaveCount(
        1,
    );
    await expect(
        overnight.nth(1).getByLabel("Continues from previous day"),
        "Backward continuation indicator",
    ).toHaveCount(1);
    const moved = await h.drag(
        "[data-calendar-event=overnight][data-continuation-before=true]",
        "Add event October 8, 2026 at 9:00 AM",
    );
    const whole = await h.item("overnight");
    expect(
        h.local(whole.start) === h.local("2026-10-08T07:00:00") &&
            h.local(whole.end) === h.local("2026-10-08T11:00:00"),
        "Continued segment moves whole event",
    ).toBe(true);
    expect(
        (await h.events()).filter((event) => event.id === "overnight").length === 1 && moved.after === 1,
        "Whole event identity and count",
    ).toBe(true);
});

test("Mouse: Escape and outside drop cancel without updates", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open();
    const before = await h.item("launch");
    const escaped = await h.drag("[data-calendar-event=launch]", "Add event October 6, 2026 at 2:00 PM", "mouse", true);
    expect(
        escaped.after === 0 && JSON.stringify(await h.item("launch")) === JSON.stringify(before),
        "Escape conversion cancellation",
    ).toBe(true);
    const outside = await h.drag("[data-calendar-event=launch]", "Reset demo");
    expect(
        outside.after === 0 && JSON.stringify(await h.item("launch")) === JSON.stringify(before),
        "Outside-drop cancellation",
    ).toBe(true);
});

test("Touch: long press, quarter-hour conversion and one update", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open();
    const touch = await h.drag("[data-calendar-event=launch]", "Add event October 6, 2026 at 2:15 PM", "touch");
    const touchEvent = await h.item("launch");
    expect(
        touch.after === 1 &&
            !touchEvent.allDay &&
            h.local(touchEvent.start) === h.local("2026-10-06T14:15:00") &&
            h.local(touchEvent.end) - h.local(touchEvent.start) === 3600000,
        "Touch conversion and snapping",
    ).toBe(true);
});

test("Touch: Escape and outside-drop cancellation", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open();
    const touchBefore = await h.item("launch");
    const touchCanceled = await h.drag(
        "[data-calendar-event=launch]",
        "Add event October 6, 2026 at 2:15 PM",
        "touch",
        true,
    );
    expect(
        touchCanceled.after === 0 && JSON.stringify(await h.item("launch")) === JSON.stringify(touchBefore),
        "Touch cancellation",
    ).toBe(true);
    const touchOutside = await h.drag("[data-calendar-event=launch]", "Reset demo", "touch");
    expect(
        touchOutside.after === 0 && JSON.stringify(await h.item("launch")) === JSON.stringify(touchBefore),
        "Touch outside cancellation",
    ).toBe(true);
});

test("Keyboard: Space pickup, Escape cancel, arrows and Enter conversion", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open();
    const source = page.locator("[data-calendar-event=launch]").first();
    await source.focus();
    await page.keyboard.press("Space");
    await page.locator("[data-dnd-dragging=true]").waitFor();
    await page.keyboard.press("Escape");
    await page.locator("[data-dnd-dragging=true]").waitFor({state: "detached"});
    expect((await h.updateCount()) === 0, "Keyboard cancellation emitted update").toBe(true);
    await source.focus();
    await page.keyboard.press("Space");
    await page.locator("[data-dnd-dragging=true]").waitFor();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.locator("[data-dnd-dragging=true]").waitFor({state: "detached"});
    const keyEvent = await h.item("launch");
    expect(
        (await h.updateCount()) === 1 && !keyEvent.allDay && new Date(keyEvent.start).getMinutes() % 15 === 0,
        "Keyboard conversion/snapping/update",
    ).toBe(true);
});
