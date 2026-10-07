import {defineConfig, devices} from "@playwright/test";

export default defineConfig({
    testDir: "tests/browser",
    outputDir: "artifacts/playwright-results",
    fullyParallel: false,
    workers: process.env.CI ? 1 : 2,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    reporter: [["list"], ["html", {open: "never", outputFolder: "artifacts/playwright-report"}]],
    use: {
        baseURL: "http://127.0.0.1:4173",
        viewport: {width: 1280, height: 900},
        hasTouch: true,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        actionTimeout: 15000,
    },
    projects: [
        {name: "chromium", use: {...devices["Desktop Chrome"], viewport: {width: 1280, height: 900}, hasTouch: true}},
    ],
    webServer: {
        command: "pnpm demo:preview",
        url: "http://127.0.0.1:4173/calendar-demo.html",
        reuseExistingServer: !process.env.CI,
    },
});
