const SUPPORTED_LOCALES = ["en", "fr", "zh-Hans", "zh-Hant"] as const;

type CalendarLocale = (typeof SUPPORTED_LOCALES)[number];

const DEFAULT_LOCALE: CalendarLocale = "en";

export {DEFAULT_LOCALE, SUPPORTED_LOCALES};
export type {CalendarLocale};
