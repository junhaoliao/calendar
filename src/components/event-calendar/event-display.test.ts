import {describe, expect, it} from "vitest";
import type {CalendarSelector} from "../../i18n/translations";

import {displayTitle} from "./event-display";

const t = (() => "Untitled") as unknown as CalendarSelector;

describe("displayed event titles", () => {
    it("keeps an ordinary title", () => {
        expect(displayTitle("Meeting", t)).toBe("Meeting");
    });
    it("localizes an empty title", () => {
        expect(displayTitle("", t)).toBe("Untitled");
    });
    it("localizes a whitespace title", () => {
        expect(displayTitle("  ", t)).toBe("Untitled");
    });
    it("localizes the saved untitled placeholder", () => {
        expect(displayTitle("(no title)", t)).toBe("Untitled");
    });
});
