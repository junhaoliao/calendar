import {expect} from "./fixtures";
import type {Locator, Page} from "@playwright/test";

export const mousePickup = async (page: Page, source: Locator, offsetX = 12) => {
    const rect = await source.boundingBox();
    if (!rect) throw new Error("Drag source missing");
    await page.mouse.move(rect.x + offsetX, rect.y + 8);
    await page.mouse.down();
    await page.mouse.move(rect.x + offsetX + 12, rect.y + 8, {steps: 4});
    await expect(page.locator('[data-dnd-dragging="true"]').first()).toBeVisible();
};

export const mouseMoveTo = async (page: Page, destination: Locator) => {
    const rect = await destination.boundingBox();
    if (!rect) throw new Error("Drop target missing");
    await page.mouse.move(rect.x + rect.width / 2, rect.y + 8, {steps: 12});
};
