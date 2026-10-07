import {expect, test} from "./fixtures";
import type {CalendarFixture} from "./fixtures";
import type {Page} from "@playwright/test";

const helpers = (page: Page, calendar: CalendarFixture) => {
    const updates = async () => Number(await page.locator("main").getAttribute("data-event-updates"));
    const events = async () =>
        JSON.parse((await page.locator("main").getAttribute("data-events")) ?? "[]") as Array<{
            id: string;
            start: string;
            end: string;
            metadata: {source: string};
        }>;
    const open = async (fixture = "single", view: "Month" | "Week" | "Day" | "Agenda" = "Week") =>
        calendar.open({query: `resize=${fixture}`, view, scrollTop: view !== "Month" ? 400 : undefined});
    const point = async (day: number, minute: number) => {
        const column = page
            .locator('[data-slot="time-column"]')
            .filter({has: page.getByRole("button", {name: `Add event October ${day}, 2026 at 9:00 AM`, exact: true})});
        return column.evaluate((el, minute) => {
            const rect = el.getBoundingClientRect();
            return {x: rect.x + rect.width / 2, y: rect.y + (minute / 60) * 64};
        }, minute);
    };
    const pickup = async (edge: string) => {
        const handle = page.getByRole("button", {name: `Adjust ${edge} of Team Meeting`}).first();
        await handle.scrollIntoViewIfNeeded();
        const rect = (await handle.boundingBox())!;
        await page.mouse.move(rect.x + rect.width / 2, edge === "start" ? rect.y + 1 : rect.y + rect.height - 1);
        await page.mouse.down();
    };
    const move = async (day: number, minute: number) => {
        const target = await point(day, minute);
        await page.mouse.move(target.x, target.y, {steps: 10});
    };
    const completed = async (startMinute: number, endMinute: number) => {
        await expect(page.getByText(/Resizing /)).toHaveCount(0);
        await expect.poll(() => calendar.updates()).toBe(1);
        const [event] = await events();
        const start = new Date(event.start),
            end = new Date(event.end);
        expect(
            start.getHours() * 60 + start.getMinutes() === startMinute &&
                end.getHours() * 60 + end.getMinutes() === endMinute,
            `Wrong endpoints: ${event.start} – ${event.end}`,
        ).toBe(true);
        expect(
            event.id === "resize:a|b]" && event.metadata.source === "demo",
            "Resize lost consumer identity/metadata",
        ).toBe(true);
        await expect(page.locator('[data-sonner-toast][data-type="success"]')).toHaveCount(1);
        await expect(page.getByRole("dialog"), "Resize opened the editor").toHaveCount(0);
    };

    return {updates, events, open, point, pickup, move, completed};
};

test("Mouse start resize snaps and fixes the end; one metadata-safe update/toast", async ({page, calendar}) => {
    const h = helpers(page, calendar);
    await h.open();
    await h.pickup("start");
    await h.move(5, 555);
    expect(await h.updates(), "Hover mutated controlled events").toBe(0);
    await page.getByRole("button", {name: "Team Meeting, 9:15am - 10:30am", exact: true}).waitFor();
    await page.mouse.up();
    await h.completed(555, 630);
});

test("Mouse end resize grows in place with live range and unchanged start", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open();
    await h.pickup("end");
    await h.move(5, 660);
    await page.mouse.up();
    await h.completed(540, 660);
});

test("Escape, outside release and window resizing cancel without mutation", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    for (const cancel of ["Escape", "outside", "resize"]) {
        await test.step(`${cancel} cancellation`, async () => {
            await h.open();
            await h.pickup("end");
            await h.move(5, 660);
            if (cancel === "Escape") await page.keyboard.press("Escape");
            if (cancel === "outside") await page.mouse.move(5, 5);
            if (cancel === "resize") await page.setViewportSize({width: 1200, height: 900});
            await page.mouse.up();
            await expect(page.getByText(/Resizing /)).toHaveCount(0);
            expect(await h.updates(), `${cancel} committed a resize`).toBe(0);
            expect(new Date((await h.events())[0].end).getMinutes() === 30, "Cancel changed the end").toBe(true);
        });
    }
});

test("Crossing the opposite edge clamps to 15 minutes without swapping endpoints", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open();
    await h.pickup("start");
    await h.move(5, 720);
    await page.mouse.up();
    await h.completed(615, 630);
});

test("Keyboard Space/arrows/Enter and Escape resize endpoints without editing", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open();
    const endHandle = page.getByRole("button", {name: "Adjust end of Team Meeting"});
    await endHandle.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await expect(page.getByText(/Resizing /)).toHaveCount(1);
    expect(await h.updates(), "Keyboard preview committed early").toBe(0);
    await page.keyboard.press("Escape");
    await expect(page.getByText(/Resizing /)).toHaveCount(0);
    expect(await h.updates(), "Keyboard Escape committed").toBe(0);
    await endHandle.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await h.completed(540, 645);
});

test("Pointer cancellation discards the live candidate", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open();
    await h.pickup("end");
    await h.move(5, 660);
    await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointercancel", {pointerId: 1})));
    await page.mouse.up();
    await expect(page.getByText(/Resizing /)).toHaveCount(0);
    expect(await h.updates(), "Pointer cancellation committed a resize").toBe(0);
});

