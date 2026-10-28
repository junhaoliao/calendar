import {useEffect, useMemo, useState} from "react";
import type {ReactNode} from "react";
import {I18nextProvider, useTranslation} from "react-i18next";

import {createCalendarI18n} from "./index";
import {dateLocaleFor} from "./date-locale";
import {DEFAULT_LOCALE} from "./locales";
import type {CalendarLocale} from "./locales";
import {createSlotLabeler} from "./slot-label";
import {CalendarTranslationContext} from "./translations";
import type {CalendarSelector, CalendarTranslation} from "./translations";

const calendarHookOptions = {
    bindI18n: "languageChanged",
    bindI18nStore: "",
    useSuspense: false,
    keyPrefix: "",
} as const;

/** The calendar's single react-i18next binding, shared with calendar components through context. */
const CalendarTranslationProvider = ({children}: {children: ReactNode}) => {
    const {i18n, t} = useTranslation("calendar", calendarHookOptions);
    const language = i18n.language;
    const translation = useMemo<CalendarTranslation>(() => {
        const tCalendar = t as unknown as CalendarSelector;
        const dateLocale = dateLocaleFor(language);
        return {tCalendar, dateLocale, slotLabel: createSlotLabeler(tCalendar, dateLocale)};
    }, [t, language]);
    return <CalendarTranslationContext.Provider value={translation}>{children}</CalendarTranslationContext.Provider>;
};

/** One private synchronous resource store per calendar mount. */
const CalendarI18nProvider = ({locale, children}: {locale?: CalendarLocale; children: ReactNode}) => {
    const language = locale ?? DEFAULT_LOCALE;
    const [instance] = useState(() => createCalendarI18n(language));
    useEffect(() => {
        if (instance.language !== language) void instance.changeLanguage(language);
    }, [instance, language]);
    return (
        <I18nextProvider i18n={instance} defaultNS="calendar">
            <CalendarTranslationProvider>{children}</CalendarTranslationProvider>
        </I18nextProvider>
    );
};

export {CalendarI18nProvider};
