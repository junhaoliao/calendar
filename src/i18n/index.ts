import i18next from "i18next";
import type {i18n} from "i18next";

import {DEFAULT_LOCALE, SUPPORTED_LOCALES} from "./locales";
import {defaultNS, namespaces, resources} from "./resources";
import type {CalendarLocale} from "./locales";

/** A synchronous, per-calendar instance. The host's singleton is never initialized or mutated here. */
const createCalendarI18n = (locale: CalendarLocale = DEFAULT_LOCALE): i18n => {
    const instance = i18next.createInstance({
        lng: locale,
        fallbackLng: DEFAULT_LOCALE,
        supportedLngs: [...SUPPORTED_LOCALES],
        load: "currentOnly",
        ns: [...namespaces],
        defaultNS,
        resources,
        initAsync: false,
        enableSelector: true,
        returnNull: false,
        saveMissing: false,
        interpolation: {escapeValue: false},
    });
    void instance.init();
    return instance;
};

export {createCalendarI18n};
