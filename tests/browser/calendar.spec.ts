import {expect, test} from "./fixtures";
import type {CalendarFixture} from "./fixtures";
import type {Page} from "@playwright/test";

const helpers = (page: Page, _calendar: CalendarFixture) => {
    const view = async (name: string) => {
        await page.locator("[aria-haspopup=menu]").click();
        await page.getByRole("menuitem", {name: new RegExp(`^${name}`)}).click();
    };
    const drag = async (sourceSelector: string, targetName: string, cancel = false, previewTime = "") => {
        await page.locator("[data-slot=sheet-content]").waitFor({state: "detached"});
        const source = await page.locator(sourceSelector).first().boundingBox();
        const target = await page.getByRole("button", {name: targetName, exact: true}).boundingBox();
        if (!source || !target) {
            throw new Error("Drag source or destination is missing");
        }
        await page.mouse.move(source.x + 12, source.y + 8);
        await page.mouse.down();
        await page.mouse.move(source.x + 24, source.y + 8, {steps: 4});
        await page.mouse.move(target.x + target.width / 2, target.y + Math.min(55, target.height / 2), {steps: 12});
        if (previewTime) {
            await page.getByRole("button", {name: new RegExp(previewTime)}).waitFor();
            const preview = page.locator("[data-dnd-dragging=true]");
            await expect
                .poll(async () => (await preview.innerText()).includes(previewTime), {
                    message: "Drag preview time updates before drop",
                })
                .toBe(true);
            const stacked = await preview.evaluate((element) => {
                const lines = [...element.querySelectorAll(":scope > div")];
                return (
                    lines.length === 2 &&
                    lines[1].getBoundingClientRect().top >= lines[0].getBoundingClientRect().bottom
                );
            });

            expect(stacked, "Timed drag title must be above the range").toBe(true);
            await expect(page.locator("[data-slot=drag-preview]"), "Redundant drag popup returned").toHaveCount(0);
        }
        if (cancel) {
            await page.keyboard.press("Escape");
        }
        await page.mouse.up();
        await expect(page.locator('[data-dnd-dragging="true"]')).toHaveCount(0);
        await page.locator("[data-dnd-placeholder]").waitFor({state: "detached"});
    };

    return {view, drag};
};

const createCliEvent = async (page: Page) => {
    await page.getByRole("button", {name: "Add event October 6, 2026 at 9:00 AM"}).click();
    const editor = page.getByRole("dialog", {name: "Create Event"});
    await editor.getByRole("textbox", {name: "Title", exact: true}).fill("CLI event");
    await editor.getByRole("textbox", {name: "Description"}).fill("Calendar acceptance");
    await editor.getByRole("textbox", {name: "Location"}).fill("Office");
    await editor.getByRole("radio", {name: "Rose"}).click();
    await editor.getByRole("button", {name: "Save", exact: true}).click();
    await page.getByRole("button", {name: "CLI event, 9am - 10am"}).waitFor();
};

test("Empty month space creates a persisted demo event with fields/color", async ({page, calendar}) => {
    await calendar.open();
    await page.getByRole("heading", {name: "October 2026"}).waitFor();
    await page.getByRole("button", {name: "Add event October 6, 2026 at 9:00 AM"}).click();
    const editor = page.getByRole("dialog", {name: "Create Event"});
    await expect
        .poll(async () => (await editor.innerText()).includes("October 6th, 2026"), {message: "Empty month cell date"})
        .toBe(true);
    await expect
        .poll(async () => (await editor.getByRole("combobox", {name: "Start Time"}).innerText()).includes("9:00 AM"), {
            message: "Default start time",
        })
        .toBe(true);
    await editor.getByRole("textbox", {name: "Title", exact: true}).fill("CLI event");
    await editor.getByRole("textbox", {name: "Description"}).fill("Calendar acceptance");
    await editor.getByRole("textbox", {name: "Location"}).fill("Office");
    await editor.getByRole("radio", {name: "Rose"}).click();
    await editor.getByRole("button", {name: "Save", exact: true}).click();
    await page.getByRole("button", {name: "CLI event, 9am - 10am"}).waitFor();
});

test("Edit and immediate delete update consumer-owned data", async ({page, calendar}) => {
    await calendar.open();
    await createCliEvent(page);

    await page.getByRole("button", {name: "CLI event, 9am - 10am"}).click();
    await expect(page.getByRole("textbox", {name: "Location"}), "Location saved").toHaveValue("Office");
    await page.getByRole("textbox", {name: "Title", exact: true}).fill("CLI edited");
    await page.getByRole("button", {name: "Save", exact: true}).click();
    await page.getByRole("button", {name: "CLI edited, 9am - 10am"}).click();
    await page.getByRole("button", {name: "Delete event"}).click();
    await expect(page.getByRole("button", {name: /CLI edited/}), "Delete removed event").toHaveCount(0);
});