test("Touch grip long-press resizing keeps the start fixed and commits once", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setTouchEmulationEnabled", {enabled: true});
    const touchHandle = page.getByRole("button", {name: "Adjust end of Team Meeting"});
    await touchHandle.scrollIntoViewIfNeeded();
    const touchRect = (await touchHandle.boundingBox())!;
    const from = {x: touchRect.x + touchRect.width / 2, y: touchRect.y + touchRect.height - 1};
    const to = await h.point(5, 660);
    await cdp.send("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [{...from, id: 1}]});
    // long-press hold: touch activation needs >250ms (calendar-sensors.ts)
    await page.waitForTimeout(300);
    for (let step = 1; step <= 8; step++) {
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{x: from.x + ((to.x - from.x) * step) / 8, y: from.y + ((to.y - from.y) * step) / 8, id: 1}],
        });
    }
    await cdp.send("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
    await h.completed(540, 660);
    await cdp.send("Emulation.setTouchEmulationEnabled", {enabled: false});
    await cdp.detach();
});

test("Endpoint resizing auto-scrolls the contained calendar viewport and cancels cleanly", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open();
    await h.pickup("end");
    const viewport = page.locator('[data-slot="calendar-scroll"]');
    const beforeScroll = await viewport.evaluate((el) => el.scrollTop);
    const scrollRect = (await viewport.boundingBox())!;
    const x = (await h.point(5, 660)).x;
    await page.mouse.move(x, scrollRect.y + scrollRect.height - 12, {steps: 10});
    await page.waitForFunction(
        (before) => document.querySelector('[data-slot="calendar-scroll"]')!.scrollTop > before + 32,
        beforeScroll,
    );
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(page.getByText(/Resizing /)).toHaveCount(0);
    expect(
        (await h.updates()) === 0 && (await page.evaluate(() => scrollY)) === 0,
        "Resize auto-scroll changed events or scrolled the host page",
    ).toBe(true);
});

test("Overnight handles only at true endpoints; Week resizing extends across dates", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open("overnight");
    await expect(
        page.getByRole("button", {name: "Adjust start of Team Meeting"}),
        "Midnight start endpoint",
    ).toHaveCount(1);
    await expect(
        page.getByRole("button", {name: "Adjust end of Team Meeting"}),
        "Midnight continuation exposes a fake endpoint",
    ).toHaveCount(1);
    await page.locator('[data-slot="calendar-scroll"]').evaluate((el) => {
        el.scrollTop = 0;
    });
    await h.pickup("end");
    await h.move(7, 180);
    await page.mouse.up();
    await h.completed(1320, 180);
    expect(new Date((await h.events())[0].end).getDate() === 7, "Resize did not extend into the adjacent date").toBe(
        true,
    );
});

test("Month horizontal endpoint resizing preserves endpoint clock time", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open("single", "Month");
    const right = page.getByRole("button", {name: "Adjust end of Team Meeting"});
    const rect = (await right.boundingBox())!;
    const target = page
        .locator('[data-slot="calendar-drop"][data-date]')
        .filter({has: page.getByRole("button", {name: "Add event October 6, 2026 at 9:00 AM", exact: true})});
    const targetRect = (await target.boundingBox())!;
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetRect.x + targetRect.width / 2, targetRect.y + 70, {steps: 10});
    await page.mouse.up();
    await h.completed(540, 630);
    expect(new Date((await h.events())[0].end).getDate() === 6, "Month resize did not adjust the date").toBe(true);
});

test("All-day horizontal handles keep inclusive dates and one controlled update", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open("all-day");
    const allDayEnd = page.getByRole("button", {name: "Adjust end of All-day workshop"});
    await allDayEnd.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    const allDay = (await h.events())[0];
    expect(
        (await h.updates()) === 1 && new Date(allDay.end).getDate() === 7 && new Date(allDay.end).getHours() === 23,
        "All-day inclusive end resize failed",
    ).toBe(true);
});

test("All-day label stays at the bottom through crowded-band scrolling", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open("crowded");
    const band = page.locator('[data-slot="all-day-band"]');
    for (const scrollTop of [0, 80, 9999]) {
        await band.evaluate((el, top) => {
            el.scrollTop = top;
        }, scrollTop);
        const a = (await band.boundingBox())!,
            b = (await page.locator('[data-slot="all-day-label"]').boundingBox())!;
        expect(
            b.y >= a.y && b.y + b.height <= a.y + a.height + 1 && Math.abs(b.y + b.height - a.y - a.height) < 3,
            "All-day label must stay at the visible band bottom",
        ).toBe(true);
    }
});

test("Short cards retain an unobstructed edit/move surface", async ({page, calendar}) => {
    const h = helpers(page, calendar);

    await h.open("short");
    await expect(page.getByRole("button", {name: /Adjust/}), "Short cards should use editor resizing").toHaveCount(0);
});

test("Read-only mode suppresses endpoint controls", async ({page, calendar}) => {
    await calendar.open({query: "resize=single&readOnly", view: "Week"});
    await expect(page.getByRole("button", {name: /Adjust/}), "Read-only calendar exposes resize controls").toHaveCount(
        0,
    );
});

test("Two visible lanes share a floating column-wide pill with accurate membership", async ({page, calendar}) => {
    await calendar.open({query: "overlaps=column", width: 1920, view: "Week", scrollTop: 500});
    const pill = page.getByRole("button", {name: /\+1 more events/});
    await pill.waitFor();
    const columnBounds = await pill.locator('xpath=ancestor::*[@data-slot="time-column"]').boundingBox();
    const pillBounds = (await pill.boundingBox())!;
    expect(
        Boolean(columnBounds && Math.abs(pillBounds.width - (columnBounds.width - 16)) < 2),
        "Pill must span both lanes with side gutters",
    ).toBe(true);
    await pill.click();
    await expect(
        page.locator('[data-slot="time-overflow-events"] [data-calendar-event]'),
        "Full-column pill membership changed",
    ).toHaveCount(3);
});
