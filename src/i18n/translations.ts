// T1: a local selector type, with no global i18next augmentation in shipped declarations.
// A plural suffix is normalized to its base key for typed count lookups.
import {useTranslation} from "react-i18next";

import type enCalendar from "./locales/en/calendar.json";
import {dateLocaleFor} from "./date-locale";

type PluralSuffix = "one" | "other" | "many";
type SelectorShape<T> = {
    [
        K in keyof T as K extends string ? (K extends `${infer Base}_${PluralSuffix}` ? Base : K) : never
    ]: T[K] extends object ? SelectorShape<T[K]> : T[K];
};

type CalendarSelector = (
    selector: ($: SelectorShape<typeof enCalendar>) => string,
    options?: Record<string, unknown>,
) => string;

const calendarHookOptions = {
    bindI18n: "languageChanged",
    bindI18nStore: "",
    useSuspense: false,
    keyPrefix: "",
} as const;

const useCalendarTranslation = () => {
    const {i18n, t} = useTranslation("calendar", calendarHookOptions);
    const tCalendar = t as unknown as CalendarSelector;
    return {tCalendar, dateLocale: dateLocaleFor(i18n.language)};
};

export {useCalendarTranslation};
export type {CalendarSelector};