test("Validation, blank title fallback and inclusive all-day save", async ({page, calendar}) => {
    await calendar.open();

    await page.getByRole("button", {name: "New event", exact: true}).click();
    await page.getByRole("combobox", {name: "End Time"}).click();
    await page.getByRole("option", {name: "8:00 AM", exact: true}).click();
    await page.getByRole("button", {name: "Save", exact: true}).click();
    await page.getByText("End date cannot be before start date").waitFor();
    await page.getByRole("checkbox", {name: "All day"}).click();
    await expect(page.getByRole("combobox", {name: "Start Time"}), "All-day hides times").toHaveCount(0);
    await page.getByRole("button", {name: "Save", exact: true}).click();
    await page.getByRole("button", {name: "(no title), All day"}).waitFor();
});

test("Date popovers constrain end date and synchronize start/end", async ({page, calendar}) => {
    await calendar.open();

    await page.getByRole("button", {name: "New event", exact: true}).click();
    await page.getByRole("button", {name: "Start Date", exact: true}).click();
    const picker = page.locator("[data-slot=popover-content][data-open]");
    await picker.getByRole("button", {name: /October 12th, 2026/}).click();
    await expect
        .poll(
            async () =>
                (await page.getByRole("button", {name: "End Date", exact: true}).innerText()).includes("October 12th"),
            {message: "Advancing start advances end"},
        )
        .toBe(true);
    await page.getByRole("button", {name: "End Date", exact: true}).click();
    await expect(picker.getByRole("button", {name: /October 11th, 2026/}), "Earlier end date disabled").toBeDisabled();
    await page.keyboard.press("Escape");
    await page.getByRole("button", {name: "Cancel", exact: true}).click();
});

test("Month overflow popover lists all five events and opens editor", async ({page, calendar}) => {
    await calendar.open();

    await page.getByRole("button", {name: "Reset demo"}).click();
    await page.getByRole("button", {name: /\+ \d+ more/}).click();
    await expect(
        page.locator("[data-slot=popover-content] [data-calendar-event]"),
        "Overflow lists every event",
    ).toHaveCount(5);
    await page.locator("[data-slot=popover-content] [data-calendar-event=review]").click();
    await page.getByRole("dialog", {name: "Edit Event"}).waitFor();
    await page.getByRole("button", {name: "Cancel", exact: true}).click();
    await page.keyboard.press("Escape");
});

test("Actual pointer month drag preserves time/duration and Escape cancels", async ({page, calendar}) => {
    const h = helpers(page, calendar);
    await calendar.open();

    await h.drag("[data-calendar-event=team]", "Add event October 6, 2026 at 9:00 AM");
    await page.locator("[data-calendar-event=team]").click();
    await expect
        .poll(
            async () =>
                (await page.getByRole("button", {name: "Start Date", exact: true}).innerText()).includes("October 6th"),
            {message: "Month drag date"},
        )
        .toBe(true);
    await expect
        .poll(async () => (await page.getByRole("combobox", {name: "Start Time"}).innerText()).includes("10:00 AM"), {
            message: "Month drag preserves time",
        })
        .toBe(true);
    await expect
        .poll(async () => (await page.getByRole("combobox", {name: "End Time"}).innerText()).includes("11:00 AM"), {
            message: "Month drag preserves duration",
        })
        .toBe(true);
    await page.getByRole("button", {name: "Cancel", exact: true}).click();
    await h.drag("[data-calendar-event=team]", "Add event October 7, 2026 at 9:00 AM", true);
    await page.locator("[data-calendar-event=team]").click();
    expect(
        (await page.getByRole("button", {name: "Start Date", exact: true}).innerText()).includes("October 6th"),
        "Escape cancels drag",
    ).toBe(true);
    await page.getByRole("button", {name: "Cancel", exact: true}).click();
});

test("Outside drop cancels; continued segments move relative to their grabbed date", async ({page, calendar}) => {
    const h = helpers(page, calendar);
    await calendar.open();
    await h.drag("[data-calendar-event=team]", "Add event October 6, 2026 at 9:00 AM");

    await h.drag("[data-calendar-event=team]", "Reset demo");
    await page.locator("[data-calendar-event=team]").click();
    expect(
        (await page.getByRole("button", {name: "Start Date", exact: true}).innerText()).includes("October 6th"),
        "Outside drop cancels",
    ).toBe(true);
    await page.getByRole("button", {name: "Cancel", exact: true}).click();
    await h.drag('[data-calendar-event=launch][aria-label$="continued"]', "Add event October 10, 2026 at 9:00 AM");
    await page.locator("[data-calendar-event=launch]").first().click();
    await expect
        .poll(
            async () =>
                (await page.getByRole("button", {name: "Start Date", exact: true}).innerText()).includes("October 9th"),
            {message: "Continued segment relative move"},
        )
        .toBe(true);
    await expect
        .poll(
            async () =>
                (await page.getByRole("button", {name: "End Date", exact: true}).innerText()).includes("October 12th"),
            {message: "Continued move preserves all-day span"},
        )
        .toBe(true);
    await page.getByRole("button", {name: "Cancel", exact: true}).click();
});

