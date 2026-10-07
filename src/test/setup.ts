import {afterEach} from "vitest";
import {cleanup} from "@testing-library/react";
import {installMatchMediaMock, resetMatchMediaMock} from "./match-media";
import "@testing-library/jest-dom/vitest";

installMatchMediaMock();
afterEach(() => {
    cleanup();
    resetMatchMediaMock();
});
globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
};
