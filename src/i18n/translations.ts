// T1: a local selector type, with no global i18next augmentation in shipped declarations.
// A plural suffix is normalized to its base key for typed count lookups.
import {createContext, useContext} from "react";
import type {Locale} from "date-fns";

import type enCalendar from "./locales/en/calendar.json";

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

/** Accessible label for an empty slot, cached per calendar language. */
type SlotLabeler = (start: Date, allDay?: boolean) => string;

interface CalendarTranslation {
    tCalendar: CalendarSelector;
    dateLocale: Locale;
    slotLabel: SlotLabeler;
}

const CalendarTranslationContext = createContext<CalendarTranslation | null>(null);

/**
 * Reads the calendar's shared translation state. CalendarI18nProvider owns the only
 * react-i18next binding, so the hundreds of slots in a week do not each create one.
 *
 * @return The calendar translator, date-fns locale and slot labeler.
 */
const useCalendarTranslation = (): CalendarTranslation => {
    const translation = useContext(CalendarTranslationContext);
    if (!translation) {
        throw new Error("useCalendarTranslation must be used inside CalendarI18nProvider");
    }
    return translation;
};

export {CalendarTranslationContext, useCalendarTranslation};
export type {CalendarSelector, CalendarTranslation, SlotLabeler};
