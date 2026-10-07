import {chromium} from "@playwright/test";
import {preview} from "vite";
import {mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";

export async function captureScreenshots(browser) {
    const context = await browser.newContext({viewport: {width: 1280, height: 900}});
    const page = await context.newPage();
    const directory = "docs/event-calendar/screenshots";
    await mkdir(directory, {recursive: true});
    const settle = async () => {
        await page.evaluate(async () => {
            await document.fonts.ready;
            await Promise.all(document.getAnimations().map((animation) => animation.finished));
        });
    };
    const choose = async (view) => {
        await page.locator('[aria-haspopup="menu"]').click();
        await page.getByRole("menuitem", {name: new RegExp(`^${view}`)}).click();
        await page.getByRole("menu").waitFor({state: "detached"});
        if (view === "Week" || view === "Day") {
            await page.locator('[data-slot="calendar-scroll"]').evaluate((element) => {
                element.scrollTop = 500;
            });
        }
        await settle();
    };
    try {
        await page.goto("http://127.0.0.1:4173/calendar-demo.html?date=2026-10-04");
        for (const view of ["Month", "Week", "Day", "Agenda"]) {
            if (view !== "Month") await choose(view);
            await settle();
            await page.screenshot({path: `${directory}/${view.toLowerCase()}.png`});
        }
        await page.goto("http://127.0.0.1:4173/calendar-demo.html?date=2026-10-04&overlaps=contracts");
        await choose("Week");
        await page.screenshot({path: `${directory}/contracts-overflow.png`});
        await page.getByRole("button", {name: /^\+1 more events/}).click();
        await page.locator('[data-slot="popover-content"][data-open]').waitFor();
        await settle();
        await page.screenshot({path: `${directory}/contracts-popover.png`});
        await page.keyboard.press("Escape");
        await page.setViewportSize({width: 390, height: 844});
        await choose("Month");
        await settle();
        await page.screenshot({path: `${directory}/mobile.png`});
        await page.getByRole("button", {name: "Toggle theme"}).click();
        await page.waitForFunction(
            () => document.querySelector(".event-calendar")?.getAttribute("data-event-calendar-theme") === "dark",
        );
        await settle();
        await page.screenshot({path: `${directory}/dark-mobile.png`});

        await page.setViewportSize({width: 1280, height: 900});
        await page.goto("http://127.0.0.1:4173/calendar-demo.html?date=2026-10-04");
        await page.getByRole("button", {name: "New event"}).click();
        await page.getByRole("heading", {name: "Create Event"}).waitFor();
        await settle();
        await page.screenshot({path: `${directory}/editor-create.png`});
        await page.getByRole("button", {name: /Start Date/}).click();
        await page.locator('[data-slot="popover-content"][data-open]').waitFor();
        await settle();
        await page.screenshot({path: `${directory}/date-picker.png`});
        await page.keyboard.press("Escape");
        await page.locator('[data-slot="popover-content"][data-open]').waitFor({state: "detached"});
        await page.getByRole("combobox", {name: "Start Time"}).click();
        await page.locator('[data-slot="select-content"][data-open]').waitFor();
        await settle();
        await page.screenshot({path: `${directory}/time-select.png`});
        await page.keyboard.press("Escape");
        await page.locator('[data-slot="select-content"][data-open]').waitFor({state: "detached"});
        await page.getByRole("button", {name: "Cancel", exact: true}).click();
        await page.locator('[data-slot="sheet-content"]').waitFor({state: "detached"});

        await page.setViewportSize({width: 1280, height: 900});
        await page.goto("http://127.0.0.1:4173/calendar-demo.html?date=2026-10-04");
        await page.getByRole("button", {name: "Month"}).click();
        await page.getByRole("menu").waitFor({state: "visible"});
        await settle();
        await page.screenshot({path: `${directory}/view-menu.png`});
        console.log("Captured twelve current production screenshots.");
    } finally {
        await context.close();
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const server = await preview({preview: {host: "127.0.0.1", port: 4173, strictPort: true}});
    const browser = await chromium.launch({headless: true});
    try {
        await captureScreenshots(browser);
    } finally {
        await browser.close();
        server.httpServer.closeAllConnections();
        await new Promise((resolve) => server.httpServer.close(resolve));
    }
}
