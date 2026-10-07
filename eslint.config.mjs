import js from "@eslint/js";
import {defineConfig} from "eslint/config";
import prettier from "eslint-config-prettier";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
    {ignores: ["node_modules/**", "dist/**", ".tmp/**", "artifacts/**", "coverage/**", "test-results/**"]},
    js.configs.recommended,
    tseslint.configs.recommended,
    {
        files: ["**/*.{ts,tsx,mjs,cts}"],
        plugins: {"react-hooks": hooks},
        rules: {
            ...hooks.configs.recommended.rules,
            "@typescript-eslint/no-unused-vars": ["error", {argsIgnorePattern: "^_", varsIgnorePattern: "^_"}],
            "@typescript-eslint/consistent-type-imports": ["error", {fixStyle: "inline-type-imports"}],
            yoda: ["error", "never"],
        },
    },
    {
        files: ["src/**/*.{ts,tsx}", "demo/**/*.{ts,tsx}", "examples/**/*.tsx"],
        ...react.configs.flat.recommended,
        ...react.configs.flat["jsx-runtime"],
        languageOptions: {globals: globals.browser},
        settings: {react: {version: "detect"}},
        rules: {
            ...react.configs.flat.recommended.rules,
            ...react.configs.flat["jsx-runtime"].rules,
            "react/prop-types": "off",
            "react/jsx-curly-brace-presence": ["error", {props: "never", children: "never"}],
        },
    },
    {files: ["src/**/*.{ts,tsx}", "demo/**/*.{ts,tsx}", "examples/**/*.tsx"], ...jsxA11y.flatConfigs.recommended},
    {
        files: ["src/**/*.test.{ts,tsx}", "src/test/**"],
        languageOptions: {globals: {...globals.browser, ...globals.node}},
    },
    {files: ["scripts/**", "*.config.{ts,mjs}", "examples/**/*.{mjs,cts}"], languageOptions: {globals: globals.node}},
    {
        files: [
            "scripts/*-browser-checks.ts",
            "scripts/capture-screenshots.mjs",
            "scripts/package-smoke.mjs",
            "tests/browser/**/*.{ts,tsx}",
        ],
        languageOptions: {globals: {...globals.node, ...globals.browser}},
    },
    // The shared native label forwards htmlFor/children; each caller supplies its control association.
    {files: ["src/components/ui/label.tsx"], rules: {"jsx-a11y/label-has-associated-control": "off"}},
    // The labelled region retains programmatic focus and scoped shortcuts; its nested buttons own interactions.
    {
        files: ["src/components/event-calendar/calendar-surface.tsx"],
        rules: {"jsx-a11y/no-noninteractive-element-interactions": "off"},
    },
    prettier,
);
