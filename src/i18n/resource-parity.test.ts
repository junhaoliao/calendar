import {format} from "date-fns";
import {describe, expect, it} from "vitest";

import {createCalendarI18n} from "./index";
import {dateLocaleFor} from "./date-locale";
import {resources} from "./resources";
import type {CalendarLocale} from "./locales";

const kind = (value: unknown) =>
    typeof value === "string"
        ? "string"
        : value !== null && typeof value === "object" && !Array.isArray(value)
          ? "object"
          : "other";
const interpolationNames = (value: string) =>
    [...value.matchAll(/\{\{\s*-?\s*([A-Za-z_$][\w$]*)\s*(?:,[^}]*)?\}\}/gu)].map((match) => match[1]).sort();

/** Runtime exactness complements required-key TypeScript shape checks. */
const assertResourceParity = (reference: unknown, candidate: unknown, locale: string, path = "calendar") => {
    const expectedKind = kind(reference);
    if (kind(candidate) !== expectedKind) throw new Error(`${locale}:${path} node kind differs`);
    if (expectedKind === "string") {
        const expected = interpolationNames(reference as string);
        const actual = interpolationNames(candidate as string);
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`${locale}:${path} interpolation differs: ${actual.join(",")} vs ${expected.join(",")}`);
        }
        return;
    }
    if (expectedKind !== "object") throw new Error(`${locale}:${path} has unsupported node kind`);
    const expectedKeys = Object.keys(reference as Record<string, unknown>).sort();
    const actualKeys = Object.keys(candidate as Record<string, unknown>).sort();
    if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
        throw new Error(`${locale}:${path} keys differ: ${actualKeys.join(",")} vs ${expectedKeys.join(",")}`);
    }
    for (const key of expectedKeys) {
        assertResourceParity(
            (reference as Record<string, unknown>)[key],
            (candidate as Record<string, unknown>)[key],
            locale,
            `${path}.${key}`,
        );
    }
};

describe("calendar resource contract", () => {
    it("detects missing and extra nested keys, node kinds and named interpolation drift", () => {
        const reference = {nested: {label: "Hello {{name}}", count: "{{count}}"}};
        expect(() => assertResourceParity(reference, {nested: {count: "{{count}}"}}, "fr")).toThrow(
            /fr:calendar.nested keys differ/u,
        );
        expect(() => assertResourceParity(reference, {nested: {...reference.nested, extra: "x"}}, "fr")).toThrow(
            /fr:calendar.nested keys differ/u,
        );
        expect(() => assertResourceParity(reference, {nested: {label: {}, count: "{{count}}"}}, "fr")).toThrow(
            /fr:calendar.nested.label node kind differs/u,
        );
        expect(() =>
            assertResourceParity(reference, {nested: {label: "Hello {{other}}", count: "{{count}}"}}, "fr"),
        ).toThrow(/fr:calendar.nested.label interpolation differs/u);
        expect(interpolationNames("{{ name }} and {{- count}}")).toEqual(["count", "name"]);
    });

    it("keeps every shipped locale's nested keys, node kinds and interpolation variables exact", () => {
        for (const locale of ["fr", "zh-Hans", "zh-Hant"] as const) {
            expect(() => assertResourceParity(resources.en.calendar, resources[locale].calendar, locale)).not.toThrow();
        }
    });

    it("resolves real plural categories at 0, 1, 2 and one million in all four locales", () => {
        for (const locale of ["en", "fr", "zh-Hans", "zh-Hant"] as const) {
            const instance = createCalendarI18n(locale);
            expect(instance.isInitialized).toBe(true);
            expect(instance.language).toBe(locale);
            const select = instance.t as unknown as (
                key: ($: {month: {more: string}}) => string,
                options: {count: number},
            ) => string;
            const forms = resources[locale].calendar.month as Record<string, string>;
            const plural = new Intl.PluralRules(locale);
            for (const count of [0, 1, 2, 1000000]) {
                const expected = forms[`more_${plural.select(count)}`].replace("{{count}}", String(count));
                expect(select(($) => $.month.more, {count})).toBe(expected);
            }
        }
    });

    it("formats every localized heading pattern without throwing", () => {
        const date = new Date(2026, 9, 4);
        for (const locale of ["en", "fr", "zh-Hans", "zh-Hant"] as const satisfies readonly CalendarLocale[]) {
            const dateLocale = dateLocaleFor(locale);
            for (const pattern of Object.values(resources[locale].calendar.formats)) {
                expect(() => format(date, pattern, {locale: dateLocale})).not.toThrow();
            }
        }
        expect(format(date, resources["zh-Hans"].calendar.formats.monthYear, {locale: dateLocaleFor("zh-Hans")})).toBe(
            "2026年10月",
        );
    });
});