test("Live quarter-hour preview, actual timed drag and empty-slot creation", async ({page, calendar}) => {
    const h = helpers(page, calendar);
    await calendar.open();

    await page.getByRole("button", {name: "Reset demo"}).click();
    await h.view("Week");
    const scroll = page.locator("[data-slot=calendar-scroll]");
    await scroll.evaluate((el) => {
        el.scrollTop = 500;
    });
    await h.drag("[data-calendar-event=team]", "Add event October 5, 2026 at 11:15 AM", false, "11:15am - 12:15pm");
    await page.locator("[data-calendar-event=team]").click();
    await expect
        .poll(async () => (await page.getByRole("combobox", {name: "Start Time"}).innerText()).includes("11:15 AM"), {
            message: "Timed drop snaps to quarter-hour",
        })
        .toBe(true);
    await expect
        .poll(async () => (await page.getByRole("combobox", {name: "End Time"}).innerText()).includes("12:15 PM"), {
            message: "Timed drop duration",
        })
        .toBe(true);
    await page.getByRole("button", {name: "Cancel", exact: true}).click();
    await page.getByRole("button", {name: "Add event October 6, 2026 at 9:45 AM"}).click();
    await expect
        .poll(async () => (await page.getByRole("combobox", {name: "Start Time"}).innerText()).includes("9:45 AM"), {
            message: "Timed empty space start",
        })
        .toBe(true);
    await page.getByRole("button", {name: "Cancel", exact: true}).click();
});

test("All-day empty-band creation defaults to all day", async ({page, calendar}) => {
    const h = helpers(page, calendar);
    await calendar.open();
    await h.view("Week");

    await page.getByRole("button", {name: "Add event October 6, 2026 all day", exact: true}).click();
    await expect(page.getByRole("checkbox", {name: "All day"}), "All-day band creation").toBeChecked();
    await page.getByRole("button", {name: "Cancel", exact: true}).click();
});

test("Four views, 30-day agenda, empty range, Today and keyboard shortcuts", async ({page, calendar}) => {
    const h = helpers(page, calendar);
    await calendar.open();

    await h.view("Week");
    await h.view("Day");
    await expect(page.locator("[data-slot=day-view]"), "Day view").toHaveCount(1);
    await h.view("Agenda");
    await expect
        .poll(() => page.getByRole("heading", {level: 2}).innerText(), {message: "Agenda selected-month heading"})
        .toBe("October 2026");
    await expect
        .poll(
            async () => (await page.locator("[data-slot=calendar-scroll]").innerText()).includes("Conference Room A"),
            {message: "Agenda location"},
        )
        .toBe(true);
    await page.getByRole("button", {name: "Next", exact: true}).click();
    await page.getByText("No events found").waitFor();
    await page.getByRole("button", {name: "Today", exact: true}).click();
    await page.locator(".event-calendar").focus();
    await page.keyboard.press("m");
    await page.locator("[data-slot=month-view]").waitFor();
});

test("All views contained at desktop/tablet/mobile/320px, reachable editor footer and dark mode", async ({
    page,
    calendar,
}) => {
    const h = helpers(page, calendar);
    await calendar.open();

    for (const size of [
        {width: 1280, height: 900},
        {width: 768, height: 600},
        {width: 390, height: 844},
        {width: 320, height: 568},
    ]) {
        await page.setViewportSize(size);
        for (const name of ["Month", "Week", "Day", "Agenda"]) {
            await h.view(name);
            const bounds = await page.locator(".event-calendar").boundingBox();
            const overflow = await page.evaluate(() => ({
                width: document.documentElement.scrollWidth > innerWidth,
                height: document.documentElement.scrollHeight > innerHeight,
            }));

            expect(!overflow.width && !overflow.height, `${name} page overflow at ${size.width}`).toBe(true);
            expect(
                Boolean(
                    bounds &&
                    bounds.x >= 0 &&
                    bounds.x + bounds.width <= size.width &&
                    bounds.y + bounds.height <= size.height,
                ),
                `${name} calendar outside viewport`,
            ).toBe(true);
        }
    }
    await page.getByRole("button", {name: "New event", exact: true}).click();
    await expect(page.getByRole("button", {name: "Save", exact: true}), "Short-screen footer reachable").toBeVisible();
    await page.getByRole("button", {name: "Cancel", exact: true}).click();
    await page.getByRole("button", {name: "Toggle theme"}).click();
    await expect
        .poll(async () => await page.locator("html").evaluate((el) => el.classList.contains("dark")), {
            message: "Dark mode",
        })
        .toBe(true);
});

test("No browser runtime or console errors", async ({calendar, page, pageErrors}) => {
    await calendar.open();
    await expect(page.getByRole("heading", {name: "October 2026"})).toBeVisible();
    expect(pageErrors).toEqual([]);
});
