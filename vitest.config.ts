import {defineConfig} from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    test: {
        // Bound concurrent jsdom windows so interaction tests stay responsive.
        maxWorkers: 4,
        environment: "jsdom",
        setupFiles: ["src/test/setup.ts"],
        include: ["src/**/*.test.{ts,tsx}"],
        restoreMocks: true,
        globals: true,
    },
});
