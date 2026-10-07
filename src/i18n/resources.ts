import enCalendar from "./locales/en/calendar.json";
import frCalendar from "./locales/fr/calendar.json";
import zhHansCalendar from "./locales/zh-Hans/calendar.json";
import zhHantCalendar from "./locales/zh-Hant/calendar.json";

const namespaces = ["calendar"] as const;
const defaultNS = "calendar";

type LocaleResourceShape = {calendar: typeof enCalendar};
const defineTranslatedResources = <T extends LocaleResourceShape>(value: T) => value;

const resources = {
    en: defineTranslatedResources({calendar: enCalendar}),
    fr: defineTranslatedResources({calendar: frCalendar}),
    "zh-Hans": defineTranslatedResources({calendar: zhHansCalendar}),
    "zh-Hant": defineTranslatedResources({calendar: zhHantCalendar}),
};

export {defaultNS, namespaces, resources};
